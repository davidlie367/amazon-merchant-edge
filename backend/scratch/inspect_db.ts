import { supabase } from '../src/config/supabase.js';

async function run() {
  const userId = '5935445f-28bd-4aca-a9d7-8fc29311d065';
  console.log('Inspecting checkpoints for user:', userId);
  
  const { data: checkpoints } = await supabase
    .from('combo_checkpoints')
    .select('*')
    .eq('user_id', userId);
    
  console.log('Checkpoints:', checkpoints);
}

run();
