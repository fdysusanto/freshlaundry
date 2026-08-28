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

async function verifyLiveDbState() {
  console.log('===========================================================');
  console.log(`VERIFYING LIVE DATABASE STATE: ${supabaseUrl}`);
  console.log('===========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string) {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title}`);
      failed++;
    }
  }

  // 1. Verify Transactional Orders Table Record Count = 0
  const { count: orderCount, error: orderErr } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  assert(!orderErr && orderCount === 0, `1. Transactional orders table count = 0 (Actual: ${orderCount})`);

  // 2. Verify Master Data Intact
  const { count: profileCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const { count: laundryCount } = await supabase.from('laundries').select('*', { count: 'exact', head: true });
  assert(Boolean(profileCount && profileCount > 0), `2. Master profiles intact (Actual: ${profileCount})`);
  assert(Boolean(laundryCount && laundryCount > 0), `2. Master laundries intact (Actual: ${laundryCount})`);

  console.log('\n--- Live Database State Verification Complete ---');
  console.log(`Summary: ${passed} PASSED, ${failed} FAILED`);
}

verifyLiveDbState().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
