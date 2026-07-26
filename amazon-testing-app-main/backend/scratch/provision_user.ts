import { supabase } from '../src/config/supabase.js';

async function run() {
  console.log('--- Provisioning testreviewer user ---');

  // 1. Fetch user
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', 'testreviewer')
    .single();

  if (userError || !user) {
    console.error('User testreviewer not found:', userError);
    return;
  }

  console.log(`Found User: ${user.username} (${user.id}), status: ${user.status}`);

  // 2. Approve user
  const { error: approveError } = await supabase
    .from('profiles')
    .update({ status: 'active', platform: 'Amazon' })
    .eq('id', user.id);

  if (approveError) {
    console.error('Failed to approve user:', approveError);
    return;
  }
  console.log('Approved user status set to active on Amazon platform.');

  // 3. Fetch products
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, title')
    .limit(30);

  if (productsError || !products) {
    console.error('Failed to fetch products:', productsError);
    return;
  }

  console.log(`Fetched ${products.length} products from the database.`);

  // If there are less than 25 products, let's print a warning
  if (products.length < 25) {
    console.warn(`⚠️ Warning: Only ${products.length} products exist. We need at least 25 to run a full 25-order batch!`);
  }

  // 4. Assign products to Amazon
  const assignments = products.map(p => ({
    user_id: user.id,
    product_id: p.id,
    platform: 'Amazon'
  }));

  // Clear existing
  await supabase.from('user_assigned_products').delete().eq('user_id', user.id).eq('platform', 'Amazon');

  const { error: assignError } = await supabase
    .from('user_assigned_products')
    .insert(assignments);

  if (assignError) {
    console.error('Failed to assign products:', assignError);
    return;
  }
  console.log(`Successfully assigned ${assignments.length} products to user.`);

  // 5. Configure combo checkpoint at position 8
  await supabase.from('combo_checkpoints').delete().eq('user_id', user.id).eq('platform', 'Amazon');
  const { error: comboError } = await supabase
    .from('combo_checkpoints')
    .insert({
      user_id: user.id,
      platform: 'Amazon',
      position: 8,
      trigger_balance: 100.00,
      profit_override: 50.00
    });

  if (comboError) {
    console.error('Failed to insert combo checkpoint:', comboError);
    return;
  }
  console.log('Successfully set combo checkpoint at position 8 (Trigger Balance: $100, Profit: $50).');

  console.log('--- Provisioning Complete ---');
}

run();
