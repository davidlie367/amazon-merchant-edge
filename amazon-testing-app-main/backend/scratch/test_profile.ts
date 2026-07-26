import { supabase } from '../src/config/supabase.js';

async function run() {
  const userId = '5a92b67d-291f-48a5-995b-08f4434a007c';
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, platform, status')
    .eq('id', userId)
    .single();
  
  if (error) {
    console.error('Fetch Error:', error);
  } else {
    console.log('Profile:', data);
  }
}

run();
