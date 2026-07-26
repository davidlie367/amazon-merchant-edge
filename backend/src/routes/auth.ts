import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import axios from 'axios';
import { supabase } from '../config/supabase.js';
import { authenticateToken, AuthenticatedRequest, requireSuperAdmin } from '../middlewares/auth.js';
import { clearCache } from '../services/cacheService.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce_Vine_secret_hash_2026_secured';

// Helper function to resolve geolocation details from a client IP
async function resolveLocation(ip: string) {
  const normalizedIp = (ip || '').trim();
  if (!normalizedIp || normalizedIp === '127.0.0.1' || normalizedIp === 'localhost' || normalizedIp === '::1' || normalizedIp === '::ffff:127.0.0.1') {
    return { country: 'Unknown', city: 'Unknown' };
  }

  try {
    const geoRes = await axios.get(`http://ip-api.com/json/${normalizedIp}`, { timeout: 3000 });
    if (geoRes.data && geoRes.data.status === 'success') {
      return {
        country: geoRes.data.country || 'Unknown',
        city: geoRes.data.city || 'Unknown'
      };
    }
  } catch (e) {
    console.warn('Geo IP lookup failed:', e);
  }

  return { country: 'Unknown', city: 'Unknown' };
}

// Helper function to log geolocation audit trails in background
async function logUserIp(userId: string, ip: string) {
  if (!userId || userId.includes('dev-uuid')) return;

  const { country, city } = await resolveLocation(ip);

  try {
    // 1. Log to history list
    await supabase.from('ip_logs').insert({
      user_id: userId,
      ip_address: ip,
      city,
      country
    });
    // 2. Set current IP on user profile
    await supabase.from('profiles').update({
      ip_address: ip,
      country,
      city
    }).eq('id', userId);
  } catch (err) {
    console.error('Failed to write IP audit log:', err);
  }
}

// 1. Register Endpoint
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, withdrawalPassword, referredBy } = req.body;
    const normalizedReferralCode = String(referredBy || '').trim().toUpperCase();

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Login Password must be at least 8 characters.' });
    }

    if (!withdrawalPassword) {
      return res.status(400).json({ error: 'Withdrawal PIN is required.' });
    }

    if (!/^\d{4}$/.test(withdrawalPassword)) {
      return res.status(400).json({ error: 'Withdrawal PIN must be exactly 4 digits.' });
    }

    let referrerCodeToSave = null;
    if (normalizedReferralCode) {
      const { data: referrer, error: referralError } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', normalizedReferralCode)
        .maybeSingle();

      if (referralError || !referrer) {
        return res.status(400).json({ error: 'Invalid referral code' });
      }
      referrerCodeToSave = normalizedReferralCode;
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.trim())
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    if (email && email.trim() !== '') {
      const { data: existingEmail } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim())
        .maybeSingle();

      if (existingEmail) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Resolve client IP & geo location info
    let clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    if (clientIp.includes(',')) {
      clientIp = clientIp.split(',')[0].trim();
    }
    if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
      clientIp = '127.0.0.1';
    }

    const { country, city } = await resolveLocation(clientIp);

    // Generate referral code
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // All new registrations are always regular users, pending admin approval
    // Admin accounts must be created directly in the Supabase database
    const finalPassword = password;
    const finalStatus = 'pending';

    // Insert user profile
    let newUser: any;
    let insertError: any;

    const insertResult = await supabase
      .from('profiles')
      .insert({
        username: username.trim(),
        email: email ? email.trim() : null,
        password: finalPassword,
        withdrawal_password: withdrawalPassword || null,
        country,
        city,
        ip_address: clientIp,
        status: finalStatus,
        referral_code: referralCode,
        referred_by: referrerCodeToSave
      })
      .select()
      .single();

    newUser = insertResult.data;
    insertError = insertResult.error;

    if (insertError && (insertError.message?.includes('column') || insertError.code === '42703')) {
      console.warn("Retrying registration insert without email and withdrawal_password columns due to missing DB columns...");
      const fallbackResult = await supabase
        .from('profiles')
        .insert({
          username: username.trim(),
          password: finalPassword,
          country,
          city,
          ip_address: clientIp,
          status: finalStatus,
          referral_code: referralCode,
          referred_by: referrerCodeToSave
        })
        .select()
        .single();
      newUser = fallbackResult.data;
      insertError = fallbackResult.error;
    }

    if (insertError || !newUser) {
      return res.status(500).json({ error: 'Failed to create profile: ' + insertError?.message });
    }

    clearCache('stats');

    // Broadcast to connected admins: new registration
    try {
      const { broadcastToAdmins } = await import('../services/wsService.js');
      broadcastToAdmins('new_order', { type: 'signup', username: username.trim(), amount: '0' });
    } catch (wsErr) {
      console.warn('WebSocket registration alert dispatch error:', wsErr);
    }

    // Create platform progress rows (3 platforms — reviews system queries by platform name)
    const platformRows = [
      { user_id: newUser.id, platform: 'Amazon', wallet_balance: 0.00, reviews_count: 0, current_position: 0 },
      { user_id: newUser.id, platform: 'Alibaba', wallet_balance: 0.00, reviews_count: 0, current_position: 0 },
      { user_id: newUser.id, platform: 'Shopify', wallet_balance: 0.00, reviews_count: 0, current_position: 0 }
    ];
    const { error: progressError } = await supabase
      .from('platform_balances')
      .insert(platformRows);

    if (progressError) {
      console.error('Failed to create platform rows:', progressError);
    }

    // Capture and log initial IP configuration
    logUserIp(newUser.id, clientIp).catch(err => console.error("Async IP registration log error:", err));

    res.status(201).json({
      message: 'Account successfully registered and queued for approval.',
      status: newUser.status,
      username: newUser.username
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 2. Login Endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Verify Supabase database credentials exist before querying
    const isDbConfigured = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('your-project-id') &&
                           process.env.SUPABASE_KEY && !process.env.SUPABASE_KEY.includes('your-supabase-anon-key');

    if (!isDbConfigured) {
      return res.status(503).json({ error: 'Database not configured. Please contact the system administrator.' });
    }

    // Fetch user details from Supabase database
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username.trim())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check role constraint: user login must NOT login as admin or super_admin
    if (user.role === 'admin' || user.role === 'super_admin') {
      return res.status(403).json({ error: 'Administrative accounts must login through the administrative terminal.' });
    }

    // Verify password — plaintext comparison for all roles
    const isPasswordMatch = password === user.password;

    if (!isPasswordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.status === 'restricted') {
      return res.status(403).json({ error: 'Account has been restricted. Please contact customer service.' });
    }

    // Sign session JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Capture requester IP address and trigger audit logging
    let clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    if (clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim();
    if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') clientIp = '127.0.0.1';

    logUserIp(user.id, clientIp).catch(err => console.error("Async login IP log error:", err));

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: 'user',
        status: user.status,
        referralCode: user.referral_code,
        profile_photo: user.profile_photo || null
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 3. User Details Endpoint
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // Fetch profile from database
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'Active reviewer profile not found.' });
    }

    // Fetch review progress for user's active platform
    const userPlatform = profile.platform || 'Amazon';
    const { data: progressRow } = await supabase
      .from('platform_balances')
      .select('reviews_count, current_position, last_reset_at')
      .eq('user_id', userId)
      .eq('platform', userPlatform)
      .maybeSingle();

    const checkpoints = (await supabase
      .from('combo_checkpoints').select('*').eq('user_id', userId).eq('platform', userPlatform).order('position', { ascending: true })).data || [];

    const batchStart = progressRow?.last_reset_at ? new Date(progressRow.last_reset_at).toISOString() : new Date(0).toISOString();
    const { count: completedCount } = await supabase
      .from('review_submissions').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('platform', userPlatform).eq('status', 'Completed').gte('created_at', batchStart);

    const count = completedCount || 0;

    // SINGLE SOURCE OF TRUTH: profile.balance
    const walletBalance = parseFloat(profile.balance as any) || 0.00;

    const formattedBalances: any = {
      Amazon: { walletBalance: 0.00, completedReviewsCount: 0, lastResetAt: null, isComboBlocked: false, comboDetails: null },
      Alibaba: { walletBalance: 0.00, completedReviewsCount: 0, lastResetAt: null, isComboBlocked: false, comboDetails: null },
      Shopify: { walletBalance: 0.00, completedReviewsCount: 0, lastResetAt: null, isComboBlocked: false, comboDetails: null }
    };

    {
      const nextPos = count + 1;
      // Sync progress if out of date
      if (progressRow && count !== (progressRow.current_position || 0)) {
        Promise.resolve(supabase.from('platform_balances').update({ current_position: count, reviews_count: count }).eq('user_id', userId).eq('platform', profile.platform || 'Amazon')).catch(() => {});
      }

      const cp = checkpoints.find((c: any) => c.position === nextPos) || null;
      let isCleared = false;
      if (cp) {
        // Get all combo checkpoints at or before nextPos
        const { data: requiredCheckpoints } = await supabase.from('combo_checkpoints').select('position').eq('user_id', userId).eq('platform', userPlatform).lte('position', nextPos);
        const requiredPositions = (requiredCheckpoints || []).map((c: any) => c.position);

        // For each required position, check if there's an approved deposit with matching combo remark
        let clearedCount = 0;
        for (const pos of requiredPositions) {
          const { count } = await supabase.from('deposits').select('id', { count: 'exact', head: true })
            .eq('user_id', userId).eq('platform', userPlatform).eq('status', 'Approved')
            .ilike('remark', `%Combo Payment for Position ${pos}%`);
          if (count && count > 0) clearedCount++;
        }

        isCleared = clearedCount >= requiredPositions.length;
      }

      const universalBalance = {
        walletBalance,
        completedReviewsCount: count,
        lastResetAt: progressRow?.last_reset_at || null,
        isComboBlocked: !!(cp && !isCleared),
        comboDetails: cp ? { position: nextPos, triggerBalance: parseFloat(cp.trigger_balance as any) || 0, profitAmount: parseFloat(cp.profit_override as any) || 0, isCleared } : null
      };
      formattedBalances.Amazon = universalBalance;
      formattedBalances.Alibaba = universalBalance;
      formattedBalances.Shopify = universalBalance;
    }

    // Fetch global system config (deposit addresses, links, notification banner text)
    const { data: configRows } = await supabase
      .from('system_config')
      .select('key, value');

    const configMap: any = {};
    if (configRows) {
      configRows.forEach((row: any) => {
        configMap[row.key] = row.value;
      });
    }

    // Query which platforms are manually unlocked (have assigned products) for this user
    let unlockedPlatforms: string[] = [];
    try {
      const { data: assigned } = await supabase
        .from('user_assigned_products')
        .select('platform')
        .eq('user_id', userId);
      if (assigned) {
        unlockedPlatforms = Array.from(new Set(assigned.map((a: any) => a.platform)));
      }
    } catch (e) {
      console.warn("Could not query unlockedPlatforms for /me:", e);
    }

    // Determine and persist bound platform
    let boundPlatform = profile.platform || null;
    if (!boundPlatform && unlockedPlatforms.length > 0) {
      boundPlatform = unlockedPlatforms[0];
      try {
        await supabase
          .from('profiles')
          .update({ platform: boundPlatform })
          .eq('id', userId);
      } catch (saveErr) {
        console.warn("Failed to auto-bind platform profile:", saveErr);
      }
    }

    // Keep workspace active if user has a bound platform, even if no products are assigned
    // This allows admin to reset batch (delete products) and re-assign new ones
    if (boundPlatform && !unlockedPlatforms.includes(boundPlatform)) {
      unlockedPlatforms.push(boundPlatform);
    }

    res.json({
      id: profile.id,
      username: profile.username,
      email: profile.email || null,
      phone: profile.phone || null,
      role: 'user',
      status: profile.status,
      country: profile.country,
      city: profile.city,
      referralCode: profile.referral_code,
      referredBy: profile.referred_by,
      balances: formattedBalances,
      systemConfig: configMap,
      platform: boundPlatform,
      boundUsdtAddress: profile.bound_usdt_address || null,
      withdrawalPassword: profile.withdrawal_password || null,
      profile_photo: profile.profile_photo || null,
      unlockedPlatforms: unlockedPlatforms
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 4. USDT Bind Endpoint
router.put('/bind-usdt', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { address } = req.body;

    if (!address || address.trim() === '') {
      return res.status(400).json({ error: 'Address is required' });
    }

    // 1. Fetch current profile to verify lock constraint
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('bound_usdt_address')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (profile.bound_usdt_address && profile.bound_usdt_address.trim() !== '') {
      return res.status(400).json({ error: 'USDT Address is already bound and locked.' });
    }

    // 2. Perform bind update
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ bound_usdt_address: address.trim() })
      .eq('id', userId);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to bind address: ' + updateError.message });
    }

    res.json({ success: true, message: 'USDT Withdrawal Address successfully bound and locked.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 4.5. Update Profile Photo Endpoint
router.put('/update-profile-photo', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { profile_photo } = req.body; // base64 string or null

    if (profile_photo && profile_photo.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image size is too large. Base64 profile photo must be under 1.5MB.' });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ profile_photo: profile_photo || null })
      .eq('id', userId);

    if (error) {
      return res.status(500).json({ error: 'Failed to update profile photo in database: ' + error.message });
    }

    res.json({ success: true, message: 'Profile photo successfully updated.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 4.6. Update Profile Details Endpoint
router.put('/update-profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { email, phone } = req.body;

    const updates: any = {};
    if (email !== undefined) updates.email = (email || '').trim();
    if (phone !== undefined) updates.phone = (phone || '').trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      return res.status(500).json({ error: 'Failed to update profile details: ' + error.message });
    }

    res.json({ success: true, message: 'Profile details successfully updated.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ==========================================
// 5. Admin Panel Separate Auth endpoints
// ==========================================

// Admin Registration Flow (request sent to super_admin as pending)
router.post('/admin/register', async (req: Request, res: Response) => {
  try {
    const { username, password, full_name, email, phone } = req.body;
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Full name, username and password are required' });
    }

    // Resolve client IP
    let clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    if (clientIp.includes(',')) clientIp = clientIp.split(',')[0].trim();
    if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') clientIp = '127.0.0.1';

    // Check if username already exists in admins or profiles
    let existingUser: any;
    const checkAdmins = await supabase
      .from('admins')
      .select('id')
      .eq('username', username.trim())
      .maybeSingle();

    if (checkAdmins.error && (checkAdmins.error.code === '42P01' || checkAdmins.error.code === 'PGRST205' || checkAdmins.error.message?.includes('does not exist') || checkAdmins.error.message?.includes('schema cache'))) {
      const checkProfiles = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim())
        .eq('role', 'admin')
        .maybeSingle();
      existingUser = checkProfiles.data;
    } else {
      existingUser = checkAdmins.data;
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create the admin profile in pending state (no automatic bypass)
    let newAdmin: any;
    let insertError: any;

    const insertResult = await supabase
      .from('admins')
      .insert({
        username: username.trim(),
        full_name: full_name.trim(),
        email: email ? email.trim() : null,
        phone: phone ? phone.trim() : null,
        password: password, // plaintext
        ip_address: clientIp,
        status: 'pending'
      })
      .select()
      .single();

    newAdmin = insertResult.data;
    insertError = insertResult.error;


    if (insertError || !newAdmin) {
      return res.status(500).json({ error: 'Failed to request admin registration: ' + insertError?.message });
    }

    res.status(201).json({
      message: 'Admin registration request successfully submitted. Awaiting Super Admin authorization.',
      username: newAdmin.username
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Admin Login Endpoint (must be status=active)
router.post('/admin/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    let user: any;
    let error: any;

    const selectResult = await supabase
      .from('admins')
      .select('*')
      .eq('username', username.trim())
      .single();

    user = selectResult.data;
    error = selectResult.error;


    if (error || !user) {
      return res.status(401).json({ error: 'Invalid admin username or password' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ error: 'Your admin account is pending Super Admin approval.' });
    }

    if (user.status === 'restricted') {
      return res.status(403).json({ error: 'Your admin account has been suspended. Contact the Super Admin.' });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'Your admin registration was rejected. Contact the Super Admin.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Admin account is not active.' });
    }

    if (password !== user.password) {
      return res.status(401).json({ error: 'Invalid admin username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: 'admin', isRestricted: !!user.is_restricted },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: 'admin',
        status: user.status,
        isRestricted: !!user.is_restricted
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ==========================================
// 7. Super Admin Auth & Control endpoints
// ==========================================

// Super Admin Login
router.post('/super/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: superAdmin, error } = await supabase
      .from('super_admin')
      .select('*')
      .eq('email', email.trim())
      .single();

    if (error || !superAdmin) {
      return res.status(401).json({ error: 'Invalid super admin credentials' });
    }

    if (password !== superAdmin.password) {
      return res.status(401).json({ error: 'Invalid super admin credentials' });
    }

    const token = jwt.sign(
      { id: superAdmin.id, username: superAdmin.email, role: 'super_admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: superAdmin.id,
        username: superAdmin.email,
        role: 'super_admin'
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get all admin accounts
router.get('/super/admins', authenticateToken, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let admins: any;
    let error: any;

    const selectResult = await supabase
      .from('admins')
      .select('id, username, full_name, email, phone, status, created_at, ip_address, password, is_restricted')
      .order('created_at', { ascending: false });

    admins = selectResult.data;
    error = selectResult.error;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch admin accounts: ' + error.message });
    }

    res.json(admins || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Approve admin account
router.post('/super/admins/:id/approve', authenticateToken, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    let { error } = await supabase
      .from('admins')
      .update({ status: 'active' })
      .eq('id', id);


    if (error) {
      return res.status(500).json({ error: 'Failed to approve admin account: ' + error.message });
    }

    res.json({ success: true, message: 'Admin account approved successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Reject admin account (sets status to rejected, keeps record)
router.post('/super/admins/:id/reject', authenticateToken, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    let { error } = await supabase
      .from('admins')
      .update({ status: 'rejected' })
      .eq('id', id);


    if (error) {
      return res.status(500).json({ error: 'Failed to reject admin account: ' + error.message });
    }

    res.json({ success: true, message: 'Admin account rejected.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Block admin account (suspend an active admin)
router.post('/super/admins/:id/block', authenticateToken, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    let { error } = await supabase
      .from('admins')
      .update({ status: 'restricted' })
      .eq('id', id);


    if (error) {
      return res.status(500).json({ error: 'Failed to block admin account: ' + error.message });
    }

    res.json({ success: true, message: 'Admin account has been suspended.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Unblock/restore admin account
router.post('/super/admins/:id/unblock', authenticateToken, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    let { error } = await supabase
      .from('admins')
      .update({ status: 'active' })
      .eq('id', id);


    if (error) {
      return res.status(500).json({ error: 'Failed to restore admin account: ' + error.message });
    }

    res.json({ success: true, message: 'Admin account restored to active.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete admin account permanently
router.delete('/super/admins/:id', authenticateToken, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    let { error } = await supabase
      .from('admins')
      .delete()
      .eq('id', id);


    if (error) {
      return res.status(500).json({ error: 'Failed to delete admin account: ' + error.message });
    }

    res.json({ success: true, message: 'Admin account deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Reset admin password
router.post('/super/admins/:id/reset-password', authenticateToken, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.trim() === '') {
      return res.status(400).json({ error: 'New password is required' });
    }

    let { error } = await supabase
      .from('admins')
      .update({ password: password.trim() })
      .eq('id', id);


    if (error) {
      return res.status(500).json({ error: 'Failed to reset password: ' + error.message });
    }

    res.json({ success: true, message: 'Admin password reset successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 14. Update admin restriction status
router.post('/super/admins/:id/restrict', authenticateToken, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isRestricted } = req.body;
    const { error } = await supabase
      .from('admins')
      .update({ is_restricted: !!isRestricted })
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to update admin restriction status: ' + error.message });
    }
    res.json({ success: true, message: 'Admin restriction status updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 15. Fetch all users for assignments
router.get('/super/users', authenticateToken, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, email')
      .order('username', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch users: ' + error.message });
    }
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 16. Get current user assignments for restricted admin
router.get('/super/admins/:id/assignments', authenticateToken, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('admin_assigned_users')
      .select('user_id')
      .eq('admin_id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch assignments: ' + error.message });
    }
    res.json((data || []).map((x: any) => x.user_id));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 17. Save user assignments for restricted admin
router.post('/super/admins/:id/assignments', authenticateToken, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: 'userIds must be an array of user IDs' });
    }

    // Delete existing assignments for this admin
    const { error: deleteError } = await supabase
      .from('admin_assigned_users')
      .delete()
      .eq('admin_id', id);

    if (deleteError) {
      return res.status(500).json({ error: 'Failed to clear existing assignments: ' + deleteError.message });
    }

    if (userIds.length > 0) {
      const insertRows = userIds.map((uId: string) => ({
        admin_id: id,
        user_id: uId
      }));

      const { error: insertError } = await supabase
        .from('admin_assigned_users')
        .insert(insertRows);

      if (insertError) {
        return res.status(500).json({ error: 'Failed to save new assignments: ' + insertError.message });
      }
    }

    res.json({ success: true, message: 'User assignments saved successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Change super admin password
router.post('/super/password', authenticateToken, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password are required' });
    }

    // Fetch current super admin record
    const { data: superAdmin, error: fetchError } = await supabase
      .from('super_admin')
      .select('*')
      .limit(1)
      .single();

    if (fetchError || !superAdmin) {
      return res.status(500).json({ error: 'Could not find super admin record' });
    }

    if (currentPassword !== superAdmin.password) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const { error: updateError } = await supabase
      .from('super_admin')
      .update({ password: newPassword })
      .eq('id', superAdmin.id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update password: ' + updateError.message });
    }

    res.json({ success: true, message: 'Super admin password updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
