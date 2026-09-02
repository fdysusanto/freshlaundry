import { checkoutService } from '../services/checkoutService';
import { orderService } from '../services/orderService';
import { isPickupSlotBookable, calculateEarliestDeliveryDateTime } from '../utils/scheduleUtils';
import { DEMO_USERS, TIME_SLOTS, PICKUP_SLOT_LOCK_MINUTES } from '../utils/constants';

async function runPickupSlotCutoffTests() {
  console.log('==================================================');
  console.log('RUNNING PICKUP SLOT CUT-OFF 15 MINUTES TEST SUITE');
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

  async function assertThrowsAsync(fn: () => Promise<any>, expectedErrorSubstring: string, testName: string) {
    try {
      await fn();
      console.error(`[FAIL] ${testName} (Expected exception containing "${expectedErrorSubstring}", but none was thrown)`);
      failed++;
    } catch (err: any) {
      if (err.message && err.message.includes(expectedErrorSubstring)) {
        console.log(`[PASS] ${testName} (Caught expected error: "${err.message}")`);
        passed++;
      } else {
        console.error(`[FAIL] ${testName} (Caught error "${err.message}", but expected substring "${expectedErrorSubstring}")`);
        failed++;
      }
    }
  }

  const todayStr = '2026-09-02';
  const tomorrowStr = '2026-09-03';

  // Constant verification
  assert(PICKUP_SLOT_LOCK_MINUTES === 15, 'Constant: PICKUP_SLOT_LOCK_MINUTES is 15');

  // Test 1: Now: 07:44 WIB, Slot: 08:00 - 10:00 -> BOOKABLE
  const res1 = isPickupSlotBookable(todayStr, TIME_SLOTS[0], `${todayStr}T07:44:00+07:00`);
  assert(res1 === true, 'Test 1: Now 07:44 WIB, Slot 08:00 - 10:00 -> BOOKABLE (true)');

  // Test 2: Now: 07:45 WIB, Slot: 08:00 - 10:00 -> NOT BOOKABLE
  const res2 = isPickupSlotBookable(todayStr, TIME_SLOTS[0], `${todayStr}T07:45:00+07:00`);
  assert(res2 === false, 'Test 2: Now 07:45 WIB, Slot 08:00 - 10:00 -> NOT BOOKABLE (false)');

  // Test 3: Now: 07:46 WIB, Slot: 08:00 - 10:00 -> NOT BOOKABLE
  const res3 = isPickupSlotBookable(todayStr, TIME_SLOTS[0], `${todayStr}T07:46:00+07:00`);
  assert(res3 === false, 'Test 3: Now 07:46 WIB, Slot 08:00 - 10:00 -> NOT BOOKABLE (false)');

  // Test 4: Now: 10:44 WIB, Slot: 11:00 - 14:00 -> BOOKABLE
  const res4 = isPickupSlotBookable(todayStr, TIME_SLOTS[1], `${todayStr}T10:44:00+07:00`);
  assert(res4 === true, 'Test 4: Now 10:44 WIB, Slot 11:00 - 14:00 -> BOOKABLE (true)');

  // Test 5: Now: 10:45 WIB, Slot: 11:00 - 14:00 -> NOT BOOKABLE
  const res5 = isPickupSlotBookable(todayStr, TIME_SLOTS[1], `${todayStr}T10:45:00+07:00`);
  assert(res5 === false, 'Test 5: Now 10:45 WIB, Slot 11:00 - 14:00 -> NOT BOOKABLE (false)');

  // Test 6: Now: 14:44 WIB, Slot: 15:00 - 17:00 -> BOOKABLE
  const res6 = isPickupSlotBookable(todayStr, TIME_SLOTS[2], `${todayStr}T14:44:00+07:00`);
  assert(res6 === true, 'Test 6: Now 14:44 WIB, Slot 15:00 - 17:00 -> BOOKABLE (true)');

  // Test 7: Now: 14:45 WIB, Slot: 15:00 - 17:00 -> NOT BOOKABLE
  const res7 = isPickupSlotBookable(todayStr, TIME_SLOTS[2], `${todayStr}T14:45:00+07:00`);
  assert(res7 === false, 'Test 7: Now 14:45 WIB, Slot 15:00 - 17:00 -> NOT BOOKABLE (false)');

  // Test 8: Future Date — Now: Today 16:00 WIB, Pickup Date: Tomorrow, Slot: 08:00 - 10:00 -> BOOKABLE
  const res8 = isPickupSlotBookable(tomorrowStr, TIME_SLOTS[0], `${todayStr}T16:00:00+07:00`);
  assert(res8 === true, 'Test 8: Future Date (Tomorrow) 08:00 - 10:00 -> BOOKABLE (true)');

  // Test 9: Direct API Bypass — Server authoritative rejection
  const customerA = DEMO_USERS[0];
  const originalDateNow = Date.now;
  try {
    // Mock system clock at 07:46 WIB
    const mockNowMs = new Date(`${todayStr}T07:46:00+07:00`).getTime();
    Date.now = () => mockNowMs;

    await assertThrowsAsync(
      async () => {
        await checkoutService.processCheckoutAsync(
          {
            laundryId: 'lnd_001',
            items: [{ serviceId: 'srv_001', quantity: 5 }],
            pickupAddress: 'Jl. Sudirman No. 10, Jakarta',
            pickupDate: todayStr,
            pickupTimeSlot: TIME_SLOTS[0], // 08:00 - 10:00 WIB (locked at 07:45)
            deliveryDate: '2026-09-05',
            deliveryTimeSlot: TIME_SLOTS[0],
            idempotencyKey: `BYPASS-CUTOFF-${Date.now()}`,
          },
          customerA
        );
      },
      'PICKUP_SLOT_NO_LONGER_AVAILABLE',
      'Test 9: Direct API request for locked pickup slot REJECTED by server with PICKUP_SLOT_NO_LONGER_AVAILABLE'
    );
  } finally {
    Date.now = originalDateNow;
  }

  // Test 10: Boundary Precision — 07:44:59 vs 07:45:00
  const res10a = isPickupSlotBookable(todayStr, TIME_SLOTS[0], `${todayStr}T07:44:59.999+07:00`);
  assert(res10a === true, 'Test 10a: Boundary 07:44:59.999 WIB -> BOOKABLE (true)');

  const res10b = isPickupSlotBookable(todayStr, TIME_SLOTS[0], `${todayStr}T07:45:00.000+07:00`);
  assert(res10b === false, 'Test 10b: Boundary 07:45:00.000 WIB -> NOT BOOKABLE (false)');

  // Test 11: Unchanged Delivery SLA Regression Check
  const earliestDelivery = calculateEarliestDeliveryDateTime(todayStr, TIME_SLOTS[0], 48);
  assert(
    earliestDelivery.earliestDate === '2026-09-04' && earliestDelivery.earliestTimeSlot === TIME_SLOTS[1],
    'Test 11: Delivery SLA calculation remains unchanged (08-10 pickup + 48h = 2 days later 11:00 WIB -> 11:00 - 14:00 WIB)'
  );

  console.log('\n==================================================');
  console.log(`PICKUP SLOT CUT-OFF TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPickupSlotCutoffTests().catch((err) => {
  console.error('Fatal Error running pickup slot cut-off tests:', err);
  process.exit(1);
});
