import express, { Response } from 'express';
import { supabase, isDbConfigured } from '../config/supabase.js';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth.js';
import { broadcastToUser, broadcastToAdmins } from '../services/wsService.js';
import { mockProfiles, mockPlatformBalances, mockProducts, mockUserAssignedProducts, mockComboCheckpoints, mockDeposits, mockReviewSubmissions, ReviewSubmission, ensureDefaultProducts } from '../config/sandboxStore.js';

const router = express.Router();

async function maybeAwardReferralBonus(referredUserId?: string, platform?: string) {
  try {
    if (!platform || !referredUserId) {
      return;
    }
    const { data: referredProfile, error: referredError } = await supabase
      .from('profiles')
      .select('referred_by')
      .eq('id', referredUserId)
      .maybeSingle();

    if (referredError || !referredProfile?.referred_by) {
      return;
    }

    const { data: referrerProfile, error: referrerError } = await supabase
      .from('profiles')
      .select('id, balance')
      .eq('referral_code', referredProfile.referred_by)
      .maybeSingle();

    if (referrerError || !referrerProfile) {
      return;
    }

    const bonusAmount = 1.50;
    const currentBalance = parseFloat(referrerProfile.balance as any) || 0.0;
    const updatedBalance = Number((currentBalance + bonusAmount).toFixed(2));

    await supabase
      .from('profiles')
      .update({ balance: updatedBalance })
      .eq('id', referrerProfile.id);

    await supabase.from('deposits').insert({
      user_id: referrerProfile.id,
      platform,
      protocol: 'REFERRAL',
      amount: bonusAmount,
      tx_hash: `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      remark: 'Referral bonus for 3 completed reviews',
      status: 'Approved'
    });

    broadcastToUser(referrerProfile.id, 'balance_update', { type: 'bonus', amount: bonusAmount, platform });
  } catch (error) {
    console.warn('Referral bonus processing failed:', error);
  }
}

// Fetch ALL Campaigns Pool products for visual marquee showcase (no platform filter required, available to all logged-in users)
router.get('/products/all', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(products || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 1. Fetch Campaigns Pool by Platform
router.get('/products', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { platform } = req.query;

    if (!platform) {
      return res.status(400).json({ error: 'Platform query parameter is required' });
    }

    const userId = req.user?.id;

    if (!isDbConfigured()) {
      ensureDefaultProducts();
      const assigned = mockUserAssignedProducts
        .filter(a => a.user_id === userId && a.platform === platform)
        .sort((a, b) => a.position - b.position);

      if (assigned.length === 0) return res.json([]);
      const sortedProds = assigned.map(a => {
        const prod = mockProducts.find(p => p.id === a.product_id);
        return prod ? { ...prod, position: a.position, assignedAt: a.created_at } : null;
      }).filter(Boolean);
      return res.json(sortedProds);
    }

    // Check if user has specific assigned products for this platform
    const { data: assigned } = await supabase
      .from('user_assigned_products')
      .select('product_id, position, created_at')
      .eq('user_id', userId)
      .eq('platform', platform)
      .order('position', { ascending: true });

    if (!assigned || assigned.length === 0) {
      // If no products assigned, this platform is locked/unassigned for this user
      return res.json([]);
    }

    const assignedIds = assigned.map((a: any) => a.product_id);
    let { data: products, error } = await supabase
      .from('products')
      .select('*')
      .in('id', assignedIds);

    if (error) {
      return res.status(500).json({ error: 'Failed to retrieve products: ' + error.message });
    }

    // Sort products by exact position (1 to 25) assigned by Admin
    const productMap = new Map((products || []).map((p: any) => [p.id, p]));
    const sortedProducts = assigned
      .map((a: any, idx: number) => {
        const prod = productMap.get(a.product_id);
        if (!prod) return null;
        return {
          ...prod,
          position: a.position || (idx + 1),
          assignedAt: a.created_at || new Date().toISOString()
        };
      })
      .filter(Boolean);

    res.json(sortedProducts);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 2. Submit Review Draft for Verification — OPTIMIZED: parallel queries, no redundant fetches
router.post('/submit', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { productId, orderId, reviewText } = req.body;

    // Fast-fail: input validation (no DB calls)
    if (!productId || !reviewText) {
      return res.status(400).json({ error: 'Product ID and feedback template selection are required' });
    }
    if (typeof reviewText !== 'string' || reviewText.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid review text format' });
    }
    if (reviewText.length > 500) {
      return res.status(400).json({ error: 'Review text exceeds maximum allowed length of 500 characters' });
    }
    if (!['01', '02', '03'].includes(reviewText)) {
      return res.status(400).json({ error: 'Invalid feedback selection. Please select one of the three preset text templates.' });
    }

    const finalOrderId = orderId || ('ORD-' + Math.random().toString(36).substring(2, 12).toUpperCase());

    // Dev sandbox mode
    if (!isDbConfigured()) {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      ensureDefaultProducts();
      const assignment = mockUserAssignedProducts.find(a => a.user_id === userId && a.product_id === productId);
      if (!assignment) {
        return res.status(400).json({ error: 'This campaign product is not assigned to your active workspace.' });
      }
      const platform = assignment.platform;
      const product = mockProducts.find(p => p.id === productId);
      const payoutEarned = product ? product.payout : 1.00;

      let bal = mockPlatformBalances.find(b => b.user_id === userId && b.platform === platform);
      if (!bal) {
        bal = { id: `bal-${userId}-${platform}`, user_id: userId, platform, wallet_balance: 0, reviews_count: 0, current_position: 0, last_reset_at: new Date().toISOString() };
        mockPlatformBalances.push(bal);
      }
      const activeBal = bal;

      let profile = mockProfiles.find(u => u.id === userId);
      if (!profile) {
        profile = { id: userId, username: 'testuser', password: 'password', country: 'Unknown', city: 'Unknown', ip_address: '127.0.0.1', status: 'active', referral_code: 'REF123', balance: 0.00, created_at: new Date().toISOString() };
        mockProfiles.push(profile);
      }

      const currentPos = activeBal.current_position || 0;
      if (currentPos >= 25) {
        return res.status(400).json({ error: 'All 25 orders completed. Wait for admin to assign new orders.', batchComplete: true });
      }

      const nextPos = currentPos + 1;
      const checkpoint = mockComboCheckpoints.find(c => c.user_id === userId && c.platform === platform && c.position === nextPos);
      const batchStart = activeBal.last_reset_at || new Date(0).toISOString();

      if (checkpoint) {
        const userCheckpoints = mockComboCheckpoints
          .filter(c => c.user_id === userId && c.platform === platform)
          .sort((a, b) => a.position - b.position);
        const cumulativeRequired = userCheckpoints
          .filter(c => c.position <= nextPos)
          .reduce((sum, cp) => sum + cp.trigger_balance, 0);

        const approvedDeps = mockDeposits
          .filter(d => d.user_id === userId && d.platform === platform && d.status === 'Approved' && new Date(d.created_at).getTime() >= new Date(batchStart).getTime())
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const totalApprovedDeposits = approvedDeps.reduce((sum, d) => sum + d.amount, 0);

        const firstComboPos = userCheckpoints[0]?.position || nextPos;
        let preComboDeposits = 0;
        if (firstComboPos > 1) {
          const userSubs = mockReviewSubmissions
            .filter(s => s.user_id === userId && s.platform === platform && s.status === 'Completed' && new Date(s.created_at).getTime() >= new Date(batchStart).getTime())
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          if (userSubs.length >= (firstComboPos - 1)) {
            const preComboCutoff = userSubs[firstComboPos - 2].created_at;
            preComboDeposits = approvedDeps
              .filter(d => new Date(d.created_at).getTime() <= new Date(preComboCutoff).getTime())
              .reduce((s, d) => s + d.amount, 0);
          } else {
            preComboDeposits = totalApprovedDeposits;
          }
        }
        const effectiveApproved = Math.max(0, Number((totalApprovedDeposits - preComboDeposits).toFixed(2)));

        if (effectiveApproved < cumulativeRequired) {
          const remainingAmount = Number((cumulativeRequired - effectiveApproved).toFixed(2));
          return res.status(403).json({
            error: 'COMBO_BLOCK',
            triggerBalance: checkpoint.trigger_balance,
            profitAmount: checkpoint.profit_override,
            currentBalance: profile.balance,
            position: nextPos,
            depositedAmount: effectiveApproved,
            requiredAmount: cumulativeRequired,
            remainingAmount: remainingAmount
          });
        }
      }

      const newBalance = Number(((profile.balance || 0) + payoutEarned).toFixed(2));
      profile.balance = newBalance;
      activeBal.current_position = nextPos;
      activeBal.reviews_count = (activeBal.reviews_count || 0) + 1;

      const submission: ReviewSubmission = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        user_id: userId,
        product_id: productId,
        order_id: finalOrderId,
        review_text: reviewText,
        status: 'Completed',
        payout_earned: payoutEarned,
        platform,
        created_at: new Date().toISOString()
      };
      mockReviewSubmissions.push(submission);

      return res.status(201).json({
        message: 'Review successfully submitted and commission credited to your account.',
        submission,
        isCombo: !!checkpoint,
        checkpointAmount: checkpoint ? checkpoint.trigger_balance : 0,
        profitBonus: checkpoint ? checkpoint.profit_override : 0,
        payoutEarned,
        completedReviewsCount: nextPos,
        walletBalance: newBalance,
        nextComboBlocked: false,
        nextComboDetails: null
      });
    }

    // ========== PHASE 1: Parallel fetch everything we need upfront ==========
    const [{ data: product, error: productError }, { data: assignment, error: assignError }] = await Promise.all([
      supabase.from('products').select('payout').eq('id', productId).single(),
      supabase.from('user_assigned_products').select('platform, created_at').eq('user_id', userId).eq('product_id', productId).single()
    ]);

    if (productError || !product) {
      return res.status(404).json({ error: 'Product campaign not found' });
    }
    if (assignError || !assignment) {
      return res.status(400).json({ error: 'This campaign product is not assigned to your active workspace.' });
    }

    const platform = assignment.platform;
    const payoutEarned = parseFloat(product.payout) || 1.00;

    // Fetch balance record + profile balance + duplicate check — all in parallel
    const batchStartTime = new Date(0).toISOString(); // will refine after we get balance record
    const [{ data: balanceRecord }, { data: prof }] = await Promise.all([
      supabase.from('platform_balances').select('*').eq('user_id', userId).eq('platform', platform).maybeSingle(),
      supabase.from('profiles').select('balance').eq('id', userId).maybeSingle()
    ]);

    // Auto-create platform row if missing
    let bal = balanceRecord;
    if (!bal) {
      const { data: newRow } = await supabase
        .from('platform_balances')
        .insert({ user_id: userId, platform, wallet_balance: 0, reviews_count: 0, current_position: 0 })
        .select('*').single();
      bal = newRow;
    }
    if (!bal) {
      return res.status(400).json({ error: 'Could not initialise progress tracking.' });
    }

    const currentBalance = prof ? (parseFloat(prof.balance as any) || 0.0) : 0.0;
    const currentPos = bal.current_position || 0;
    const nextPosition = currentPos + 1;
    const batchStart = bal.last_reset_at ? new Date(bal.last_reset_at).toISOString() : new Date(0).toISOString();

    // ========== PHASE 2: Business rule checks ==========

    // 25 order limit
    if (currentPos >= 25) {
      return res.status(400).json({ error: 'All 25 orders completed. Wait for admin to assign new orders.', batchComplete: true });
    }

    // Combo checkpoint + duplicate submission — parallel
    const [{ data: checkpoint }, { data: existingSubmission }] = await Promise.all([
      supabase.from('combo_checkpoints').select('*').eq('user_id', userId).eq('platform', platform).eq('position', nextPosition).maybeSingle(),
      supabase.from('review_submissions').select('id').eq('user_id', userId).eq('product_id', productId).eq('platform', platform).gte('created_at', batchStart).limit(1)
    ]);

    if (existingSubmission && existingSubmission.length > 0) {
      return res.status(400).json({ error: 'You have already submitted a review verification request for this campaign in the current batch.' });
    }

    if (checkpoint) {
      // Calculate cumulative required deposit for all combo checkpoints up to nextPosition
      const [{ data: allCheckpoints }, { data: approvedDeps }] = await Promise.all([
        supabase.from('combo_checkpoints').select('position, trigger_balance, profit_override').eq('user_id', userId).eq('platform', platform).lte('position', nextPosition).order('position', { ascending: true }),
        supabase.from('deposits').select('amount, created_at').eq('user_id', userId).eq('platform', platform).eq('status', 'Approved').gte('created_at', batchStart).order('created_at', { ascending: true })
      ]);

      const totalApprovedDeposits = (approvedDeps || []).reduce((sum: number, d: any) => sum + (parseFloat(d.amount) || 0), 0);
      const cumulativeRequired = (allCheckpoints || []).reduce((sum: number, cp: any) => sum + (parseFloat(cp.trigger_balance as any) || 0), 0);

      const firstComboPos = allCheckpoints && allCheckpoints.length > 0 ? allCheckpoints[0].position : nextPosition;
      let preComboDeposits = 0;

      if (firstComboPos > 1) {
        const { data: cutoffReviews } = await supabase
          .from('review_submissions')
          .select('created_at')
          .eq('user_id', userId)
          .eq('platform', platform)
          .eq('status', 'Completed')
          .gte('created_at', batchStart)
          .order('created_at', { ascending: true });

        if (cutoffReviews && cutoffReviews.length >= (firstComboPos - 1)) {
          const preComboCutoff = cutoffReviews[firstComboPos - 2].created_at;
          preComboDeposits = (approvedDeps || [])
            .filter((d: any) => new Date(d.created_at).getTime() <= new Date(preComboCutoff).getTime())
            .reduce((s: number, d: any) => s + (parseFloat(d.amount as any) || 0), 0);
        } else {
          preComboDeposits = totalApprovedDeposits;
        }
      }

      const effectiveApproved = Math.max(0, Number((totalApprovedDeposits - preComboDeposits).toFixed(2)));

      if (effectiveApproved < cumulativeRequired) {
        const remainingAmount = Number((cumulativeRequired - effectiveApproved).toFixed(2));
        return res.status(403).json({
          error: 'COMBO_BLOCK',
          triggerBalance: parseFloat(checkpoint.trigger_balance as any) || 0.00,
          profitAmount: parseFloat(checkpoint.profit_override as any) || 0.00,
          currentBalance: Number((currentBalance + payoutEarned).toFixed(2)),
          position: nextPosition,
          depositedAmount: effectiveApproved,
          requiredAmount: cumulativeRequired,
          remainingAmount: remainingAmount
        });
      }
    }

    // ========== PHASE 3: Write — balance + progress parallel ==========
    const newBalance = Number((currentBalance + payoutEarned).toFixed(2));

    const [{ error: balErr }, { data: updateResult, error: progressError }] = await Promise.all([
      supabase.from('profiles').update({ balance: newBalance }).eq('id', userId),
      supabase.from('platform_balances').update({ reviews_count: (bal.reviews_count || 0) + 1, current_position: nextPosition }).eq('user_id', userId).eq('platform', platform).eq('current_position', currentPos).select('current_position')
    ]);

    if (balErr) {
      return res.status(500).json({ error: 'Failed to update balance: ' + balErr.message });
    }
    if (progressError || !updateResult || updateResult.length === 0) {
      supabase.from('profiles').update({ balance: currentBalance }).eq('id', userId);
      return res.status(400).json({ error: progressError ? 'Failed to update review progress: ' + progressError.message : 'Order limit reached. Another submission was processed concurrently.' });
    }

    // Insert submission (with fallback if schema cache lacks platform column)
    let { data: submission, error: insertError } = await supabase
      .from('review_submissions')
      .insert({ user_id: userId, product_id: productId, order_id: finalOrderId, review_text: reviewText, payout_earned: payoutEarned, status: 'Completed', platform })
      .select().single();

    if (insertError && (insertError.message.includes('platform') || insertError.message.includes('schema cache'))) {
      console.warn("Retrying review_submissions insert without platform column:", insertError.message);
      const retry = await supabase
        .from('review_submissions')
        .insert({ user_id: userId, product_id: productId, order_id: finalOrderId, review_text: reviewText, payout_earned: payoutEarned, status: 'Completed' })
        .select().single();
      submission = retry.data;
      insertError = retry.error;
    }

    if (insertError) {
      console.error("Insert failed, rolling back:", insertError.message);
      await Promise.all([
        supabase.from('profiles').update({ balance: currentBalance }).eq('id', userId),
        supabase.from('platform_balances').update({ reviews_count: bal.reviews_count || 0, current_position: currentPos }).eq('user_id', userId).eq('platform', platform).eq('current_position', nextPosition),
        supabase.from('review_submissions').delete().eq('user_id', userId).eq('product_id', productId).eq('order_id', finalOrderId)
      ]);
      return res.status(500).json({ error: 'Failed to record review: ' + insertError.message });
    }

    // ========== PHASE 4: Post-write — fire and forget ==========
    // Referral bonus (fire & forget — don't block response)
    const { count: completedReviewCount } = await supabase
      .from('review_submissions').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'Completed');
    if ((completedReviewCount || 0) === 3) {
      maybeAwardReferralBonus(userId, platform);
    }

    // Next combo check
    const nextCampaignPos = currentPos + 2;
    let nextComboBlocked = false;
    let nextComboDetails = null;

    const { data: nextCheckpoint } = await supabase
      .from('combo_checkpoints').select('*').eq('user_id', userId).eq('platform', platform).eq('position', nextCampaignPos).maybeSingle();

    if (nextCheckpoint) {
      const [{ data: allCPs }, { data: appDeps }] = await Promise.all([
        supabase.from('combo_checkpoints').select('position, trigger_balance').eq('user_id', userId).eq('platform', platform).lte('position', nextCampaignPos).order('position', { ascending: true }),
        supabase.from('deposits').select('amount, created_at').eq('user_id', userId).eq('platform', platform).eq('status', 'Approved').gte('created_at', batchStart).order('created_at', { ascending: true })
      ]);
      const cumReq = (allCPs || []).reduce((s: number, cp: any) => s + (parseFloat(cp.trigger_balance as any) || 0), 0);
      const totApp = (appDeps || []).reduce((s: number, d: any) => s + (parseFloat(d.amount as any) || 0), 0);

      const firstComboPos = allCPs && allCPs.length > 0 ? allCPs[0].position : nextCampaignPos;
      let preComboDeposits = 0;

      if (firstComboPos > 1) {
        const { data: cutoffReviews } = await supabase
          .from('review_submissions')
          .select('created_at')
          .eq('user_id', userId)
          .eq('platform', platform)
          .eq('status', 'Completed')
          .gte('created_at', batchStart)
          .order('created_at', { ascending: true });

        if (cutoffReviews && cutoffReviews.length >= (firstComboPos - 1)) {
          const preComboCutoff = cutoffReviews[firstComboPos - 2].created_at;
          preComboDeposits = (appDeps || [])
            .filter((d: any) => new Date(d.created_at).getTime() <= new Date(preComboCutoff).getTime())
            .reduce((s: number, d: any) => s + (parseFloat(d.amount as any) || 0), 0);
        } else {
          preComboDeposits = totApp;
        }
      }

      const effectiveApproved = Math.max(0, Number((totApp - preComboDeposits).toFixed(2)));
      nextComboBlocked = effectiveApproved < cumReq;
      if (nextComboBlocked) {
        const rem = Math.max(0, Number((cumReq - effectiveApproved).toFixed(2)));
        nextComboDetails = {
          position: nextCampaignPos,
          triggerBalance: parseFloat(nextCheckpoint.trigger_balance as any) || 0.00,
          profitAmount: parseFloat(nextCheckpoint.profit_override as any) || 0.00,
          depositedAmount: effectiveApproved,
          remainingAmount: rem > 0 ? rem : (parseFloat(nextCheckpoint.trigger_balance as any) || 0.00),
          currentBalance: newBalance
        };
      }
    }

    broadcastToUser(userId!, 'balance_update', { type: 'review_completed', balance: newBalance });
    broadcastToAdmins('user_review_completed', { userId, platform, completedReviewsCount: currentPos + 1, totalRequired: 25 });

    res.status(201).json({
      message: 'Review successfully submitted and commission credited to your account.',
      submission,
      isCombo: !!checkpoint,
      checkpointAmount: checkpoint ? parseFloat(checkpoint.trigger_balance as any) : 0,
      profitBonus: checkpoint ? parseFloat(checkpoint.profit_override as any) || 0 : 0,
      payoutEarned,
      completedReviewsCount: currentPos + 1,
      walletBalance: newBalance,
      nextComboBlocked,
      nextComboDetails
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 3. Get User Review Submissions List
router.get('/submissions', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // Fetch batch start times per platform to filter submissions to current batch only
    const { data: balances } = await supabase
      .from('platform_balances')
      .select('platform, last_reset_at')
      .eq('user_id', userId);

    const batchStartMap: Record<string, string> = {};
    if (balances) {
      for (const b of balances) {
        batchStartMap[b.platform] = b.last_reset_at || new Date(0).toISOString();
      }
    }

    const { data: submissions, error } = await supabase
      .from('review_submissions')
      .select(`
        id,
        product_id,
        order_id,
        review_text,
        status,
        payout_earned,
        created_at,
        product:products (
          title,
          image_url
        )
      `)
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch submissions: ' + error.message });
    }

    // Fetch assigned products mapping to infer platform if sub.platform is null
    const { data: assignedProducts } = await supabase
      .from('user_assigned_products')
      .select('product_id, platform')
      .eq('user_id', userId);

    const productPlatformMap: Record<string, string> = {};
    if (assignedProducts) {
      for (const a of assignedProducts) {
        productPlatformMap[a.product_id] = a.platform;
      }
    }

    // Filter submissions to current batch only (created at or after last_reset_at)
    const formattedSubmissions = (submissions || [])
      .filter((sub: any) => {
        const plat = sub.platform || productPlatformMap[sub.product_id] || 'Amazon';
        const batchStart = batchStartMap[plat] || new Date(0).toISOString();
        return new Date(sub.created_at).getTime() >= new Date(batchStart).getTime();
      })
      .map((sub: any) => {
        const plat = sub.platform || productPlatformMap[sub.product_id] || 'Amazon';
        return {
          id: sub.id,
          productId: sub.product_id,
          productTitle: sub.product?.title || 'Unknown Product',
          productImage: sub.product?.image_url || '',
          platform: plat,
          orderId: sub.order_id,
          reviewText: sub.review_text,
          payout: parseFloat(sub.payout_earned) || 0.00,
          status: sub.status,
          createdAt: sub.created_at,
          date: new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        };
      });

    res.json(formattedSubmissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 4. Search products directly from Amazon
router.get('/amazon-search', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const query = q.trim();
    const targetUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    const items: any[] = [];

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      if (response.ok) {
        const html = await response.text();

        // Split HTML by s-search-result component blocks
        const blocks = html.split('data-component-type="s-search-result"');

        for (let i = 1; i < Math.min(blocks.length, 12); i++) {
          const block = blocks[i];

          // 1. Extract ASIN
          const asinMatch = block.match(/data-asin="([A-Z0-9]{10})"/i);
          const asin = asinMatch ? asinMatch[1] : '';
          if (!asin) continue;

          // 2. Extract Title
          let title = '';
          const altMatch = block.match(/alt="([^"]+)"/i);
          if (altMatch && altMatch[1] && !altMatch[1].toLowerCase().includes('product image') && altMatch[1].trim().length > 3) {
            title = altMatch[1].trim();
          } else {
            const titleMatch = block.match(/<span class="[^"]*a-text-normal"[^>]*>([^<]+)<\/span>/i) ||
                               block.match(/<span class="[^"]*a-size-[^"]*"[^>]*>([^<]+)<\/span>/i) ||
                               block.match(/<h2>.*?<span[^>]*>([^<]+)<\/span>/is);
            title = titleMatch ? titleMatch[1].trim() : 'Amazon Product';
          }

          title = title
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');

          // 3. Extract Image URL
          const imgMatch = block.match(/src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i) ||
                           block.match(/src="(https:\/\/images-na\.ssl-images-amazon\.com\/images\/I\/[^"]+)"/i);
          const imageUrl = imgMatch ? imgMatch[1] : 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=500';

          // 4. Extract Price
          const priceMatch = block.match(/<span class="a-offscreen">\$([^<]+)<\/span>/i) ||
                             block.match(/<span class="a-price-whole">([^<]+)<\/span>/i);
          let price = '19.99';
          if (priceMatch && priceMatch[1]) {
            price = priceMatch[1].replace(/[^0-9.]/g, '');
          }

          items.push({
            asin,
            title,
            imageUrl,
            price: parseFloat(price) || 19.99,
            link: `https://www.amazon.com/dp/${asin}`
          });
        }
      }
    } catch (scrapeError) {
      console.warn("Amazon scraping failed or was blocked:", scrapeError);
    }

    // Fallback Mock System if scrape yields 0 organic results
    if (items.length === 0) {
      console.log('Amazon search scraped 0 items. Generating high-fidelity mock results...');
      const cleanQuery = query.toLowerCase();

      // Curate specific premium images based on query keywords
      let searchImage = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'; // fallback watch
      if (cleanQuery.includes('hair') || cleanQuery.includes('dryer') || cleanQuery.includes('blow')) {
        searchImage = 'https://images.unsplash.com/photo-1522337360788-8b13edd793be?w=500'; // hairdryer/beauty
      } else if (cleanQuery.includes('phone') || cleanQuery.includes('mobile') || cleanQuery.includes('iphone')) {
        searchImage = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500'; // phone
      } else if (cleanQuery.includes('headphone') || cleanQuery.includes('audio') || cleanQuery.includes('earbud')) {
        searchImage = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'; // headphone
      } else if (cleanQuery.includes('shoe') || cleanQuery.includes('sneaker') || cleanQuery.includes('boot')) {
        searchImage = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'; // shoe
      } else if (cleanQuery.includes('watch') || cleanQuery.includes('smartwatch')) {
        searchImage = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'; // watch
      } else {
        // Random assortment of high quality unsplash product images
        const unsplashProducts = [
          'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=500', // mic
          'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500', // sunglasses
          'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=500', // shoe
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500', // headphone
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500', // watch
          'https://images.unsplash.com/photo-1522337360788-8b13edd793be?w=500'  // hairdryer
        ];
        searchImage = unsplashProducts[Math.floor(Math.random() * unsplashProducts.length)];
      }

      const capitalize = (s: string) => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const displayQuery = capitalize(query);

      const prices = [29.99, 49.99, 19.99, 79.99, 12.50, 99.00, 149.99, 34.99];
      const adjectives = ['Premium', 'Professional', 'Ultra-Durable', 'Ergonomic', 'Compact', 'Wireless', 'Smart', 'Limited Edition'];
      const asins = ['B081SM4231', 'B07WF9Z501', 'B091FL3246', 'B08FML3102', 'B07M5A2461', 'B09HML2154', 'B0892B1945', 'B09JML8211'];

      for (let i = 0; i < 8; i++) {
        items.push({
          asin: asins[i],
          title: `${adjectives[i]} ${displayQuery} Pro Series ${i + 1}`,
          imageUrl: searchImage,
          price: prices[i],
          link: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`
        });
      }
    }

    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
