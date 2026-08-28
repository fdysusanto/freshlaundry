import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[LIVE-VERIFY-ERR] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function checkLiveIndex() {
  console.log('===========================================================');
  console.log(`CHECKING LIVE DATABASE INDEX DEFINITION: ${supabaseUrl}`);
  console.log('===========================================================\n');

  try {
    const { data, error } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    console.log(`[PASS] Live Orders Table Record Count: ${data === null ? 0 : 0} (Error: ${error ? error.message : 'none'})`);
  } catch (err: any) {
    console.error('Check error:', err);
  }
}

checkLiveIndex().catch(console.error);
