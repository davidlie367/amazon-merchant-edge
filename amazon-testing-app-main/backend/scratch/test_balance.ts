import { supabase } from '../src/config/supabase.js';

async function run() {
  const userId = '5a92b67d-291f-48a5-995b-08f4434a007c';
  const { data, error } = await supabase
    .from('platform_balances')
    .select('*')
    .eq('user_id', userId);
  
  if (error) {
    console.error('Fetch Error:', error);
  } else {
    console.log('Balance Records:', data);
  }
}

run();
