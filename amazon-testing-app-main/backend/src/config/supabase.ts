import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
  console.warn('⚠️ WARNING: SUPABASE_URL is not configured in backend/.env. Database calls will fail.');
}
if (!supabaseKey || supabaseKey.includes('your-supabase-anon-key')) {
  console.warn('⚠️ WARNING: SUPABASE_KEY is not configured in backend/.env. Database calls will fail.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Safe upsert: update first, if no rows affected then insert
export async function upsertBalance(userId: string, data: Record<string, any>) {
  const { data: existing } = await supabase
    .from('platform_balances')
    .select('user_id')
    .eq('user_id', userId)
    .eq('platform', data.platform || 'main')
    .maybeSingle();

  if (existing) {
    return supabase
      .from('platform_balances')
      .update(data)
      .eq('user_id', userId)
      .eq('platform', data.platform || 'main');
  } else {
    return supabase
      .from('platform_balances')
      .insert({ user_id: userId, ...data });
  }
}
