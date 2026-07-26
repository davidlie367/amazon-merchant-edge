import express, { Response } from 'express';
import { supabase, upsertBalance } from '../config/supabase.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middlewares/auth.js';
import { mockChatMessages } from '../config/sandboxStore.js';
import { broadcastToUser, broadcastToAdmins } from '../services/wsService.js';
import { getCache, setCache, clearCache } from '../services/cacheService.js';

const router = express.Router();

const isDbConfigured = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('your-project-id') &&
                       process.env.SUPABASE_KEY && !process.env.SUPABASE_KEY.includes('your-supabase-anon-key');

// Helper function to log administrative actions
async function logAdminAction(adminId: string, action: string, targetUserId: string | null, details: string, req: AuthenticatedRequest) {
  try {
    let ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    if (ipAddress.includes(',')) ipAddress = ipAddress.split(',')[0].trim();
    if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') ipAddress = '127.0.0.1';

    console.log(`[Admin Audit] Admin: ${adminId} | Action: ${action} | Target: ${targetUserId} | Details: ${details} | IP: ${ipAddress}`);
  } catch (err) {
    console.error("Failed to log admin action:", err);
  }
}

// Apply admin access check middleware to all routes in this file
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.isRestricted) {
    return res.status(403).json({ error: 'Access Denied: Restricted operator privileges locked.' });
  }
  try {
    const cachedStats = getCache('stats');
    if (cachedStats) {
      return res.json(cachedStats);
    }

    let totalUsers = 0;
    let activeUsers = 0;
    let totalDeposited = 0.0;
    let totalWithdrawn = 0.0;
    let pendingApprovals = 0;
    let feed: any[] = [];

    const userGrowth: { label: string, count: number }[] = [];
    const dailyDeposits: { label: string, amount: number }[] = [];
    const dailyWithdrawals: { label: string, amount: number }[] = [];

    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      userGrowth.push({ label, count: 0 });
      dailyDeposits.push({ label, amount: 0 });
      dailyWithdrawals.push({ label, amount: 0 });
    }

    if (!isDbConfigured) {
      totalUsers = 8;
      activeUsers = 5;
      totalDeposited = 2400.00;
      totalWithdrawn = 1100.00;
      pendingApprovals = 3;
      feed = [
        { type: 'signup', text: 'New registration request: developer_test', date: '2026-07-11T10:00:00.000Z' },
        { type: 'deposit', text: 'User developer_test submitted deposit $20.00 (Pending)', date: '2026-07-11T10:01:00.000Z' },
        { type: 'withdrawal', text: 'User tester_account requested withdrawal $50.00 (Pending)', date: '2026-07-11T10:02:00.000Z' },
        { type: 'review', text: 'User developer_test submitted review for "Amazon Product" (Pending)', date: '2026-07-11T10:03:00.000Z' }
      ];
      // Mock metrics for fallback matching
      userGrowth[4].count = 1;
      userGrowth[5].count = 3;
      userGrowth[6].count = 2;
      dailyDeposits[4].amount = 50.00;
      dailyDeposits[5].amount = 120.00;
      dailyDeposits[6].amount = 80.00;
      dailyWithdrawals[4].amount = 20.00;
      dailyWithdrawals[5].amount = 60.00;
      dailyWithdrawals[6].amount = 40.00;
    } else {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      totalUsers = count || 0;

      const { count: active } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      activeUsers = active || 0;

      const { count: pendingUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: pendingDeps } = await supabase
        .from('deposits')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending');

      const { count: pendingWiths } = await supabase
        .from('withdrawals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending');

      pendingApprovals = (pendingUsers || 0) + (pendingDeps || 0) + (pendingWiths || 0);

      const { data: approvedDeps } = await supabase
        .from('deposits')
        .select('amount')
        .eq('status', 'Approved');
      totalDeposited = (approvedDeps || []).reduce((sum, d) => sum + (parseFloat(d.amount as any) || 0), 0);

      const { data: approvedWiths } = await supabase
        .from('withdrawals')
        .select('amount')
        .eq('status', 'Approved');
      totalWithdrawn = (approvedWiths || []).reduce((sum, w) => sum + (parseFloat(w.amount as any) || 0), 0);

      // Perform real 7-day query counts
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);

      const { data: profilesList } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      (profilesList || []).forEach(p => {
        const pDate = new Date(p.created_at);
        const pLabel = pDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const entry = userGrowth.find(x => x.label === pLabel);
        if (entry) entry.count += 1;
      });

      const { data: depositsList } = await supabase
        .from('deposits')
        .select('created_at, amount')
        .eq('status', 'Approved')
        .gte('created_at', sevenDaysAgo.toISOString());

      (depositsList || []).forEach(dep => {
        const dDate = new Date(dep.created_at);
        const dLabel = dDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const entry = dailyDeposits.find(x => x.label === dLabel);
        if (entry) entry.amount += parseFloat(dep.amount as any) || 0;
      });

      const { data: withdrawalsList } = await supabase
        .from('withdrawals')
        .select('created_at, amount')
        .eq('status', 'Approved')
        .gte('created_at', sevenDaysAgo.toISOString());

      (withdrawalsList || []).forEach(w => {
        const wDate = new Date(w.created_at);
        const wLabel = wDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const entry = dailyWithdrawals.find(x => x.label === wLabel);
        if (entry) entry.amount += parseFloat(w.amount as any) || 0;
      });

      const { data: recentSignups } = await supabase
        .from('profiles')
        .select('username, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: recentDeposits } = await supabase
        .from('deposits')
        .select('amount, status, created_at, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: recentWithdrawals } = await supabase
        .from('withdrawals')
        .select('amount, status, created_at, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: recentReviews } = await supabase
        .from('review_submissions')
        .select('status, created_at, profiles(username), products(title)')
        .order('created_at', { ascending: false })
        .limit(5);

      feed = [
        ...(recentSignups || []).map((u: any) => ({
          type: 'signup',
          text: `New registration request: ${u.username}`,
          date: u.created_at
        })),
        ...(recentDeposits || []).map((d: any) => ({
          type: 'deposit',
          text: `User ${d.profiles?.username || 'Unknown'} submitted deposit $${d.amount} (${d.status})`,
          date: d.created_at
        })),
        ...(recentWithdrawals || []).map((w: any) => ({
          type: 'withdrawal',
          text: `User ${w.profiles?.username || 'Unknown'} requested withdrawal $${w.amount} (${w.status})`,
          date: w.created_at
        })),
        ...(recentReviews || []).map((r: any) => ({
          type: 'review',
          text: `User ${r.profiles?.username || 'Unknown'} submitted review for "${r.products?.title || 'Product'}" (${r.status})`,
          date: r.created_at
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    const statsResult = {
      totalUsers,
      activeUsers,
      totalDeposited,
      totalWithdrawn,
      pendingApprovals,
      activityFeed: feed.slice(0, 10),
      userGrowth,
      dailyDeposits,
      dailyWithdrawals
    };
    setCache('stats', statsResult, 300); // Cache stats for 5 minutes
    res.json(statsResult);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 2. List All Users
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, status } = req.query;

    let isRestricted = false;
    let assignedUserIds: string[] = [];

    // Query restriction flag for this admin
    const adminId = req.user?.id;
    if (adminId) {
      const { data: adminProfile } = await supabase
        .from('admins')
        .select('is_restricted')
        .eq('id', adminId)
        .maybeSingle();
      
      if (adminProfile?.is_restricted) {
        isRestricted = true;
        const { data: assignedRows } = await supabase
          .from('admin_assigned_users')
          .select('user_id')
          .eq('admin_id', adminId);
        
        assignedUserIds = (assignedRows || []).map((x: any) => x.user_id);
      }
    }

    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (status) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.ilike('username', `%${search}%`);
    }
    if (isRestricted) {
      if (assignedUserIds.length === 0) {
        return res.json([]); // No users assigned to this restricted admin
      }
      query = query.in('id', assignedUserIds);
    }

    // Apply pagination: default to limit 50 if no limit is specified to prevent loading the entire database
    let limit = 50;
    let offset = 0;
    const pageVal = parseInt(req.query.page as string);
    const limitVal = parseInt(req.query.limit as string);
    if (!isNaN(limitVal) && limitVal > 0) {
      limit = limitVal;
    }
    if (!isNaN(pageVal) && pageVal > 0) {
      offset = (pageVal - 1) * limit;
    }

    query = query.range(offset, offset + limit - 1);

    const { data: users, error } = await query;
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!users || users.length === 0) {
      return res.json([]);
    }

    // Fetch unique referrer names to avoid fetching all profiles
    const referredByCodes = users.map(u => u.referred_by).filter(Boolean);
    const referrerMap = new Map<string, string>();
    if (referredByCodes.length > 0) {
      const { data: referrers } = await supabase
        .from('profiles')
        .select('username, referral_code')
        .in('referral_code', referredByCodes);
      if (referrers) {
        referrers.forEach(p => {
          if (p.referral_code && p.username) {
            referrerMap.set(p.referral_code.trim().toUpperCase(), p.username);
          }
        });
      }
    }

    // Fetch all enrichment data in parallel
    const userIds = users.map(u => u.id);
    const [activeWorkspacesResult, allAssignmentsResult] = await Promise.all([
      supabase.from('user_assigned_products').select('user_id, platform').in('user_id', userIds),
      supabase.from('admin_assigned_users').select('user_id, admin_id, admins(username)').in('user_id', userIds)
    ]);

    const activeWorkspaces = activeWorkspacesResult.data;
    const allAssignments = allAssignmentsResult.data;

    // Balance now comes directly from profiles.balance (single source of truth)
    const balanceMap: Record<string, any> = {};
    users.forEach(u => {
      balanceMap[u.id] = { total: parseFloat(u.balance as any) || 0 };
    });

    const activePlatsMap: Record<string, Set<string>> = {};
    userIds.forEach(id => {
      activePlatsMap[id] = new Set<string>();
    });

    if (activeWorkspaces) {
      activeWorkspaces.forEach((aw: any) => {
        if (activePlatsMap[aw.user_id]) {
          activePlatsMap[aw.user_id].add(aw.platform);
        }
      });
    }

    const assignmentMap: Record<string, { id: string; username: string }> = {};
    if (allAssignments) {
      allAssignments.forEach((a: any) => {
        if (a.admins) {
          assignmentMap[a.user_id] = {
            id: a.admin_id,
            username: (a.admins as any).username
          };
        }
      });
    }

    // Attach balances & active VIPs & resolved referrer username
    const enrichedUsers = users.map(u => {
      const normalizedRef = u.referred_by ? u.referred_by.trim().toUpperCase() : '';
      // Include user's bound platform in activeVIPs (even if 0 products assigned)
      const vipSet = new Set<string>(activePlatsMap[u.id] || []);
      if (u.platform && !vipSet.has(u.platform)) {
        vipSet.add(u.platform);
      }
      return {
        ...u,
        balances: balanceMap[u.id] || { total: 0 },
        activeVIPs: Array.from(vipSet),
        referred_by_username: normalizedRef ? (referrerMap.get(normalizedRef) || u.referred_by) : null,
        assignedAdmin: assignmentMap[u.id] || null
      };
    });

    res.json(enrichedUsers);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 3. User Details Profile page (Includes plaintext password lookup)
router.get('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    // Fetch all remaining data in parallel
    const [depositsResult, withdrawalsResult, reviewsResult, ipLogsResult, comboRulesResult, chatLogsResult, progressResult] = await Promise.all([
      supabase.from('deposits').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
      supabase.from('withdrawals').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
      supabase.from('review_submissions').select('*, products(title)').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
      supabase.from('ip_logs').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('combo_checkpoints').select('*').eq('user_id', id).order('position', { ascending: true }),
      supabase.from('chat_messages').select('*').eq('user_id', id).order('created_at', { ascending: true }).limit(200),
      supabase.from('platform_balances').select('platform, reviews_count, current_position, last_reset_at, last_completed_batch_at').eq('user_id', id)
    ]);

    res.json({
      profile: user,
      balance: parseFloat(user.balance as any) || 0.00,
      balances: progressResult.data || [],
      deposits: depositsResult.data || [],
      withdrawals: withdrawalsResult.data || [],
      reviews: reviewsResult.data || [],
      ipLogs: ipLogsResult.data || [],
      comboRules: comboRulesResult.data || [],
      chatLogs: chatLogsResult.data || []
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 3a. Lightweight User Reviews lookup for VIP config tab (avoids loading massive chat histories)
router.get('/users/:id/reviews', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data: reviews, error } = await supabase
      .from('review_submissions')
      .select('product_id, platform, created_at')
      .eq('user_id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(reviews || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 3b. Delete User Account (Admin permanently removes a user profile)
router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.isRestricted) {
    return res.status(403).json({ error: 'Access Denied: Restricted operators cannot delete user accounts.' });
  }
  try {
    const { id } = req.params;

    // Delete dependent records first to avoid FK constraint violations
    await supabase.from('chat_messages').delete().eq('user_id', id);
    await supabase.from('ip_logs').delete().eq('user_id', id);
    await supabase.from('combo_checkpoints').delete().eq('user_id', id);
    await supabase.from('review_submissions').delete().eq('user_id', id);
    await supabase.from('deposits').delete().eq('user_id', id);
    await supabase.from('withdrawals').delete().eq('user_id', id);
    await supabase.from('platform_balances').delete().eq('user_id', id);

    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
      return res.status(500).json({ error: 'Failed to delete user: ' + error.message });
    }

    // Also try deleting from admins table (does nothing if it's not an admin profile ID)
    await supabase.from('admins').delete().eq('id', id);

    clearCache('stats');

    res.json({ success: true, message: 'User account and all associated data permanently deleted.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 4. Update User Account Status (Approve/Restrict User Profile)
router.put('/users/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.isRestricted) {
    return res.status(403).json({ error: 'Access Denied: Restricted operators cannot modify user accounts.' });
  }
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' | 'restricted' | 'pending'

    if (!status) {
      return res.status(400).json({ error: 'Status variable is required' });
    }

    if (status === 'rejected') {
      if (!isDbConfigured) {
        return res.json({ message: 'User successfully rejected and deleted (Sandbox Mode).' });
      }
      const { error: delErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (delErr) {
        return res.status(500).json({ error: delErr.message });
      }
      clearCache('stats');
      const adminId = req.user?.id || 'unknown-admin';
      await logAdminAction(adminId, 'REJECT_AND_DELETE_USER', id, `Rejected and deleted user account`, req);
      return res.json({ message: 'User successfully rejected and deleted.' });
    }

    if (!isDbConfigured) {
      return res.json({ message: `User status changed to ${status} (Sandbox Mode)`, user: { id, status } });
    }

    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    clearCache('stats');
    const adminId = req.user?.id || 'unknown-admin';
    await logAdminAction(adminId, 'UPDATE_USER_STATUS', id, `Changed user status to ${status}`, req);

    res.json({ message: `User status changed to ${status}`, user: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 5. Add / Subtract User Balance directly
router.put('/users/:id/balance', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.isRestricted) {
    return res.status(403).json({ error: 'Access Denied: Restricted operators cannot adjust user balances.' });
  }
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (amount === undefined) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const delta = parseFloat(amount);
    if (isNaN(delta)) {
      return res.status(400).json({ error: 'Invalid balance delta amount' });
    }

    // Fetch current balance from profiles (single source of truth)
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', id)
      .maybeSingle();

    if (profErr || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentBal = parseFloat(profile.balance as any) || 0.0;
    const finalBal = Number((currentBal + delta).toFixed(2));

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ balance: finalBal })
      .eq('id', id);

    if (updateErr) {
      return res.status(500).json({ error: 'Failed to update balance: ' + updateErr.message });
    }

    broadcastToUser(id, 'balance_update', { type: 'balance_adjustment', balance: finalBal });
    clearCache('stats');

    const adminId = req.user?.id || 'unknown-admin';
    await logAdminAction(adminId, 'UPDATE_USER_BALANCE', id, `Adjusted balance by ${amount} (New balance: ${finalBal})`, req);

    res.json({ message: 'Balance successfully updated', balance: finalBal });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 6. View All Pending Deposits
router.get('/deposits', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verify restricted admin access
    const adminId = req.user?.id;
    let isRestricted = false;
    let assignedUserIds: string[] = [];

    if (adminId) {
      const { data: adminProfile } = await supabase
        .from('admins')
        .select('is_restricted')
        .eq('id', adminId)
        .maybeSingle();

      if (adminProfile?.is_restricted) {
        isRestricted = true;
        const { data: assignedRows } = await supabase
          .from('admin_assigned_users')
          .select('user_id')
          .eq('admin_id', adminId);
        assignedUserIds = (assignedRows || []).map((x: any) => x.user_id);
      }
    }

    let query = supabase
      .from('deposits')
      .select('*, profiles(username)')
      .eq('status', 'Pending');

    if (isRestricted) {
      if (assignedUserIds.length === 0) {
        return res.json([]);
      }
      query = query.in('user_id', assignedUserIds);
    }

    // Apply optional pagination
    const pageVal = parseInt(req.query.page as string);
    const limitVal = parseInt(req.query.limit as string);
    if (!isNaN(pageVal) && !isNaN(limitVal) && pageVal > 0 && limitVal > 0) {
      const offset = (pageVal - 1) * limitVal;
      query = query.range(offset, offset + limitVal - 1);
    }

    const { data: list, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(list || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 7. Approve / Reject Deposit Request
router.put('/deposits/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Approved' | 'Rejected'

    if (status !== 'Approved' && status !== 'Rejected') {
      return res.status(400).json({ error: 'Status must be Approved or Rejected' });
    }

    // Fetch deposit details
    const { data: deposit, error: fetchError } = await supabase
      .from('deposits')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !deposit) {
      return res.status(404).json({ error: 'Deposit request not found' });
    }

    // Verify restricted admin access
    const adminId = req.user?.id;
    if (adminId) {
      const { data: adminProfile } = await supabase
        .from('admins')
        .select('is_restricted')
        .eq('id', adminId)
        .maybeSingle();
      
      if (adminProfile?.is_restricted) {
        const { count } = await supabase
          .from('admin_assigned_users')
          .select('*', { count: 'exact', head: true })
          .eq('admin_id', adminId)
          .eq('user_id', deposit.user_id);
        
        if (!count || count === 0) {
          return res.status(403).json({ error: 'Access Denied: You do not have permission to moderate transactions for this reviewer.' });
        }
      }
    }

    if (deposit.status !== 'Pending') {
      return res.status(400).json({ error: 'Deposit request already audited and processed' });
    }

    if (status === 'Approved') {
      // SINGLE SOURCE OF TRUTH: Update profiles.balance BEFORE marking deposit as approved
      const [{ data: prof }, { data: progressRow }] = await Promise.all([
        supabase.from('profiles').select('balance').eq('id', deposit.user_id).maybeSingle(),
        supabase.from('platform_balances').select('current_position').eq('user_id', deposit.user_id).eq('platform', deposit.platform).maybeSingle()
      ]);

      if (prof) {
        const currentBalance = parseFloat(prof.balance as any) || 0.0;
        const depositAmount = parseFloat(deposit.amount);
        const currentPos = progressRow?.current_position || 0;

        // Check if remark contains combo position identifier (e.g. "Combo Payment for Position 10")
        const comboRemarkMatch = (deposit.remark || '').match(/Combo Payment for Position (\d+)/i);
        const comboPosition = comboRemarkMatch ? parseInt(comboRemarkMatch[1]) : null;

        // Find the combo checkpoint for this deposit
        let checkpoint = null;
        if (comboPosition) {
          // Combo deposit: look for the specific position from the remark
          const { data: cp } = await supabase
            .from('combo_checkpoints')
            .select('trigger_balance, profit_override')
            .eq('user_id', deposit.user_id)
            .eq('platform', deposit.platform)
            .eq('position', comboPosition)
            .maybeSingle();
          checkpoint = cp;
        } else {
          // Regular deposit: check if it matches the next combo position
          const nextPosition = currentPos + 1;
          const { data: cp } = await supabase
            .from('combo_checkpoints')
            .select('trigger_balance, profit_override')
            .eq('user_id', deposit.user_id)
            .eq('platform', deposit.platform)
            .eq('position', nextPosition)
            .maybeSingle();
          checkpoint = cp;
        }

        let finalBalance = Number((currentBalance + depositAmount).toFixed(2));

        if (checkpoint) {
          // Combo deposit approved — add deposit amount + profit bonus
          const profitOverride = parseFloat(checkpoint.profit_override as any) || 0.00;
          finalBalance = Number((currentBalance + depositAmount + profitOverride).toFixed(2));
        }

        const { error: balUpdateErr } = await supabase
          .from('profiles')
          .update({ balance: finalBalance })
          .eq('id', deposit.user_id);

        if (balUpdateErr) {
          console.error('Failed to update balance on deposit approve:', balUpdateErr);
          return res.status(500).json({ error: 'Failed to credit balance: ' + balUpdateErr.message });
        }
      } else {
        console.error('Failed to fetch profile for balance update');
        return res.status(500).json({ error: 'User profile not found for balance update' });
      }

      // Set user status to active to unlock workspace
      await supabase
        .from('profiles')
        .update({ status: 'active' })
        .eq('id', deposit.user_id);
    }

    // Update deposit status AFTER balance is credited
    const { error: updateError } = await supabase
      .from('deposits')
      .update({ status })
      .eq('id', id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update status: ' + updateError.message });
    }

    // Broadcast real-time balance update to the depositing user
    broadcastToUser(deposit.user_id, 'balance_update', { type: 'deposit', status, amount: deposit.amount, platform: deposit.platform });
    broadcastToAdmins('approval_notice', { type: 'deposit', status, amount: deposit.amount, userId: deposit.user_id });
    clearCache('stats');

    const auditAdminId = req.user?.id || 'unknown-admin';
    await logAdminAction(auditAdminId, `AUDIT_DEPOSIT_${status.toUpperCase()}`, deposit.user_id, `Deposit ID ${id} of amount ${deposit.amount} on platform ${deposit.platform} was ${status}`, req);

    res.json({ message: `Deposit request successfully ${status}.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 8. View All Pending Withdrawals
router.get('/withdrawals', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verify restricted admin access
    const adminId = req.user?.id;
    let isRestricted = false;
    let assignedUserIds: string[] = [];

    if (adminId) {
      const { data: adminProfile } = await supabase
        .from('admins')
        .select('is_restricted')
        .eq('id', adminId)
        .maybeSingle();

      if (adminProfile?.is_restricted) {
        isRestricted = true;
        const { data: assignedRows } = await supabase
          .from('admin_assigned_users')
          .select('user_id')
          .eq('admin_id', adminId);
        assignedUserIds = (assignedRows || []).map((x: any) => x.user_id);
      }
    }

    let query = supabase
      .from('withdrawals')
      .select('*, profiles(username)')
      .eq('status', 'Pending');

    if (isRestricted) {
      if (assignedUserIds.length === 0) {
        return res.json([]);
      }
      query = query.in('user_id', assignedUserIds);
    }

    // Apply optional pagination
    const pageVal = parseInt(req.query.page as string);
    const limitVal = parseInt(req.query.limit as string);
    if (!isNaN(pageVal) && !isNaN(limitVal) && pageVal > 0 && limitVal > 0) {
      const offset = (pageVal - 1) * limitVal;
      query = query.range(offset, offset + limitVal - 1);
    }

    const { data: list, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(list || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 9. Approve / Reject Withdrawal Request
router.put('/withdrawals/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, platform } = req.body; // 'Approved' | 'Rejected', platform is needed for refund route

    if (status !== 'Approved' && status !== 'Rejected') {
      return res.status(400).json({ error: 'Status must be Approved or Rejected' });
    }

    const { data: wRecord, error: fetchError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !wRecord) {
      return res.status(404).json({ error: 'Withdrawal record not found' });
    }

    // Verify restricted admin access
    const adminId = req.user?.id;
    if (adminId) {
      const { data: adminProfile } = await supabase
        .from('admins')
        .select('is_restricted')
        .eq('id', adminId)
        .maybeSingle();
      
      if (adminProfile?.is_restricted) {
        const { count } = await supabase
          .from('admin_assigned_users')
          .select('*', { count: 'exact', head: true })
          .eq('admin_id', adminId)
          .eq('user_id', wRecord.user_id);
        
        if (!count || count === 0) {
          return res.status(403).json({ error: 'Access Denied: You do not have permission to moderate transactions for this reviewer.' });
        }
      }
    }

    if (wRecord.status !== 'Pending') {
      return res.status(400).json({ error: 'Withdrawal already audited and processed' });
    }

    // Deduct balance on approval (balance is held in escrow, not deducted at submission)
    if (status === 'Approved') {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', wRecord.user_id)
        .maybeSingle();

      if (profErr || !prof) {
        return res.status(500).json({ error: 'Failed to fetch user profile for balance deduction' });
      }

      const currentBal = parseFloat(prof.balance as any) || 0.0;
      const withdrawAmount = parseFloat(wRecord.amount);
      const newBal = Number((currentBal - withdrawAmount).toFixed(2));

      if (newBal < 0) {
        return res.status(400).json({ error: 'Insufficient balance for this withdrawal' });
      }

      const { error: deductErr } = await supabase
        .from('profiles')
        .update({ balance: newBal })
        .eq('id', wRecord.user_id);

      if (deductErr) {
        console.error("Balance deduction failed during withdrawal approval:", deductErr.message);
        return res.status(500).json({ error: 'Failed to deduct balance: ' + deductErr.message });
      }
    }

    // Update status in the database
    const { error: updateError } = await supabase
      .from('withdrawals')
      .update({ status })
      .eq('id', id);

    if (updateError) {
      // If approval deduction fails after status update, revert the balance
      if (status === 'Approved') {
        const { data: prof } = await supabase
          .from('profiles')
          .select('balance')
          .eq('id', wRecord.user_id)
          .maybeSingle();
        if (prof) {
          const revertBal = Number((parseFloat(prof.balance as any) + parseFloat(wRecord.amount)).toFixed(2));
          await supabase.from('profiles').update({ balance: revertBal }).eq('id', wRecord.user_id);
        }
      }
      return res.status(500).json({ error: 'Failed to update withdrawal status: ' + updateError.message });
    }

    // If approved, start the 24h cooldown
    if (status === 'Approved' && wRecord.platform) {
      await supabase
        .from('platform_balances')
        .update({ last_completed_batch_at: new Date().toISOString() })
        .eq('user_id', wRecord.user_id)
        .eq('platform', wRecord.platform);
    }

    // Broadcast real-time withdrawal status to the withdrawing user
    broadcastToUser(wRecord.user_id, 'balance_update', { type: 'withdrawal', status, amount: wRecord.amount });
    broadcastToAdmins('approval_notice', { type: 'withdrawal', status, amount: wRecord.amount, userId: wRecord.user_id });
    clearCache('stats');

    const auditAdminId = req.user?.id || 'unknown-admin';
    await logAdminAction(auditAdminId, `AUDIT_WITHDRAWAL_${status.toUpperCase()}`, wRecord.user_id, `Withdrawal ID ${id} of amount ${wRecord.amount} was ${status}`, req);

    res.json({ message: `Withdrawal successfully ${status}.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Pending reviews submissions queue and audit endpoints removed

// 12. Create / List / Edit / Delete Product Pool Campaigns
router.get('/products', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { platform, search } = req.query;

    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (platform) {
      query = query.eq('platform', platform);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data: products, error } = await query;
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(products || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/products', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.isRestricted) {
    return res.status(403).json({ error: 'Access Denied: Restricted operators cannot modify global campaigns.' });
  }
  try {
    const { title, imageUrl, price, payout, externalLink } = req.body;

    if (!title || !imageUrl || price === undefined || payout === undefined || !externalLink) {
      return res.status(400).json({ error: 'Title, Image URL, Price, Payout, and Link are required' });
    }

    const { data: newProd, error } = await supabase
      .from('products')
      .insert({
        title,
        image_url: imageUrl,
        price: parseFloat(price) || 0.00,
        payout: parseFloat(payout),
        external_link: externalLink
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const adminId = req.user?.id || 'unknown-admin';
    await logAdminAction(adminId, 'CREATE_PRODUCT', null, `Created campaign "${title}" with price ${price} and payout ${payout}`, req);

    res.status(201).json({ message: 'Product campaign successfully created', product: newProd });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.put('/products/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.isRestricted) {
    return res.status(403).json({ error: 'Access Denied: Restricted operators cannot modify global campaigns.' });
  }
  try {
    const { id } = req.params;
    const { title, imageUrl, price, payout, externalLink } = req.body;

    if (!title || !imageUrl || price === undefined || payout === undefined || !externalLink) {
      return res.status(400).json({ error: 'Title, Image URL, Price, Payout, and Link are required' });
    }

    const { data: updatedProd, error } = await supabase
      .from('products')
      .update({
        title,
        image_url: imageUrl,
        price: parseFloat(price) || 0.00,
        payout: parseFloat(payout),
        external_link: externalLink
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const adminId = req.user?.id || 'unknown-admin';
    await logAdminAction(adminId, 'EDIT_PRODUCT', null, `Updated campaign ID ${id}: "${title}" price ${price} payout ${payout}`, req);

    res.json({ message: 'Product campaign successfully updated', product: updatedProd });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/products/:id', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.isRestricted) {
    return res.status(403).json({ error: 'Access Denied: Restricted operators cannot modify global campaigns.' });
  }
  try {
    const { id } = req.params;
    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const adminId = req.user?.id || 'unknown-admin';
    await logAdminAction(adminId, 'DELETE_PRODUCT', null, `Deleted campaign ID ${id}`, req);

    res.json({ message: 'Product campaign successfully deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 13. System Configurations Settings
router.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: settings, error } = await supabase.from('system_config').select('*');
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const mapped = (settings || []).reduce((acc: any, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {});

    res.json(mapped);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.put('/settings', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.isRestricted) {
    return res.status(403).json({ error: 'Access Denied: Restricted operators cannot modify global system configurations.' });
  }
  try {
    const { settings } = req.body; // e.g. { trc20_address: '...', telegram_link: '...' }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const promises = Object.entries(settings).map(([key, val]) => {
      return supabase.from('system_config').upsert({ key, value: String(val) });
    });

    await Promise.all(promises);
    const adminId = req.user?.id || 'unknown-admin';
    await logAdminAction(adminId, 'UPDATE_SETTINGS', null, `Updated system configurations: ${JSON.stringify(settings)}`, req);
    res.json({ message: 'System configurations updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 14. Configure Combo Checkpoint Rule
router.post('/users/:id/combos', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.isRestricted) {
    // Restricted operators can only configure combos for their assigned users
    const adminId = req.user.id;
    const { count } = await supabase
      .from('admin_assigned_users')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', adminId)
      .eq('user_id', req.params.id);

    if (!count || count === 0) {
      return res.status(403).json({ error: 'Access Denied: You do not have permission to moderate combo checkpoints for this reviewer.' });
    }
  }
  try {
    const { id } = req.params;
    const { platform, position, triggerBalance, profitOverride } = req.body;

    if (!platform || !position || triggerBalance === undefined) {
      return res.status(400).json({ error: 'Platform, position, and triggerBalance are required' });
    }

    const { data, error } = await supabase
      .from('combo_checkpoints')
      .upsert({
        user_id: id,
        platform,
        position: parseInt(position),
        trigger_balance: parseFloat(triggerBalance),
        profit_override: parseFloat(profitOverride || 0.00)
      }, { onConflict: 'user_id,platform,position' })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to configure checkpoint: ' + error.message });
    }

    broadcastToUser(id, 'balance_update', { type: 'combo_update', platform });

    const adminId = req.user?.id || 'unknown-admin';
    await logAdminAction(adminId, 'SET_COMBO_RULE', id, `Set combo checkpoint rule for platform ${platform} at position ${position} with trigger balance ${triggerBalance}`, req);

    res.json({ message: 'Combo checkpoint rule successfully set.', rule: data });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 15. Delete Combo Checkpoint Rule
router.delete('/users/:id/combos/:comboId', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.isRestricted) {
    // Restricted operators can only moderate combos for their assigned users
    const adminId = req.user.id;
    const { count } = await supabase
      .from('admin_assigned_users')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', adminId)
      .eq('user_id', req.params.id);

    if (!count || count === 0) {
      return res.status(403).json({ error: 'Access Denied: You do not have permission to moderate combo checkpoints for this reviewer.' });
    }
  }
  try {
    const { comboId } = req.params;
    const { error } = await supabase
      .from('combo_checkpoints')
      .delete()
      .eq('id', comboId);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete checkpoint: ' + error.message });
    }

    const { id } = req.params;
    broadcastToUser(id, 'balance_update', { type: 'combo_update' });

    const adminId = req.user?.id || 'unknown-admin';
    await logAdminAction(adminId, 'DELETE_COMBO_RULE', id, `Deleted combo checkpoint ID ${comboId}`, req);

    res.json({ message: 'Combo checkpoint rule deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 16. Manual Reset Reviewer Progress Batch
router.post('/users/:id/reset-batch', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.isRestricted) {
    // Verify user assignment
    const adminId = req.user.id;
    const { count } = await supabase
      .from('admin_assigned_users')
      .select('*', { count: 'exact', head: true })
      .eq('admin_id', adminId)
      .eq('user_id', req.params.id);

    if (!count || count === 0) {
      return res.status(403).json({ error: 'Access Denied: You do not have permission to reset batch progress for this reviewer.' });
    }
  }
  try {
    const { id } = req.params;
    const { platform } = req.body;

    let query = supabase
      .from('platform_balances')
      .update({
        current_position: 0,
        reviews_count: 0,
        last_completed_batch_at: null,
        last_reset_at: new Date().toISOString()
      })
      .eq('user_id', id)
      .eq('platform', platform);

    const { error } = await query;
    if (error) {
      return res.status(500).json({ error: 'Failed to reset batch: ' + error.message });
    }

    // Broadcast real-time update event to connected reviewer client immediately
    broadcastToUser(id, 'balance_update', {
      type: 'vip_configured',
      platform: platform || 'Amazon'
    });

    res.json({ message: 'Review batch progress reset successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 17. Grant Direct Bonus Endpoint
router.post('/users/:id/bonus', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.isRestricted) {
    return res.status(403).json({ error: 'Access Denied: Restricted operators cannot grant bonuses.' });
  }
  try {
    const { id } = req.params;
    const { platform, amount, note } = req.body;

    if (!platform || !amount) {
      return res.status(400).json({ error: 'Platform and amount are required' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Bonus amount must be positive' });
    }

    // Validate if the user has assigned products for this platform (indicating category is unlocked)
    const { data: assignedList, error: assignedError } = await supabase
      .from('user_assigned_products')
      .select('id')
      .eq('user_id', id)
      .eq('platform', platform)
      .limit(1);

    if (assignedError) {
      return res.status(500).json({ error: 'Failed to verify platform unlock status: ' + assignedError.message });
    }

    if (!assignedList || assignedList.length === 0) {
      return res.status(400).json({ error: `Cannot grant bonus: User does not have ${platform} category unlocked.` });
    }

    // SINGLE SOURCE OF TRUTH: Update profiles.balance
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', id)
      .maybeSingle();

    if (profErr || !prof) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedBalance = Number((parseFloat(prof.balance as any) + numericAmount).toFixed(2));

    const { error: balErr } = await supabase
      .from('profiles')
      .update({ balance: updatedBalance })
      .eq('id', id);

    if (balErr) {
      return res.status(500).json({ error: 'Failed to update balance: ' + balErr.message });
    }

    await supabase.from('bonus_grants').insert({
      user_id: id,
      platform: platform,
      amount: numericAmount,
      note: note || 'Admin Granted Bonus',
      granted_at: new Date().toISOString()
    });

    broadcastToUser(id, 'balance_update', { type: 'bonus', amount: numericAmount });
    clearCache('stats');

    const auditAdminId = req.user?.id || 'unknown-admin';
    await logAdminAction(auditAdminId, 'GRANT_BONUS', id, `Granted bonus of ${numericAmount} on platform ${platform} with note: ${note || 'Admin Granted Bonus'}`, req);

    res.json({ message: 'Bonus successfully credited to user balance.', updatedBalance });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 18. Get bonus grants for a user (for admin audit report)
router.get('/users/:id/bonus-grants', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('bonus_grants')
      .select('*')
      .eq('user_id', id)
      .order('granted_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});


router.post('/scrape-amazon', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Amazon product URL is required' });
    }

    if (!url.includes('amazon.')) {
      return res.status(400).json({ error: 'Only valid Amazon product URLs are supported' });
    }

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    // Extract ASIN from URL and try clean product page URL first
    let cleanUrl = targetUrl;
    const asinMatch = targetUrl.match(/\/dp\/([A-Z0-9]{10})/i);
    if (asinMatch) {
      const asin = asinMatch[1];
      // Extract domain (amazon.com, amazon.co.uk, etc.)
      const domainMatch = targetUrl.match(/amazon\.([a-z.]+)/i);
      const domain = domainMatch ? `amazon.${domainMatch[1]}` : 'www.amazon.com';
      cleanUrl = `https://${domain}/dp/${asin}`;
    }

    let title = '';
    let imageUrl = '';
    let price = 0.00;

    try {
      // Try clean product URL first, then original URL as fallback
      let response = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        },
        redirect: 'follow'
      });

      // If clean URL failed, try original URL
      if (!response.ok && cleanUrl !== targetUrl) {
        response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
          },
          redirect: 'follow'
        });
      }

      if (response.ok) {
        const html = await response.text();

        // 1. Title — try multiple patterns in priority order
        const titlePatterns = [
          /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
          /<meta\s+name=["']title["']\s+content=["']([^"']+)["']/i,
          /<meta\s+itemprop=["']name["']\s+content=["']([^"']+)["']/i,
          /<span\s+id=["']productTitle["'][^>]*>([^<]+)<\/span>/i,
          /<title>([^<]+)<\/title>/i
        ];
        for (const pattern of titlePatterns) {
          const match = html.match(pattern);
          if (match && match[1] && match[1].trim().length > 3) {
            title = match[1]
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#039;/g, "'")
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&mdash;/g, '—')
              .replace(/&ndash;/g, '–')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;quot;/g, '"')
              .trim();
            title = title.replace(/^Amazon\.com\s*[\|:\-]\s*/i, '').replace(/\s*[\|:\-]\s*Amazon\.com$/i, '').trim();
            if (title.length >= 4 && !/^image$/i.test(title)) break;
            title = '';
          }
        }

        // 2. Image URL — try multiple patterns
        const imagePatterns = [
          /<meta\s+property=["']og:image["']\s+content=["'](https?:\/\/[^"']+)["']/i,
          /<meta\s+name=["']twitter:image["']\s+content=["'](https?:\/\/[^"']+)["']/i,
          /<meta\s+itemprop=["']image["']\s+content=["'](https?:\/\/[^"']+)["']/i,
          /"large"\s*:\s*"(https:\/\/images-na\.ssl-images-amazon\.com\/images\/I\/[^"]+)"/i,
          /"hiRes"\s*:\s*"(https:\/\/images-na\.ssl-images-amazon\.com\/images\/I\/[^"]+)"/i,
          /id=["']imgBlkFront["'][^>]*src=["'](https?:\/\/[^"']+)["']/i,
          /id=["']landingImage["'][^>]*src=["'](https?:\/\/[^"']+)["']/i,
          /src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/i,
          /src="(https:\/\/images-na\.ssl-images-amazon\.com\/images\/I\/[^"]+)"/i
        ];
        for (const pattern of imagePatterns) {
          const match = html.match(pattern);
          if (match && match[1] && match[1].startsWith('http')) {
            imageUrl = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
            // Reject non-product images
            if (!imageUrl.includes('unsplash.com') && !imageUrl.includes('placeholder') && !imageUrl.includes('fls-na.amazon')) {
              break;
            }
            imageUrl = '';
          }
        }

        // 3. Price — try many patterns including JSON-LD, meta tags, and various HTML formats
        const allPricePatterns = [
          // JSON-LD structured data (most reliable)
          /"price"\s*:\s*"?([0-9]+\.?[0-9]*)"?\s*,\s*"priceCurrency"\s*:\s*"USD"/i,
          /"priceCurrency"\s*:\s*"USD"\s*,\s*"price"\s*:\s*"?([0-9]+\.?[0-9]*)"?\s*/i,
          // a-offscreen with $ (standard Amazon price display)
          /<span\s+class=["']a-offscreen["']>\$([0-9,.]+)<\/span>/i,
          // a-price whole + fraction
          /<span\s+class=["']a-price-whole["']>([0-9,]+)<\/span>\s*<span\s+class=["']a-price-fraction["']>([0-9]+)<\/span>/i,
          // Meta tags
          /<meta\s+property=["']product:price:amount["']\s+content=["']([0-9,.]+)["']/i,
          /<meta\s+property=["']product:price:currency["']\s+content=["']USD["']/i,
          /<meta\s+itemprop=["']price["']\s+content=["']([0-9,.]+)["']/i,
          // data-a-price
          /data-a-color=["']price["'][^>]*>.*?\$([0-9,.]+)/is,
          // priceAmount in JSON
          /"priceAmount"\s*:\s*([0-9.]+)/i,
          // Any $ price in the page (last resort, look for reasonable product prices)
          /\$([0-9]{1,4}\.[0-9]{2})\b/
        ];
        for (const pattern of allPricePatterns) {
          const match = html.match(pattern);
          if (match) {
            let cleanPrice = '';
            if (match[2]) {
              // Whole + fraction pattern
              cleanPrice = match[1].replace(/[^0-9]/g, '') + '.' + match[2];
            } else {
              cleanPrice = match[1].replace(/[^0-9.]/g, '');
            }
            const parsed = parseFloat(cleanPrice);
            // Reasonable product price range: $0.01 - $9,999
            if (parsed > 0 && parsed < 10000) {
              price = parsed;
              break;
            }
          }
        }
      }
    } catch (fetchError) {
      console.warn("Scraper page fetch failure:", fetchError);
    }

    // Validate extracted data — return partial results if some fields found
    const warnings: string[] = [];
    if (!title || title.length < 4) {
      warnings.push('Title could not be extracted');
    }
    if (!imageUrl || !imageUrl.startsWith('http')) {
      warnings.push('Image could not be extracted');
    }
    if (!price || price <= 0) {
      warnings.push('Price could not be extracted — enter manually');
    }

    // If nothing was extracted at all, return error
    if (warnings.length === 3) {
      return res.status(400).json({ error: 'Amazon blocked the request or the page could not be parsed. Please enter all product details manually.' });
    }

    // Return what we have (partial success is better than nothing)
    res.json({
      title: title || '',
      imageUrl: imageUrl || '',
      price: price || 0,
      warnings: warnings.length > 0 ? warnings : undefined
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to scrape Amazon product: ' + error.message });
  }
});


// 19. Retrieve Support Chat Threads
router.get('/chats', async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.isRestricted) {
    return res.status(403).json({ error: 'Access Denied: Restricted operators cannot access support chats.' });
  }
  try {
    let isRestricted = false;
    let assignedUserIds: string[] = [];

    // Query restriction status of logged-in admin
    const adminId = req.user?.id;
    if (adminId) {
      const { data: adminProfile } = await supabase
        .from('admins')
        .select('is_restricted')
        .eq('id', adminId)
        .maybeSingle();

      if (adminProfile?.is_restricted) {
        isRestricted = true;
        const { data: assignedRows } = await supabase
          .from('admin_assigned_users')
          .select('user_id')
          .eq('admin_id', adminId);
        assignedUserIds = (assignedRows || []).map((x: any) => x.user_id);
      }
    }

    let messages = [];

    if (!isDbConfigured) {
      messages = [...mockChatMessages].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      let query = supabase
        .from('chat_messages')
        .select('*, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (isRestricted) {
        if (assignedUserIds.length === 0) {
          return res.json([]); // No user threads assigned to this restricted admin
        }
        query = query.in('user_id', assignedUserIds);
      }

      const { data, error } = await query;
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      messages = data || [];
    }

    const threads: any[] = [];
    const userSeen = new Set<string>();

    for (const msg of messages) {
      const uId = msg.user_id;
      if (!userSeen.has(uId)) {
        userSeen.add(uId);
        threads.push({
          userId: uId,
          username: msg.profiles?.username || 'user',
          text: msg.text,
          time: msg.time,
          sender: msg.sender,
          created_at: msg.created_at,
          assignedAdmin: null // will populate below
        });
      }
    }

    // Fetch assignments for these active thread users only
    const activeUserIds = Array.from(userSeen);
    if (activeUserIds.length > 0) {
      const { data: allAssignments } = await supabase
        .from('admin_assigned_users')
        .select('user_id, admin_id, admins(username)')
        .in('user_id', activeUserIds);

      const assignmentMap: Record<string, { id: string; username: string }> = {};
      if (allAssignments) {
        allAssignments.forEach((a: any) => {
          if (a.admins) {
            assignmentMap[a.user_id] = {
              id: a.admin_id,
              username: (a.admins as any).username
            };
          }
        });
      }

      threads.forEach(t => {
        t.assignedAdmin = assignmentMap[t.userId] || null;
      });
    }

    res.json(threads);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 20. Fetch Support Chat Logs history for specific user thread
router.get('/chats/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;

    // Verify restricted admin access
    const adminId = req.user?.id;
    if (adminId) {
      const { data: adminProfile } = await supabase
        .from('admins')
        .select('is_restricted')
        .eq('id', adminId)
        .maybeSingle();
      
      if (adminProfile?.is_restricted) {
        const { count } = await supabase
          .from('admin_assigned_users')
          .select('*', { count: 'exact', head: true })
          .eq('admin_id', adminId)
          .eq('user_id', userId);
        
        if (!count || count === 0) {
          return res.status(403).json({ error: 'Access Denied: You do not have permission to access support threads for this customer.' });
        }
      }
    }

    let messages = [];

    if (!isDbConfigured) {
      messages = mockChatMessages.filter(m => m.user_id === userId);
    } else {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) {
        return res.status(500).json({ error: error.message });
      }
      messages = data || [];
    }

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 21. Send Support message reply to user thread
router.post('/chats/:userId/send', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { text, time } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // Verify restricted admin access
    const adminId = req.user?.id;
    if (adminId) {
      const { data: adminProfile } = await supabase
        .from('admins')
        .select('is_restricted')
        .eq('id', adminId)
        .maybeSingle();
      
      if (adminProfile?.is_restricted) {
        const { count } = await supabase
          .from('admin_assigned_users')
          .select('*', { count: 'exact', head: true })
          .eq('admin_id', adminId)
          .eq('user_id', userId);
        
        if (!count || count === 0) {
          return res.status(403).json({ error: 'Access Denied: You do not have permission to access support threads for this customer.' });
        }
      }
    }

    const timeVal = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!isDbConfigured) {
      const adminMsg = {
        id: `msg-admin-${Date.now()}`,
        user_id: userId,
        sender: 'admin' as const,
        text: text.trim(),
        time: timeVal,
        created_at: new Date().toISOString()
      };
      mockChatMessages.push(adminMsg);
      broadcastToUser(userId, 'new_chat_message', { sender: 'admin', text: adminMsg.text, time: adminMsg.time });
      return res.json(adminMsg);
    }

    const { data: adminMsg, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        sender: 'admin',
        text: text.trim(),
        time: timeVal
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    broadcastToUser(userId, 'new_chat_message', { sender: 'admin', text: adminMsg.text, time: adminMsg.time });
    res.json(adminMsg);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 22. Get User VIP Configuration (assigned products & checkpoints)
router.get('/users/:id/vip', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch all assigned products and checkpoints in parallel
    const [apResult, cpResult] = await Promise.all([
      supabase
        .from('user_assigned_products')
        .select('product_id, platform')
        .eq('user_id', id),
      supabase
        .from('combo_checkpoints')
        .select('id, platform, position, trigger_balance, profit_override')
        .eq('user_id', id)
        .order('position', { ascending: true })
    ]);

    const assignedProducts = apResult.data || [];
    const checkpoints = cpResult.data || [];

    // Group by platform
    const result: Record<string, { productIds: string[], combos: any[] }> = {
      Amazon: { productIds: [], combos: [] },
      Alibaba: { productIds: [], combos: [] },
      Shopify: { productIds: [], combos: [] }
    };

    if (assignedProducts) {
      assignedProducts.forEach((ap: any) => {
        if (result[ap.platform]) {
          result[ap.platform].productIds.push(ap.product_id);
        }
      });
    }

    if (checkpoints) {
      checkpoints.forEach((cp: any) => {
        if (result[cp.platform]) {
          result[cp.platform].combos.push({
            id: cp.id,
            position: cp.position,
            amount: parseFloat(cp.trigger_balance as any),
            profit: parseFloat(cp.profit_override as any) || 0.00
          });
        }
      });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 23. Save User VIP Platform Configuration
router.post('/users/:id/vip', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { platform, productIds, combos, resetProgress } = req.body;

    if (!platform || !Array.isArray(productIds)) {
      return res.status(400).json({ error: 'Platform and productIds array are required' });
    }

    // Enforce max 25 products per batch
    if (productIds.length > 25) {
      return res.status(400).json({ error: 'Maximum 25 products can be assigned per batch.' });
    }

    // If resetProgress is requested, check if user is first-time (never withdrawn)
    // First-time users MUST complete a withdrawal before new orders can be assigned
    if (resetProgress) {
      const { data: withdrawals } = await supabase
        .from('withdrawals')
        .select('id')
        .eq('user_id', id)
        .eq('status', 'Approved')
        .limit(1);

      if (!withdrawals || withdrawals.length === 0) {
        // First-time user — check if they have any completed reviews at all
        const { data: balance } = await supabase
          .from('platform_balances')
          .select('reviews_count')
          .eq('user_id', id)
          .eq('platform', platform)
          .maybeSingle();

        if (balance && (balance.reviews_count || 0) >= 25) {
          return res.status(400).json({
            error: 'This user must complete their first withdrawal before new orders can be assigned.',
            requiresWithdrawal: true
          });
        }
      }
    }

    // 1. Clear existing assigned products for this user & platform
    const { error: delApErr } = await supabase
      .from('user_assigned_products')
      .delete()
      .eq('user_id', id)
      .eq('platform', platform);

    if (delApErr) {
      return res.status(500).json({ error: 'Failed to clear assigned products: ' + delApErr.message });
    }

    // 2. Insert new assigned products
    if (productIds.length > 0) {
      const inserts = productIds.map(pId => ({
        user_id: id,
        product_id: pId,
        platform
      }));
      const { error: insApErr } = await supabase
        .from('user_assigned_products')
        .insert(inserts);

      if (insApErr) {
        return res.status(500).json({ error: 'Failed to save assigned products: ' + insApErr.message });
      }
    }

    // 3. Clear existing combo checkpoints for this user & platform
    const { error: delCpErr } = await supabase
      .from('combo_checkpoints')
      .delete()
      .eq('user_id', id)
      .eq('platform', platform);

    if (delCpErr) {
      return res.status(500).json({ error: 'Failed to clear checkpoints: ' + delCpErr.message });
    }

    // 4. Insert new combo checkpoints
    if (Array.isArray(combos) && combos.length > 0) {
      const inserts = combos.map((c: any) => ({
        user_id: id,
        platform,
        position: parseInt(c.position),
        trigger_balance: parseFloat(c.amount),
        profit_override: parseFloat(c.profit ?? c.profitOverride ?? 0.00)
      }));
      const { error: insCpErr } = await supabase
        .from('combo_checkpoints')
        .insert(inserts);

      if (insCpErr) {
        return res.status(500).json({ error: 'Failed to save checkpoints: ' + insCpErr.message });
      }
    }

    // 5. Reset user progress if requested (new batch assignment)
    if (resetProgress) {
      await supabase
        .from('platform_balances')
        .update({
          current_position: 0,
          reviews_count: 0,
          last_reset_at: new Date().toISOString(),
          last_completed_batch_at: null
        })
        .eq('user_id', id)
        .eq('platform', platform);
    }

    // Update user profile bound platform if null
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('platform')
      .eq('id', id)
      .single();

    if (userProfile) {
      await supabase
        .from('profiles')
        .update({ platform })
        .eq('id', id);
    }

    // Send WebSocket notification to user that new orders are assigned
    broadcastToUser(id, 'balance_update', { type: 'new_orders_assigned', platform, productCount: productIds.length });
    broadcastToUser(id, 'balance_update', { type: 'vip_unlocked', platform, productCount: productIds.length });

    res.json({ success: true, message: `VIP ${platform} configuration successfully saved.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 24. Lock/Remove User VIP Platform Configuration (Delete assignments, checkpoints, and unbind platform)
router.delete('/users/:id/vip/:platform', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, platform } = req.params;

    // Delete assigned products
    await supabase.from('user_assigned_products').delete().eq('user_id', id).eq('platform', platform);
    // Delete combo checkpoints
    await supabase.from('combo_checkpoints').delete().eq('user_id', id).eq('platform', platform);

    // Clear profile.platform so user panel shows workspace as locked
    await supabase.from('profiles').update({ platform: null }).eq('id', id);

    // NOTE: Do NOT touch platform_balances at all — balance, position, reviews are untouched
    // Locking a workspace only removes products and checkpoints

    broadcastToUser(id, 'balance_update', { type: 'vip_locked', platform });

    res.json({ success: true, message: `VIP ${platform} workspace locked.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
