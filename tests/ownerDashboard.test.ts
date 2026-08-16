import { laundryService } from '../services/laundryService';
import { orderService } from '../services/orderService';
import { DEMO_LAUNDRIES } from '../utils/constants';

async function runOwnerDashboardTests() {
  console.log('==================================================');
  console.log('RUNNING OWNER DASHBOARD DATA ISOLATION TESTS');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // TEST 1: laundryService.getLaundriesByOwnerAsync is defined
  assert(
    typeof laundryService.getLaundriesByOwnerAsync === 'function',
    'Test 1: laundryService.getLaundriesByOwnerAsync is defined'
  );

  // TEST 2: orderService.getOrdersByLaundryAsync is defined
  assert(
    typeof orderService.getOrdersByLaundryAsync === 'function',
    'Test 2: orderService.getOrdersByLaundryAsync is defined'
  );

  // TEST 3: Unregistered owner returns empty array [] (NO demo fallback)
  const unknownOwnerUuid = '99999999-9999-4999-8999-999999999999';
  const ownerLaundries = await laundryService.getLaundriesByOwnerAsync(unknownOwnerUuid);
  assert(
    Array.isArray(ownerLaundries) && ownerLaundries.length === 0,
    'Test 3: Unregistered owner returns empty array [] and never falls back to DEMO_LAUNDRIES[0]'
  );

  // TEST 4: Invalid/empty laundryId returns empty orders array []
  const emptyOrders = await orderService.getOrdersByLaundryAsync('');
  assert(
    Array.isArray(emptyOrders) && emptyOrders.length === 0,
    'Test 4: Empty laundryId returns empty orders array []'
  );

  // TEST 5: Global DEMO_LAUNDRIES array remains intact for fixtures/tests
  assert(
    Array.isArray(DEMO_LAUNDRIES) && DEMO_LAUNDRIES.length > 0,
    'Test 5: DEMO_LAUNDRIES global constant is preserved for development fixtures'
  );

  console.log('\n==================================================');
  console.log(`OWNER DASHBOARD TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runOwnerDashboardTests();
