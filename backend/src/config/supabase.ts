import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'placeholder_service_role_key';

if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project-id') || process.env.SUPABASE_URL.includes('placeholder')) {
  console.warn('⚠️ WARNING: SUPABASE_URL is not configured in backend/.env. Database calls will fail.');
}
if (!process.env.SUPABASE_KEY || process.env.SUPABASE_KEY.includes('your-supabase-anon-key') || process.env.SUPABASE_KEY.includes('placeholder')) {
  console.warn('⚠️ WARNING: SUPABASE_KEY is not configured in backend/.env. Database calls will fail.');
}

export function isDbConfigured(): boolean {
  return !!(
    process.env.SUPABASE_URL &&
    !process.env.SUPABASE_URL.includes('your-project-id') &&
    !process.env.SUPABASE_URL.includes('your-supabase-project') &&
    !process.env.SUPABASE_URL.includes('placeholder') &&
    process.env.SUPABASE_KEY &&
    !process.env.SUPABASE_KEY.includes('your-supabase-anon-key') &&
    !process.env.SUPABASE_KEY.includes('placeholder')
  );
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
