import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.log('Environment variables NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function deployMigration() {
  const sqlPath = path.join(process.cwd(), 'database', 'migrations', '019_atomic_weigh_rpc_and_rls.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Deploying migration 019 to Supabase Production...');
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.log('RPC exec_sql status:', error.message);
  } else {
    console.log('SUCCESS: Migration 019 deployed successfully!');
  }
}

deployMigration();
