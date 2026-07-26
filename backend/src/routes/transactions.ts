import express, { Response } from 'express';
import { supabase, upsertBalance } from '../config/supabase.js';
import { authenticateToken, AuthenticatedRequest, requireAdmin } from '../middlewares/auth.js';
import { broadcastToAdmins } from '../services/wsService.js';
import { clearCache } from '../services/cacheService.js';

const router = express.Router();

// 1. Submit Deposit Request
router.post('/deposit', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { platform, protocol, amount, txHash, remark, currency, cryptoAmount } = req.body;

    if (!platform || !protocol || !amount) {
      return res.status(400).json({ error: 'Platform, protocol, and amount are required' });
    }

    if (!txHash || txHash.trim() === '') {
      return res.status(400).json({ error: 'TXID required' });
    }

    const validNetworks = ['TRC-20', 'ERC-20', 'BTC', 'ERC-25'];
    if (!validNetworks.includes(protocol)) {
      return res.status(400).json({ error: 'Invalid network selected' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Invalid deposit amount' });
    }

    const normalizedProtocol = protocol === 'ERC-25' ? 'ERC-20' : protocol;
    const normalizedCurrency = String(currency || (normalizedProtocol === 'BTC' ? 'BTC' : 'USDT')).toUpperCase();
    const normalizedCryptoAmount = parseFloat(cryptoAmount ?? amount);


    // Capture requester IP address
    let clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    if (clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim();
    if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') clientIp = '127.0.0.1';

    if (userId === 'user-dev-uuid' || userId === 'admin-dev-uuid') {
      return res.status(201).json({
        message: 'Deposit request successfully queued (Sandbox Mode).',
        deposit: {
          id: 'deposit-dev-uuid',
          platform,
          protocol: normalizedProtocol,
          amount: numericAmount,
          crypto_amount: isNaN(normalizedCryptoAmount) ? numericAmount : normalizedCryptoAmount,
          currency: normalizedCurrency,
          tx_hash: txHash,
          ip_address: clientIp,
          status: 'Pending'
        }
      });
    }

    const depositPayload: Record<string, any> = {
      user_id: userId,
      platform,
      protocol: normalizedProtocol,
      amount: numericAmount,
      tx_hash: txHash.trim(),
      remark: remark || null,
      ip_address: clientIp,
      status: 'Pending'
    };

    if (!isNaN(normalizedCryptoAmount)) {
      depositPayload.crypto_amount = normalizedCryptoAmount;
    }
    if (normalizedCurrency) {
      depositPayload.currency = normalizedCurrency;
    }

    let newDeposit: any;
    let error: any;
    const insertResult = await supabase
      .from('deposits')
      .insert(depositPayload)
      .select()
      .single();
    newDeposit = insertResult.data;
    error = insertResult.error;

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'This transaction hash (TxID) has already been submitted.' });
      }
      if (error.message?.includes('column') && (error.message?.includes('does not exist') || error.message?.includes('schema cache') || error.code === '42703')) {
        const fallbackResult = await supabase
          .from('deposits')
          .insert({
            user_id: userId,
            platform,
            protocol: normalizedProtocol,
            amount: numericAmount,
            tx_hash: txHash.trim(),
            remark: remark || null,
            ip_address: clientIp,
            status: 'Pending'
          })
          .select()
          .single();
        newDeposit = fallbackResult.data;
        error = fallbackResult.error;
      }
      if (error) {
        return res.status(500).json({ error: 'Failed to process deposit: ' + error.message });
      }
    }

    clearCache('stats');

    broadcastToAdmins('new_order', {
      type: 'deposit',
      amount: numericAmount,
      platform,
      currency: normalizedCurrency,
      cryptoAmount: isNaN(normalizedCryptoAmount) ? numericAmount : normalizedCryptoAmount,
      userId,
      txHash: txHash.trim()
    });

    res.status(201).json({
      message: 'Deposit request successfully queued. Awaiting administrator approval.',
      deposit: {
        ...newDeposit,
        currency: newDeposit?.currency || normalizedCurrency,
        crypto_amount: newDeposit?.crypto_amount ?? (isNaN(normalizedCryptoAmount) ? numericAmount : normalizedCryptoAmount),
        protocol: newDeposit?.protocol || normalizedProtocol
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 2. Submit Withdrawal Request
router.post('/withdraw', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { amount, platform } = req.body;

    if (!amount || !platform) {
      return res.status(400).json({ error: 'Amount and target platform are required' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount < 1.00) {
      return res.status(400).json({ error: 'Minimum withdrawal is 1 USDT' });
    }

    // Capture requester IP address
    let clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    if (clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim();
    if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') clientIp = '127.0.0.1';

    if (userId === 'user-dev-uuid' || userId === 'admin-dev-uuid') {
      return res.status(201).json({
        message: 'Withdrawal request successfully queued (Sandbox Mode).',
        withdrawal: { id: 'withdraw-dev-uuid', amount: numericAmount, address: 'TXdfH78ajH7aKjH8sKjD9sKa71La9aKs8F', ip_address: clientIp, status: 'Pending' }
      });
    }

    // Fetch user profile to get bound USDT address
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('bound_usdt_address')
      .eq('id', userId)
      .single();

    if (profileError || !profile || !profile.bound_usdt_address || profile.bound_usdt_address.trim() === '') {
      return res.status(400).json({ error: 'Please configure and bind your USDT Withdrawal Address in Profile Settings before submitting withdrawal requests.' });
    }

    const boundAddress = profile.bound_usdt_address.trim();

    // Fetch review progress from platform_balances for the user's active platform
    const { data: progressRow } = await supabase
      .from('platform_balances')
      .select('current_position, last_reset_at')
      .eq('user_id', userId)
      .eq('platform', platform)
      .maybeSingle();

    // SINGLE SOURCE OF TRUTH: Read balance from profiles
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .maybeSingle();

    if (profErr || !prof) {
      return res.status(400).json({ error: 'Could not verify balance details.' });
    }

    const currentBalance = parseFloat(prof.balance as any) || 0.0;
    if (currentBalance < numericAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Enforce 25-order compliance gate before allowing withdrawal
    const currentPosition = progressRow ? (parseInt(progressRow.current_position as any) || 0) : 0;

    // Check if user has any approved withdrawal ever
    const { data: pastWithdrawals } = await supabase
      .from('withdrawals')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'Approved')
      .limit(1);

    const hasWithdrawnBefore = pastWithdrawals && pastWithdrawals.length > 0;

    // Verify user doesn't have an uncleared combo (check via approved deposits in current batch)
    const nextPos = currentPosition + 1;
    const { data: checkpoint } = await supabase
      .from('combo_checkpoints')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('position', nextPos)
      .maybeSingle();

    let isCleared = false;
    if (checkpoint) {
      // Get all combo checkpoints at or before nextPos
      const { data: requiredCheckpoints } = await supabase
        .from('combo_checkpoints')
        .select('position')
        .eq('user_id', userId)
        .eq('platform', platform)
        .lte('position', nextPos);
      const requiredPositions = (requiredCheckpoints || []).map((c: any) => c.position);

      // For each required position, check if there's an approved deposit with matching combo remark
      let clearedCount = 0;
      for (const pos of requiredPositions) {
        const { count } = await supabase.from('deposits').select('id', { count: 'exact', head: true })
          .eq('user_id', userId).eq('platform', platform).eq('status', 'Approved')
          .ilike('remark', `%Combo Payment for Position ${pos}%`);
        if (count && count > 0) clearedCount++;
      }

      isCleared = clearedCount >= requiredPositions.length;
    }
    if (checkpoint && !isCleared) {
      return res.status(400).json({
        error: 'Withdrawal is locked. Please pay and complete your pending Special Combo order first.'
      });
    }

    // 25-order gate: only enforced for first-time users who have never withdrawn
    if (!hasWithdrawnBefore && currentPosition < 25) {
      const remaining = 25 - currentPosition;
      return res.status(400).json({
        error: `Withdrawal is locked. You must complete all 25 orders before withdrawing. You have ${remaining} order(s) remaining.`,
        withdrawalLocked: true,
        completedOrders: currentPosition,
        remainingOrders: remaining
      });
    }

    // Queue withdrawal request (balance is deducted on admin approval, not here)
    const { data: newWithdrawal, error: insertError } = await supabase
      .from('withdrawals')
      .insert({
        user_id: userId,
        amount: numericAmount,
        address: boundAddress + '|' + platform,
        ip_address: clientIp,
        status: 'Pending',
        platform: platform
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: 'Failed to queue withdrawal request: ' + insertError.message });
    }

    clearCache('stats');

    // Broadcast to admin panel: new pending withdrawal
    broadcastToAdmins('new_order', { type: 'withdrawal', amount, platform, userId: req.user?.id });

    res.status(201).json({
      message: 'Withdrawal request successfully queued. Approvals complete within 5 minutes.',
      withdrawal: newWithdrawal
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 3. Get User Transaction History
router.get('/history', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // Fetch user's deposits (exclude bonus grants — those are separate)
    const { data: deposits } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', userId)
      .neq('protocol', 'BONUS')
      .order('created_at', { ascending: false });

    // Fetch user's withdrawals
    const { data: withdrawals } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId);

    // Format and merge ledger entries
    const formattedDeposits = (deposits || []).map((dep: any) => ({
      id: dep.id,
      type: 'Deposit',
      amount: parseFloat(dep.amount),
      cryptoAmount: parseFloat(dep.crypto_amount ?? dep.amount) || parseFloat(dep.amount),
      currency: dep.currency || (dep.protocol === 'BTC' ? 'BTC' : 'USDT'),
      platform: dep.platform,
      protocol: dep.protocol,
      txHash: dep.tx_hash,
      remark: dep.remark,
      status: dep.status,
      date: new Date(dep.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      details: `${dep.protocol} ${dep.currency || (dep.protocol === 'BTC' ? 'BTC' : 'USDT')} - Hash: ${dep.tx_hash?.substring(0, 8) || 'N/A'}...`
    }));

    const formattedWithdrawals = (withdrawals || []).map((w: any) => {
      const parts = (w.address || '').split('|');
      const rawAddress = parts[0] || '';
      const platformName = parts[1] || 'Amazon';
      return {
        id: w.id,
        type: 'Withdrawal',
        platform: platformName,
        amount: parseFloat(w.amount),
        status: w.status,
        date: new Date(w.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        details: `Wallet Address: ${rawAddress.substring(0, 8)}...`
      };
    });

    const history = [...formattedDeposits, ...formattedWithdrawals].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 4. Developer Test Deposit Approval Override Endpoints
router.post('/override-approve-deposit', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { depositId } = req.body;
    if (!depositId) {
      return res.status(400).json({ error: 'Deposit ID is required' });
    }

    // Fetch deposit details
    const { data: deposit, error: fetchError } = await supabase
      .from('deposits')
      .select('*')
      .eq('id', depositId)
      .single();

    if (fetchError || !deposit) {
      return res.status(404).json({ error: 'Deposit request not found' });
    }

    if (deposit.status !== 'Pending') {
      return res.json({ success: true, message: 'Deposit already processed' });
    }

    // Update status
    await supabase
      .from('deposits')
      .update({ status: 'Approved' })
      .eq('id', depositId);

    // Credit balance from profiles (single source of truth) + combo profit
    const [{ data: prof }, { data: progressRow }] = await Promise.all([
      supabase.from('profiles').select('balance').eq('id', deposit.user_id).maybeSingle(),
      supabase.from('platform_balances').select('current_position').eq('user_id', deposit.user_id).eq('platform', deposit.platform).maybeSingle()
    ]);

    if (prof) {
      const currentBalance = parseFloat(prof.balance as any) || 0.0;
      const depositAmount = parseFloat(deposit.amount);
      const currentPos = progressRow?.current_position || 0;
      const nextPosition = currentPos + 1;

      const { data: checkpoint } = await supabase
        .from('combo_checkpoints')
        .select('profit_override')
        .eq('user_id', deposit.user_id)
        .eq('platform', deposit.platform)
        .eq('position', nextPosition)
        .maybeSingle();

      let finalBalance = Number((currentBalance + depositAmount).toFixed(2));
      if (checkpoint) {
        const profitOverride = parseFloat(checkpoint.profit_override as any) || 0.00;
        finalBalance = Number((currentBalance + depositAmount + profitOverride).toFixed(2));
      }

      const { error: balErr } = await supabase
        .from('profiles')
        .update({ balance: finalBalance })
        .eq('id', deposit.user_id);

      if (balErr) {
        console.error('Failed to update balance on override-approve:', balErr);
      }
    } else {
      console.error('Failed to fetch profile for override-approve');
    }

    // Unlock profile status
    await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', deposit.user_id);

    res.json({ success: true, message: 'Developer status override: Deposit approved.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/override-reject-deposit', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { depositId } = req.body;
    if (!depositId) {
      return res.status(400).json({ error: 'Deposit ID is required' });
    }

    await supabase
      .from('deposits')
      .update({ status: 'Rejected' })
      .eq('id', depositId);

    res.json({ success: true, message: 'Developer status override: Deposit rejected.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
