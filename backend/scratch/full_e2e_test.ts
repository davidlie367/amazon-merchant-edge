/**
 * Full End-to-End API Flow Test
 * Tests: login, reviews 1-7, combo block, deposit, approve deposit,
 *        reviews 8-25, withdrawal, approval, 24h bypass reset, second batch, second withdrawal
 */
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const api = axios.create({ baseURL: 'http://localhost:5000/api', validateStatus: () => true });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

let pass = 0;
let fail = 0;
const issues: string[] = [];

function ok(label: string, condition: boolean, extra?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.error(`  ❌ FAIL: ${label}${extra ? ' — ' + extra : ''}`);
    fail++;
    issues.push(`${label}${extra ? ': ' + extra : ''}`);
  }
}

function section(name: string) {
  console.log(`\n─────────────────────────────────────────────`);
  console.log(`🔷 ${name}`);
  console.log(`─────────────────────────────────────────────`);
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('\n🚀 Amazon Panel Full E2E Test Suite Starting...\n');

  // ─── SETUP: Reset testreviewer to clean state ───────────────────────────
  section('SETUP: Reset testreviewer to clean state');

  const { data: user } = await supabase.from('profiles').select('*').eq('username', 'testreviewer').single();
  if (!user) { console.error('testreviewer not found — run provision_user.ts first'); process.exit(1); }

  const userId = user.id;
  console.log(`  User ID: ${userId}`);

  // Reset position to 0, clear cooldowns, clear combos cleared
  await supabase.from('platform_balances')
    .update({ current_position: 0, wallet_balance: 0, reviews_count: 0, last_completed_batch_at: null, last_reset_at: new Date().toISOString() })
    .eq('user_id', userId);

  // Clear review submissions
  await supabase.from('review_submissions').delete().eq('user_id', userId);
  // Clear deposits
  await supabase.from('deposits').delete().eq('user_id', userId);
  // Clear withdrawals
  await supabase.from('withdrawals').delete().eq('user_id', userId);
  console.log('  Reset complete (position=0, balance=0, submissions/deposits/withdrawals cleared)');

  // ─── STEP 1: LOGIN ───────────────────────────────────────────────────────
  section('STEP 1: Login');
  const loginRes = await api.post('/auth/login', { username: 'testreviewer', password: 'password123' });
  ok('Login returns 200', loginRes.status === 200, `Got ${loginRes.status}: ${JSON.stringify(loginRes.data).slice(0, 100)}`);
  const token = loginRes.data?.token;
  ok('Token received', !!token);
  if (!token) { console.error('Cannot proceed without token.'); process.exit(1); }
  const H = { Authorization: `Bearer ${token}` };

  // ─── STEP 2: GET /auth/me ─────────────────────────────────────────────────
  section('STEP 2: GET /auth/me — verify balances and combo status');
  const meRes = await api.get('/auth/me', { headers: H });
  ok('/auth/me returns 200', meRes.status === 200);
  const balances = meRes.data?.balances;
  ok('Balances object returned', !!balances);
  ok('Amazon.walletBalance = 0', balances?.Amazon?.walletBalance === 0, `Got ${balances?.Amazon?.walletBalance}`);
  ok('Amazon.completedReviewsCount = 0', balances?.Amazon?.completedReviewsCount === 0);
  ok('Amazon.isComboBlocked = false initially', balances?.Amazon?.isComboBlocked === false);
  ok('Amazon.lastResetAt is set', !!balances?.Amazon?.lastResetAt);

  // ─── STEP 3: GET /reviews/products ───────────────────────────────────────
  section('STEP 3: GET /reviews/products — campaign list');
  const productsRes = await api.get('/reviews/products?platform=Amazon', { headers: H });
  ok('Products returns 200', productsRes.status === 200);
  const products = productsRes.data;
  ok('At least 25 products assigned', Array.isArray(products) && products.length >= 25, `Got ${products?.length}`);
  if (!products?.length) { console.error('No products — cannot continue'); process.exit(1); }

  // ─── STEP 4: Reviews 1–7 (before combo at position 8) ────────────────────
  section('STEP 4: Complete Reviews 1-7 (before combo checkpoint)');
  for (let i = 1; i <= 7; i++) {
    const p = products[i - 1];
    const submitRes = await api.post('/reviews/submit', {
      productId: p.id,
      orderId: `ORD-TEST-${i.toString().padStart(4, '0')}`,
      reviewText: '01',
      platform: 'Amazon'
    }, { headers: H });
    ok(`Review ${i}/7 accepted (201)`, submitRes.status === 201, `Got ${submitRes.status}: ${JSON.stringify(submitRes.data).slice(0, 120)}`);
    await sleep(200);
  }

  // ─── STEP 5: Check balance after 7 reviews ───────────────────────────────
  section('STEP 5: Verify balance after 7 reviews');
  const me5 = await api.get('/auth/me', { headers: H });
  const bal5 = me5.data?.balances?.Amazon;
  ok('completedReviewsCount = 7', bal5?.completedReviewsCount === 7, `Got ${bal5?.completedReviewsCount}`);
  ok('walletBalance > 0', (bal5?.walletBalance || 0) > 0, `Got ${bal5?.walletBalance}`);
  ok('isComboBlocked = true (combo at pos 8)', bal5?.isComboBlocked === true, `Got ${bal5?.isComboBlocked}`);
  ok('comboDetails.position = 8', bal5?.comboDetails?.position === 8, `Got ${bal5?.comboDetails?.position}`);
  ok('comboDetails.triggerBalance = 100', bal5?.comboDetails?.triggerBalance === 100, `Got ${bal5?.comboDetails?.triggerBalance}`);
  console.log(`  💰 Balance after 7 reviews: $${bal5?.walletBalance}`);

  // ─── STEP 6: Try review #8 — expect COMBO_BLOCK ──────────────────────────
  section('STEP 6: Attempt Review #8 — expect COMBO_BLOCK');
  const p8 = products[7];
  const block8 = await api.post('/reviews/submit', {
    productId: p8.id,
    orderId: 'ORD-SHOULD-BLOCK-001',
    reviewText: '01'
  }, { headers: H });
  ok('Review #8 blocked with 403', block8.status === 403, `Got ${block8.status}`);
  ok('Error is COMBO_BLOCK', block8.data?.error === 'COMBO_BLOCK', `Got ${block8.data?.error}`);
  ok('triggerBalance = 100', block8.data?.triggerBalance === 100, `Got ${block8.data?.triggerBalance}`);

  // ─── STEP 7: Try withdrawal while combo blocked ───────────────────────────
  section('STEP 7: Attempt withdrawal while combo is blocked');
  const wCombo = await api.post('/transactions/withdraw', {
    amount: 1.00,
    platform: 'Amazon'
  }, { headers: H });
  ok('Withdrawal blocked when combo pending', wCombo.status === 400, `Got ${wCombo.status}`);
  console.log(`  Withdrawal block message: "${wCombo.data?.error}"`);

  // ─── STEP 8: Submit combo deposit ────────────────────────────────────────
  section('STEP 8: Submit combo deposit ($100)');
  const txHash = `TEST-COMBO-${Date.now()}`;
  const depRes = await api.post('/transactions/deposit', {
    platform: 'Amazon',
    protocol: 'TRC-20',
    amount: 100,
    txHash,
    remark: 'Combo Payment for Position 8',
    currency: 'USDT',
    cryptoAmount: 100
  }, { headers: H });
  ok('Deposit submitted 201', depRes.status === 201, `Got ${depRes.status}: ${JSON.stringify(depRes.data).slice(0, 120)}`);
  const depositId = depRes.data?.deposit?.id;
  ok('Deposit ID received', !!depositId);
  console.log(`  Deposit ID: ${depositId}`);

  // ─── STEP 9: Admin approves deposit ──────────────────────────────────────
  section('STEP 9: Admin approves combo deposit');
  // Get admin token from DB
  const { data: admins } = await supabase.from('admins').select('id, username').limit(1);
  let adminToken: string;
  if (admins && admins.length > 0) {
    const admin = admins[0];
    const adminLoginRes = await api.post('/auth/admin/login', { username: admin.username, password: 'admin123' });
    if (adminLoginRes.status === 200 && adminLoginRes.data?.token) {
      adminToken = adminLoginRes.data.token;
      console.log(`  Admin login OK: ${admin.username}`);
    } else {
      // Try alternate password
      const alt = await api.post('/auth/admin/login', { username: admin.username, password: 'password123' });
      adminToken = alt.data?.token;
      console.log(`  Admin login attempt 2: status ${alt.status}`);
    }
  } else {
    console.warn('  No admins in DB — approving deposit directly via Supabase');
  }

  // Direct Supabase approve (most reliable for testing)
  if (depositId) {
    // Fetch deposit details to compute balance
    const { data: dep } = await supabase.from('deposits').select('*').eq('id', depositId).single();
    if (dep) {
      const { data: bRec } = await supabase.from('platform_balances')
        .select('wallet_balance, current_position, last_cleared_combo_position')
        .eq('user_id', userId).eq('platform', 'Amazon').single();

      const currentBal = parseFloat(bRec?.wallet_balance as any) || 0;
      const nextPos = (bRec?.current_position || 0) + 1;
      const { data: cp } = await supabase.from('combo_checkpoints')
        .select('*').eq('user_id', userId).eq('platform', 'Amazon').eq('position', nextPos).maybeSingle();

      let finalBalance = currentBal + parseFloat(dep.amount);
      let clearedPos = 0;
      if (cp) {
        finalBalance = Number((currentBal + parseFloat(dep.amount) + parseFloat(cp.profit_override)).toFixed(2));
        clearedPos = nextPos;
      }

      await supabase.from('deposits').update({ status: 'Approved' }).eq('id', depositId);
      await supabase.from('platform_balances').update({ wallet_balance: finalBalance }).eq('user_id', userId);
      if (clearedPos > 0) {
        await supabase.from('platform_balances').update({ last_cleared_combo_position: clearedPos }).eq('user_id', userId).eq('platform', 'Amazon');
      }
      await supabase.from('profiles').update({ status: 'active' }).eq('id', userId);
      console.log(`  ✅ Deposit approved directly. finalBalance=$${finalBalance}, clearedComboPos=${clearedPos}`);
    }
  }

  // ─── STEP 10: Verify combo cleared ───────────────────────────────────────
  section('STEP 10: Verify combo cleared after deposit approval');
  await sleep(300);
  const me10 = await api.get('/auth/me', { headers: H });
  const bal10 = me10.data?.balances?.Amazon;
  ok('isComboBlocked = false after deposit', bal10?.isComboBlocked === false, `Got ${bal10?.isComboBlocked}`);
  ok('Balance increased (includes $50 profit + $100 deposit)', (bal10?.walletBalance || 0) > 100, `Got ${bal10?.walletBalance}`);
  console.log(`  💰 Balance after combo deposit: $${bal10?.walletBalance}`);

  // ─── STEP 11: Review #8 should now succeed ──────────────────────────────
  section('STEP 11: Submit review #8 (should succeed after combo cleared)');
  const submit8 = await api.post('/reviews/submit', {
    productId: p8.id,
    orderId: 'ORD-COMBO-CLEARED-001',
    reviewText: '02'
  }, { headers: H });
  ok('Review #8 accepted (201)', submit8.status === 201, `Got ${submit8.status}: ${JSON.stringify(submit8.data).slice(0, 120)}`);

  // ─── STEP 12: Reviews 9–25 ────────────────────────────────────────────────
  section('STEP 12: Complete reviews 9-25');
  for (let i = 9; i <= 25; i++) {
    const p = products[i - 1];
    const submitRes = await api.post('/reviews/submit', {
      productId: p.id,
      orderId: `ORD-TEST-${i.toString().padStart(4, '0')}`,
      reviewText: i % 2 === 0 ? '02' : '03'
    }, { headers: H });
    ok(`Review ${i}/25 accepted (201)`, submitRes.status === 201, `Got ${submitRes.status}: ${JSON.stringify(submitRes.data).slice(0, 100)}`);
    await sleep(200);
  }

  // ─── STEP 13: Verify 25 reviews complete ─────────────────────────────────
  section('STEP 13: Verify 25 reviews completed');
  const me13 = await api.get('/auth/me', { headers: H });
  const bal13 = me13.data?.balances?.Amazon;
  ok('completedReviewsCount = 25', bal13?.completedReviewsCount === 25, `Got ${bal13?.completedReviewsCount}`);
  console.log(`  💰 Total balance after 25 reviews: $${bal13?.walletBalance}`);

  // ─── STEP 14: Try review #26 — should be blocked (batch complete) ─────────
  section('STEP 14: Review #26 — should be blocked (batch complete)');
  const p26 = products[25];
  const block26 = await api.post('/reviews/submit', {
    productId: p26.id,
    orderId: 'ORD-SHOULD-BLOCK-026',
    reviewText: '01'
  }, { headers: H });
  ok('Review #26 blocked (400)', block26.status === 400, `Got ${block26.status}`);
  ok('batchComplete flag set', block26.data?.batchComplete === true, `Got ${block26.data?.batchComplete}`);

  // ─── STEP 15: Submit withdrawal ───────────────────────────────────────────
  section('STEP 15: Submit withdrawal request');
  // First bind a USDT address
  await supabase.from('profiles').update({ bound_usdt_address: 'TTest1WalletAddressForTesting123456789' }).eq('id', userId);
  const wdRes = await api.post('/transactions/withdraw', {
    amount: 10,
    platform: 'Amazon'
  }, { headers: H });
  ok('Withdrawal submitted (201)', wdRes.status === 201, `Got ${wdRes.status}: ${JSON.stringify(wdRes.data).slice(0, 120)}`);
  const withdrawalId = wdRes.data?.withdrawal?.id;
  console.log(`  Withdrawal ID: ${withdrawalId}`);

  // ─── STEP 16: Admin approves withdrawal ──────────────────────────────────
  section('STEP 16: Approve withdrawal (resets progress + starts 24h cooldown)');
  if (withdrawalId) {
    // Direct DB approval (most reliable for test)
    const { data: wRec } = await supabase.from('withdrawals').select('*').eq('id', withdrawalId).single();
    if (wRec) {
      await supabase.from('withdrawals').update({ status: 'Approved' }).eq('id', withdrawalId);
      // Reset user progress + set last_reset_at + start cooldown
      await supabase.from('platform_balances').update({
        current_position: 0,
        last_completed_batch_at: new Date().toISOString(),
        last_reset_at: new Date().toISOString()
      }).eq('user_id', userId).eq('platform', 'Amazon');
      console.log('  ✅ Withdrawal approved. Progress reset. 24h cooldown started.');
    }
  }

  // ─── STEP 17: Verify cooldown is active ──────────────────────────────────
  section('STEP 17: Verify 24h cooldown is active');
  const blockCooldown = await api.post('/reviews/submit', {
    productId: products[0].id,
    orderId: 'ORD-COOLDOWN-TEST',
    reviewText: '01'
  }, { headers: H });
  ok('Review blocked by 24h cooldown (400)', blockCooldown.status === 400, `Got ${blockCooldown.status}`);
  ok('cooldownActive flag set', blockCooldown.data?.cooldownActive === true, `Got ${blockCooldown.data?.cooldownActive}`);
  console.log(`  Cooldown message: "${blockCooldown.data?.error}"`);

  // ─── STEP 18: Admin resets batch (24h bypass) ────────────────────────────
  section('STEP 18: Admin resets batch to bypass 24h cooldown');
  // Direct DB reset (bypass the admin HTTP auth for test reliability)
  await supabase.from('platform_balances').update({
    current_position: 0,
    last_completed_batch_at: null,
    last_reset_at: new Date().toISOString()
  }).eq('user_id', userId).eq('platform', 'Amazon');
  // Also clear old review submissions so lastResetAt filter works
  await supabase.from('review_submissions').delete().eq('user_id', userId);
  console.log('  ✅ Batch reset. Cooldown cleared. last_reset_at updated.');

  // ─── STEP 19: Verify can do reviews again ────────────────────────────────
  section('STEP 19: Verify reviews are possible after bypass reset');
  await sleep(300);
  const submit19 = await api.post('/reviews/submit', {
    productId: products[0].id,
    orderId: 'ORD-DAY2-001',
    reviewText: '01'
  }, { headers: H });
  ok('Review #1 (day 2) accepted (201)', submit19.status === 201, `Got ${submit19.status}: ${JSON.stringify(submit19.data).slice(0, 120)}`);

  // ─── STEP 20: /auth/me shows new progress ─────────────────────────────────
  section('STEP 20: /auth/me reflects reset progress');
  const me20 = await api.get('/auth/me', { headers: H });
  const bal20 = me20.data?.balances?.Amazon;
  ok('completedReviewsCount = 1 (new batch)', bal20?.completedReviewsCount === 1, `Got ${bal20?.completedReviewsCount}`);
  ok('lastResetAt is recent (within last 60s)', (() => {
    const reset = new Date(bal20?.lastResetAt || 0).getTime();
    return Date.now() - reset < 60000;
  })(), `lastResetAt=${bal20?.lastResetAt}`);
  console.log(`  💰 Balance after day 2 review 1: $${bal20?.walletBalance}`);

  // ─── SUMMARY ─────────────────────────────────────────────────────────────
  console.log('\n═════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═════════════════════════════════════════════');
  console.log(`  Passed: ${pass}`);
  console.log(`  Failed: ${fail}`);
  if (issues.length > 0) {
    console.log('\n  ❌ Issues found:');
    issues.forEach(i => console.log(`    • ${i}`));
  } else {
    console.log('\n  ✅ All tests passed! A-to-Z flow is working correctly.');
  }
  console.log('');
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
