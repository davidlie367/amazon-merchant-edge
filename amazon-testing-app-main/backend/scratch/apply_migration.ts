/**
 * Apply missing DB column via Supabase Management API
 * Uses the project reference from SUPABASE_URL to call the SQL execution API.
 * 
 * NOTE: This requires a valid service_role JWT or management API token.
 * The anon key won't work for DDL. We'll use a direct postgres connection instead.
 */
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_KEY!;

// Extract project ref from URL: https://ovteqizhtznkgglwsnut.supabase.co
const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
console.log('Project Ref:', projectRef);

// Try the Supabase SQL API using service_role key
// The anon key has "role":"anon" in the JWT payload
// We need service role which has "role":"service_role"
// Decode the existing key to check
const parts = ANON_KEY.split('.');
const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
console.log('Key role:', payload.role); // Should show "anon" or "service_role"

// Attempt to create the column via RPC if a DB function exists
// OR try using the Supabase internal SQL runner
async function applyMigration() {
  const sql = `
    ALTER TABLE platform_balances 
    ADD COLUMN IF NOT EXISTS last_cleared_combo_position INT DEFAULT 0;
    
    ALTER TABLE combo_checkpoints 
    ADD COLUMN IF NOT EXISTS is_cleared BOOLEAN DEFAULT FALSE;
  `.trim();

  console.log('\nSQL to apply:');
  console.log(sql);

  // Try calling the Supabase REST API's /rest/v1/rpc/exec_sql 
  // (Only works if admin_exec_sql function was created)
  try {
    const rpcRes = await axios.post(
      `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
      { sql_query: sql },
      {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      }
    );
    console.log('\nRPC exec_sql attempt:', rpcRes.status, JSON.stringify(rpcRes.data));
  } catch (e: any) {
    console.log('RPC exec_sql failed:', e.message);
  }

  // If above doesn't work, use Supabase Management API
  // (requires personal access token from dashboard)
  try {
    const mgmtRes = await axios.post(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      { query: sql },
      {
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      }
    );
    console.log('\nManagement API attempt:', mgmtRes.status, JSON.stringify(mgmtRes.data).slice(0, 200));
  } catch (e: any) {
    console.log('Management API failed:', e.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('MANUAL ACTION REQUIRED: Run this SQL in Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(sql);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

applyMigration().catch(console.error);
