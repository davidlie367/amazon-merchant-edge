import express, { Response } from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth.js';
import { broadcastToUser, broadcastToAdmins } from '../services/wsService.js';

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

    // Check if user has specific assigned products for this platform
    const { data: assigned } = await supabase
      .from('user_assigned_products')
      .select('product_id, created_at')
      .eq('user_id', userId)
      .eq('platform', platform);

    if (!assigned || assigned.length === 0) {
      // If no products assigned, this platform is locked/unassigned for this user
      return res.json([]);
    }

    const assignedIds = assigned.map((a: any) => a.product_id);
    let { data: products, error } = await supabase
      .from('products')
      .select('*')
      .in('id', assignedIds);

    const assignedMap = new Map(assigned.map((a: any) => [a.product_id, a.created_at]));
    if (products) {
      products = products.map((p: any) => ({
        ...p,
        assignedAt: assignedMap.get(p.id) || new Date().toISOString()
      }));
    }

    if (error) {
      return res.status(500).json({ error: 'Failed to retrieve products: ' + error.message });
    }

    // Auto-seed product pool if database is completely empty
    if (!products || products.length === 0) {
      const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
      if (count === 0) {
        const defaultProducts = [
          // Amazon (4% Commission)
          { title: 'ZonHub Smart Echo (5th Gen) | Spatial sound', image_url: 'https://images.unsplash.com/photo-1543512214-318c7553f230?auto=format&fit=crop&q=80&w=600', price: 31.25, payout: 1.25, external_link: 'https://www.amazon.com/s?k=smart+echo+speaker' },
          { title: 'ZonReader Paperwhite (16 GB) | Warm light', image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80&w=600', price: 48.75, payout: 1.95, external_link: 'https://www.amazon.com/s?k=paperwhite+ereader' },
          { title: 'Organic Bamboo Coasters Set (6-Pack) | Non-slip', image_url: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&q=80&w=600', price: 20.00, payout: 0.80, external_link: 'https://www.amazon.com/s?k=bamboo+coasters' },
          { title: 'Ergonomic Memory Foam Office Seat Cushion', image_url: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&q=80&w=600', price: 27.50, payout: 1.10, external_link: 'https://www.amazon.com/s?k=office+seat+cushion' },
          { title: 'Stainless Steel Vacuum Insulated Water Bottle (32oz)', image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=600', price: 35.00, payout: 1.40, external_link: 'https://www.amazon.com/s?k=insulated+water+bottle' },
          { title: 'Professional Ceramic Ionic Hair Dryer | 1875W', image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=600', price: 55.00, payout: 2.20, external_link: 'https://www.amazon.com/s?k=hair+dryer' },
          { title: 'Adjustable Laptop Stand | Ergonomic Aluminum Stand', image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=600', price: 41.25, payout: 1.65, external_link: 'https://www.amazon.com/s?k=laptop+stand' },
          { title: 'Premium Matcha Green Tea Powder (Organic)', image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&q=80&w=600', price: 23.75, payout: 0.95, external_link: 'https://www.amazon.com/s?k=matcha+powder' },
          { title: 'Dual-Port USB-C Wall Charger Block | 40W Fast Charger', image_url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=600', price: 26.25, payout: 1.05, external_link: 'https://www.amazon.com/s?k=usb+c+charger' },
          { title: 'Wireless Active Noise Cancelling Earbuds | Bluetooth 5.3', image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=600', price: 52.50, payout: 2.10, external_link: 'https://www.amazon.com/s?k=noise+cancelling+earbuds' },
          { title: 'Digital Kitchen Scale | High Precision Multi-unit', image_url: 'https://images.unsplash.com/photo-1588675646184-f550218b57b5?auto=format&fit=crop&q=80&w=600', price: 18.75, payout: 0.75, external_link: 'https://www.amazon.com/s?k=kitchen+scale' },
          { title: 'Aromatherapy Ceramic Essential Oil Diffuser (500ml)', image_url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&q=80&w=600', price: 32.50, payout: 1.30, external_link: 'https://www.amazon.com/s?k=essential+oil+diffuser' },
          // Alibaba (8% Commission)
          { title: 'AliUltra Foldable Electric Scooter | Dual motor', image_url: 'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=600', price: 31.25, payout: 2.50, external_link: 'https://www.alibaba.com/trade/search?SearchText=electric+scooter' },
          { title: 'AliVision 4K Native LED Projector | 15k Lms', image_url: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&q=80&w=600', price: 26.87, payout: 2.15, external_link: 'https://www.alibaba.com/trade/search?SearchText=4k+projector' },
          { title: 'AliSecure HD Outdoor IP Camera | Wifi PTZ Node', image_url: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?auto=format&fit=crop&q=80&w=600', price: 22.50, payout: 1.80, external_link: 'https://www.alibaba.com/trade/search?SearchText=wifi+ip+camera' },
          { title: 'Smart Automated Robot Vacuum Cleaner | LIDAR Map', image_url: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?auto=format&fit=crop&q=80&w=600', price: 30.00, payout: 2.40, external_link: 'https://www.alibaba.com/trade/search?SearchText=robot+vacuum' },
          { title: 'Portable Solar Generator Station | 500Wh Output', image_url: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&q=80&w=600', price: 28.75, payout: 2.30, external_link: 'https://www.alibaba.com/trade/search?SearchText=portable+solar+generator' },
          { title: 'Heavy Duty Massage Gun | 30 Speeds Deep Tissue', image_url: 'https://images.unsplash.com/photo-1607962837359-5e7eaf562642?auto=format&fit=crop&q=80&w=600', price: 20.00, payout: 1.60, external_link: 'https://www.alibaba.com/trade/search?SearchText=massage+gun' },
          { title: 'Adjustable Dumbbells Set (50lbs) | Quick Dial', image_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=600', price: 28.12, payout: 2.25, external_link: 'https://www.alibaba.com/trade/search?SearchText=adjustable+dumbbells' },
          { title: 'Automatic Espresso Coffee Machine | 20 Bar Pump', image_url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&q=80&w=600', price: 30.62, payout: 2.45, external_link: 'https://www.alibaba.com/trade/search?SearchText=espresso+machine' },
          { title: 'Electric Oral Irrigator Dental Flosser | 4 Modes', image_url: 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&q=80&w=600', price: 11.87, payout: 0.95, external_link: 'https://www.alibaba.com/trade/search?SearchText=oral+irrigator' },
          { title: 'Portable Bluetooth Thermal Label Printer', image_url: 'https://images.unsplash.com/photo-1543269664-76bc3997d9ea?auto=format&fit=crop&q=80&w=600', price: 15.00, payout: 1.20, external_link: 'https://www.alibaba.com/trade/search?SearchText=label+printer' },
          { title: 'Dual Layer Car Roof Cargo Carrier Bag | Waterproof', image_url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=600', price: 18.75, payout: 1.50, external_link: 'https://www.alibaba.com/trade/search?SearchText=roof+cargo+bag' },
          { title: 'Foldable Lightbox Photography Studio Kit', image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600', price: 18.12, payout: 1.45, external_link: 'https://www.alibaba.com/trade/search?SearchText=lightbox+studio' },
          // Shopify (12% Commission)
          { title: 'Minimalist Full-Grain Leather Wallet | RFID organizer', image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&q=80&w=600', price: 11.00, payout: 1.32, external_link: 'https://www.google.com/search?q=minimalist+leather+wallet' },
          { title: 'Therapeutic Essential Oils Diffuser | Ceramic ultrasonic', image_url: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&q=80&w=600', price: 9.00, payout: 1.08, external_link: 'https://www.google.com/search?q=ceramic+essential+oils+diffuser' },
          { title: 'Eco-Friendly Cork Yoga Mat | Non-slip sweat-resistant', image_url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=600', price: 17.00, payout: 2.04, external_link: 'https://www.google.com/search?q=cork+yoga+mat' },
          { title: 'Hydro Flask Insulated Travel Coffee Mug | 16oz Wide Mouth', image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=600', price: 12.00, payout: 1.44, external_link: 'https://www.google.com/search?q=insulated+travel+mug' },
          { title: 'Premium Bamboo Bed Sheets Set | King Size Cooling', image_url: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=600', price: 23.50, payout: 2.82, external_link: 'https://www.google.com/search?q=bamboo+bed+sheets' },
          { title: 'Minimalist Wooden Desk Organizer Stand | Handcrafted Walnut', image_url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&q=80&w=600', price: 15.00, payout: 1.80, external_link: 'https://www.google.com/search?q=wooden+desk+organizer' },
          { title: 'Aromatherapy Soy Wax Candles Set | Lavender & Eucalyptus', image_url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&q=80&w=600', price: 8.50, payout: 1.02, external_link: 'https://www.google.com/search?q=soy+wax+candles' },
          { title: 'Polarized Retro Round Sunglasses | UV400 Unbreakable', image_url: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=600', price: 13.00, payout: 1.56, external_link: 'https://www.google.com/search?q=polarized+round+sunglasses' },
          { title: 'Manual Ceramic Burr Coffee Grinder | Adjustable Coarseness', image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=600', price: 14.50, payout: 1.74, external_link: 'https://www.google.com/search?q=manual+coffee+grinder' },
          { title: 'Stainless Steel French Press Coffee Maker | Double Wall', image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&q=80&w=600', price: 19.00, payout: 2.28, external_link: 'https://www.google.com/search?q=french+press+coffee+maker' },
          { title: 'Vegan Leather Minimalist Backpack | 15.6 Inch Laptop Sleeve', image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=600', price: 21.00, payout: 2.52, external_link: 'https://www.google.com/search?q=vegan+leather+backpack' },
          { title: 'Ergonomic Balance Ball Chair with Stability Base', image_url: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&q=80&w=600', price: 22.50, payout: 2.70, external_link: 'https://www.google.com/search?q=balance+ball+chair' }
        ];

        const { error: seedError } = await supabase.from('products').insert(defaultProducts);
        if (!seedError) {
          const { data: refetched } = await supabase.from('products').select('*').in('id', assignedIds);
          products = refetched;
        }
      }
    }

    res.json(products || []);
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

    const isDbConfigured = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('your-project-id') &&
                           process.env.SUPABASE_KEY && !process.env.SUPABASE_KEY.includes('your-supabase-anon-key');

    // Dev sandbox mode — no DB calls at all
    if (userId === 'user-dev-uuid' || userId === 'admin-dev-uuid' || !isDbConfigured) {
      return res.status(201).json({
        message: 'Review draft successfully recorded and approved (Sandbox Mode).',
        submission: { id: 'submission-dev-uuid', user_id: userId, product_id: productId, order_id: finalOrderId, review_text: reviewText, payout_earned: 1.00, status: 'Completed' },
        payoutEarned: 1.00, completedReviewsCount: 1
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
    // Cooldown
    if (bal.last_completed_batch_at) {
      const hoursElapsed = (Date.now() - new Date(bal.last_completed_batch_at).getTime()) / (1000 * 60 * 60);
      if (hoursElapsed < 24) {
        const hoursLeft = Math.max(0, Math.ceil(24 - hoursElapsed));
        const minutesLeft = Math.max(0, Math.ceil((24 - hoursElapsed) * 60) % 60);
        return res.status(400).json({ error: `Your withdrawal has been processed. You can start the next batch in ${hoursLeft}h ${minutesLeft}m.`, cooldownActive: true, hoursRemaining: hoursLeft, minutesRemaining: minutesLeft });
      } else {
        supabase.from('platform_balances').update({ last_completed_batch_at: null, last_reset_at: new Date().toISOString() }).eq('user_id', userId).eq('platform', platform);
        bal.last_completed_batch_at = null;
      }
    }

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
      // Get all combo checkpoints at or before nextPosition
      const { data: requiredCheckpoints } = await supabase.from('combo_checkpoints').select('position').eq('user_id', userId).eq('platform', platform).lte('position', nextPosition);
      const requiredPositions = (requiredCheckpoints || []).map((c: any) => c.position);

      // For each required position, check if there's an approved deposit with matching combo remark
      let clearedCount = 0;
      for (const pos of requiredPositions) {
        const { count } = await supabase.from('deposits').select('id', { count: 'exact', head: true })
          .eq('user_id', userId).eq('platform', platform).eq('status', 'Approved')
          .ilike('remark', `%Combo Payment for Position ${pos}%`);
        if (count && count > 0) clearedCount++;
      }

      if (clearedCount < requiredPositions.length) {
        return res.status(403).json({
          error: 'COMBO_BLOCK',
          triggerBalance: parseFloat(checkpoint.trigger_balance as any) || 0.00,
          profitAmount: parseFloat(checkpoint.profit_override as any) || 0.00,
          currentBalance: Number((currentBalance + payoutEarned).toFixed(2)),
          position: nextPosition
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

    // Insert submission
    const { data: submission, error: insertError } = await supabase
      .from('review_submissions')
      .insert({ user_id: userId, product_id: productId, order_id: finalOrderId, review_text: reviewText, payout_earned: payoutEarned, status: 'Completed', platform })
      .select().single();

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
      const [{ count: reqD }, { count: actD }] = await Promise.all([
        supabase.from('combo_checkpoints').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('platform', platform).lte('position', nextCampaignPos),
        supabase.from('deposits').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('platform', platform).eq('status', 'Approved').gte('amount', nextCheckpoint.trigger_balance).gte('created_at', batchStart)
      ]);
      nextComboBlocked = (actD || 0) < (reqD || 0);
      if (nextComboBlocked) {
        nextComboDetails = { position: nextCampaignPos, triggerBalance: parseFloat(nextCheckpoint.trigger_balance as any) || 0.00, profitAmount: parseFloat(nextCheckpoint.profit_override as any) || 0.00, currentBalance: newBalance };
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
        platform,
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

    // Filter submissions to current batch only (created at or after last_reset_at)
    const formattedSubmissions = (submissions || [])
      .filter((sub: any) => {
        const batchStart = batchStartMap[sub.platform] || new Date(0).toISOString();
        return new Date(sub.created_at).getTime() >= new Date(batchStart).getTime();
      })
      .map((sub: any) => ({
        id: sub.id,
        productId: sub.product_id,
        productTitle: sub.product?.title || 'Unknown Product',
        productImage: sub.product?.image_url || '',
        platform: sub.platform || '',
        orderId: sub.order_id,
        reviewText: sub.review_text,
        payout: parseFloat(sub.payout_earned) || 0.00,
        status: sub.status,
        createdAt: sub.created_at,
        date: new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      }));

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
