import express, { Response } from 'express';
import { supabase, upsertBalance, isDbConfigured } from '../config/supabase.js';
import { authenticateToken, AuthenticatedRequest, requireAdmin } from '../middlewares/auth.js';
import { broadcastToAdmins } from '../services/wsService.js';
import { clearCache } from '../services/cacheService.js';
import { mockProfiles, mockPlatformBalances, mockComboCheckpoints, mockDeposits, mockWithdrawals, Deposit, Withdrawal } from '../config/sandboxStore.js';

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

    if (!isDbConfigured()) {
      const newDep: Deposit = {
        id: `dep-${Date.now()}`,
        user_id: userId || 'user-dev-uuid',
        platform,
        protocol: normalizedProtocol,
        amount: numericAmount,
        crypto_amount: isNaN(normalizedCryptoAmount) ? numericAmount : normalizedCryptoAmount,
        currency: normalizedCurrency,
        tx_hash: txHash.trim(),
        remark: remark || null,
        ip_address: clientIp,
        status: 'Pending',
        created_at: new Date().toISOString()
      };
      mockDeposits.push(newDep);
      return res.status(201).json({
        message: 'Deposit request successfully queued. Awaiting administrator approval.',
        deposit: newDep
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

    if (!isDbConfigured()) {
      const profile = mockProfiles.find(u => u.id === userId);
      if (!profile || !profile.bound_usdt_address || profile.bound_usdt_address.trim() === '') {
        return res.status(400).json({ error: 'Please configure and bind your USDT Withdrawal Address in Profile Settings before submitting withdrawal requests.' });
      }

      const balRow = mockPlatformBalances.find(b => b.user_id === userId && b.platform === platform);
      const currentPos = balRow ? (balRow.current_position || 0) : 0;
      const hasMockWithdrawalHistory = mockWithdrawals.some(w => w.user_id === userId);
      const isMockFirstTimeUser = !hasMockWithdrawalHistory && !balRow?.last_completed_batch_at;

      if (isMockFirstTimeUser && currentPos < 25) {
        const remaining = 25 - currentPos;
        return res.status(400).json({
          error: `Withdrawal is locked for first-time users until your first batch of 25 reviews is completed. You have ${remaining} order(s) remaining.`,
          withdrawalLocked: true,
          completedOrders: currentPos,
          remainingOrders: remaining
        });
      }

      const checkpoints = mockComboCheckpoints.filter(c => c.user_id === userId && c.platform === platform);
      const batchStart = balRow?.last_reset_at || new Date(0).toISOString();
      const approvedDeps = mockDeposits.filter(d => d.user_id === userId && d.platform === platform && d.status === 'Approved' && new Date(d.created_at).getTime() >= new Date(batchStart).getTime());
      const totalApprovedDeposits = approvedDeps.reduce((s, d) => s + d.amount, 0);
      const cumulativeRequiredCombo = checkpoints.reduce((s, c) => s + c.trigger_balance, 0);

      if (cumulativeRequiredCombo > 0 && totalApprovedDeposits < cumulativeRequiredCombo) {
        const remainingNeeded = Number((cumulativeRequiredCombo - totalApprovedDeposits).toFixed(2));
        return res.status(400).json({
          error: `Withdrawal is locked. Please deposit the remaining $${remainingNeeded.toFixed(2)} USD to clear your Special Combo order requirement first.`
        });
      }

      const pendingWithdrawals = mockWithdrawals.filter(w => w.user_id === userId && w.status === 'Pending');
      const pendingSum = pendingWithdrawals.reduce((s, w) => s + w.amount, 0);
      const availableBalance = Number(((profile.balance || 0) - pendingSum).toFixed(2));

      if (availableBalance < numericAmount) {
        return res.status(400).json({
          error: pendingSum > 0
            ? `Insufficient available balance. You have $${pendingSum.toFixed(2)} USD reserved in pending withdrawal requests.`
            : 'Insufficient wallet balance'
        });
      }

      const newWithdrawal: Withdrawal = {
        id: `withdraw-${Date.now()}`,
        user_id: userId || 'user-dev-uuid',
        platform,
        amount: numericAmount,
        address: profile.bound_usdt_address.trim() + '|' + platform,
        ip_address: clientIp,
        status: 'Pending',
        created_at: new Date().toISOString()
      };
      mockWithdrawals.push(newWithdrawal);

      return res.status(201).json({
        message: 'Withdrawal request successfully queued. Approvals complete within 5 minutes.',
        withdrawal: newWithdrawal
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
      .select('current_position, last_reset_at, last_completed_batch_at')
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

    // Subtract pending withdrawals from current balance to find available unreserved balance
    const { data: pendingWithdrawals } = await supabase
      .from('withdrawals')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'Pending');

    const pendingSum = (pendingWithdrawals || []).reduce((s: number, w: any) => s + (parseFloat(w.amount as any) || 0), 0);
    const availableBalance = Number((currentBalance - pendingSum).toFixed(2));

    if (availableBalance < numericAmount) {
      return res.status(400).json({
        error: pendingSum > 0
          ? `Insufficient available balance. You have $${pendingSum.toFixed(2)} USD reserved in pending withdrawal requests.`
          : 'Insufficient wallet balance'
      });
    }

    // Fetch withdrawal history and batch completion status
    const { data: userWithdrawals } = await supabase
      .from('withdrawals')
      .select('id')
      .eq('user_id', userId);

    const hasWithdrawalHistory = (userWithdrawals || []).length > 0;
    const hasCompletedPreviousBatch = !!(progressRow?.last_completed_batch_at);
    const isFirstTimeUser = !hasWithdrawalHistory && !hasCompletedPreviousBatch;

    const currentPosition = progressRow ? (parseInt(progressRow.current_position as any) || 0) : 0;
    if (isFirstTimeUser && currentPosition < 25) {
      const remaining = 25 - currentPosition;
      return res.status(400).json({
        error: `Withdrawal is locked for first-time users until your first batch of 25 reviews is completed. You have ${remaining} order(s) remaining.`,
        withdrawalLocked: true,
        completedOrders: currentPosition,
        remainingOrders: remaining
      });
    }

    // Verify user doesn't have an uncleared combo checkpoint (cumulative batch approved deposits >= cumulative required)
    const batchStart = progressRow?.last_reset_at ? new Date(progressRow.last_reset_at).toISOString() : new Date(0).toISOString();
    const [{ data: checkpoints }, { data: approvedDeps }] = await Promise.all([
      supabase.from('combo_checkpoints').select('trigger_balance').eq('user_id', userId).eq('platform', platform),
      supabase.from('deposits').select('amount').eq('user_id', userId).eq('platform', platform).eq('status', 'Approved').gte('created_at', batchStart)
    ]);

    const cumulativeRequiredCombo = (checkpoints || []).reduce((s: number, cp: any) => s + (parseFloat(cp.trigger_balance as any) || 0), 0);
    const totalApprovedDeposits = (approvedDeps || []).reduce((s: number, d: any) => s + (parseFloat(d.amount as any) || 0), 0);

    if (cumulativeRequiredCombo > 0 && totalApprovedDeposits < cumulativeRequiredCombo) {
      const remainingNeeded = Number((cumulativeRequiredCombo - totalApprovedDeposits).toFixed(2));
      return res.status(400).json({
        error: `Withdrawal is locked. Please deposit the remaining $${remainingNeeded.toFixed(2)} USD to clear your Special Combo order requirement first.`
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

    // Fetch platform progress to check batch start time
    const { data: progressRow } = await supabase
      .from('platform_balances')
      .select('current_position, last_reset_at')
      .eq('user_id', deposit.user_id)
      .eq('platform', deposit.platform)
      .maybeSingle();

    const batchStart = progressRow?.last_reset_at ? new Date(progressRow.last_reset_at).toISOString() : new Date(0).toISOString();

    // Fetch profile and approved deposits in current batch
    const [{ data: prof }, { data: pastApproved }] = await Promise.all([
      supabase.from('profiles').select('balance').eq('id', deposit.user_id).maybeSingle(),
      supabase.from('deposits').select('amount, created_at').eq('user_id', deposit.user_id).eq('platform', deposit.platform).eq('status', 'Approved').gte('created_at', batchStart).order('created_at', { ascending: true })
    ]);

    if (prof) {
      const currentBalance = parseFloat(prof.balance as any) || 0.0;
      const depositAmount = parseFloat(deposit.amount) || 0.0;

      const pastSum = (pastApproved || []).reduce((s: number, d: any) => s + (parseFloat(d.amount) || 0), 0);
      const newSum = pastSum + depositAmount;

      const { data: checkpoints } = await supabase
        .from('combo_checkpoints')
        .select('position, trigger_balance, profit_override')
        .eq('user_id', deposit.user_id)
        .eq('platform', deposit.platform)
        .order('position', { ascending: true });

      const sortedCPs = checkpoints ? [...checkpoints].sort((a: any, b: any) => a.position - b.position) : [];
      const firstComboPos = sortedCPs.length > 0 ? sortedCPs[0].position : 1;
      let preComboDeposits = 0;

      if (firstComboPos > 1) {
        const { data: cutoffReviews } = await supabase
          .from('review_submissions')
          .select('created_at')
          .eq('user_id', deposit.user_id)
          .eq('platform', deposit.platform)
          .eq('status', 'Completed')
          .gte('created_at', batchStart)
          .order('created_at', { ascending: true });

        if (cutoffReviews && cutoffReviews.length >= (firstComboPos - 1)) {
          const preComboCutoff = cutoffReviews[firstComboPos - 2].created_at;
          preComboDeposits = (pastApproved || [])
            .filter((d: any) => new Date(d.created_at).getTime() <= new Date(preComboCutoff).getTime())
            .reduce((s: number, d: any) => s + (parseFloat(d.amount as any) || 0), 0);
        } else {
          preComboDeposits = pastSum;
        }
      }

      const effectivePastSum = Math.max(0, Number((pastSum - preComboDeposits).toFixed(2)));
      const effectiveNewSum = Math.max(0, Number((newSum - preComboDeposits).toFixed(2)));

      let comboProfitToAdd = 0;
      let cumulativeReq = 0;
      let justClearedCombo: any = null;

      (checkpoints || []).forEach((cp: any) => {
        const req = parseFloat(cp.trigger_balance as any) || 0;
        cumulativeReq += req;

        if (effectivePastSum < cumulativeReq && effectiveNewSum >= cumulativeReq) {
          comboProfitToAdd += parseFloat(cp.profit_override as any) || 0;
          justClearedCombo = cp;
        }
      });

      const finalBalance = Number((currentBalance + depositAmount + comboProfitToAdd).toFixed(2));

      const { error: balErr } = await supabase
        .from('profiles')
        .update({ balance: finalBalance })
        .eq('id', deposit.user_id);

      if (balErr) {
        console.error('Failed to update balance on override-approve:', balErr);
      }

      // Update deposit status to Approved
      await supabase
        .from('deposits')
        .update({ status: 'Approved' })
        .eq('id', depositId);

      // Check if user satisfied all required combo deposits up to current position
      const currentPos = progressRow?.current_position || 0;
      const targetPos = currentPos + 1;
      const cumulativeReqForTargetPos = (checkpoints || [])
        .filter((cp: any) => cp.position <= targetPos)
        .reduce((s: number, cp: any) => s + (parseFloat(cp.trigger_balance as any) || 0), 0);

      if (newSum >= cumulativeReqForTargetPos) {
        await supabase
          .from('profiles')
          .update({ status: 'active' })
          .eq('id', deposit.user_id);
      }

      return res.json({
        success: true,
        message: 'Developer status override: Deposit approved.',
        comboCleared: !!justClearedCombo,
        position: justClearedCombo ? justClearedCombo.position : null,
        triggerBalance: justClearedCombo ? parseFloat(justClearedCombo.trigger_balance) : 0,
        profitBonus: justClearedCombo ? parseFloat(justClearedCombo.profit_override) : 0
      });
    } else {
      console.error('Failed to fetch profile for override-approve');
    }

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
