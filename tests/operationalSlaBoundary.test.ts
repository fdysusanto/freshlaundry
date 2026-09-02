import {
  resolveSlaStartDateTime,
  calculateEarliestDeliveryDateTime,
  filterAvailableDeliverySlots,
  validateDeliverySchedule,
} from '../utils/scheduleUtils';
import { TIME_SLOTS } from '../utils/constants';

function runOperationalSlaBoundaryTests() {
  console.log('==================================================');
  console.log('RUNNING OPERATIONAL SLA BOUNDARY UNIT TESTS');
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

  // Verify TIME_SLOTS array has exactly 3 elements
  assert(TIME_SLOTS.length === 3, 'Time slots array contains exactly 3 operational slots');
  assert(TIME_SLOTS[0] === '08:00 - 10:00 WIB', 'Slot 0 is 08:00 - 10:00 WIB');
  assert(TIME_SLOTS[1] === '11:00 - 14:00 WIB', 'Slot 1 is 11:00 - 14:00 WIB');
  assert(TIME_SLOTS[2] === '15:00 - 17:00 WIB', 'Slot 2 is 15:00 - 17:00 WIB');

  // Test 1: Pickup Slot 08:00 - 10:00 WIB -> SLA Start: Same day 11:00 WIB
  const start1 = resolveSlaStartDateTime('2026-09-01', '08:00 - 10:00 WIB');
  assert(start1.year === 2026 && start1.month === 9 && start1.day === 1 && start1.hour === 11, 'Pickup 08-10 -> SLA Start 1 Sept 11:00 WIB');

  // Test 2: Pickup Slot 11:00 - 14:00 WIB -> SLA Start: Same day 15:00 WIB
  const start2 = resolveSlaStartDateTime('2026-09-01', '11:00 - 14:00 WIB');
  assert(start2.year === 2026 && start2.month === 9 && start2.day === 1 && start2.hour === 15, 'Pickup 11-14 -> SLA Start 1 Sept 15:00 WIB');

  // Test 3: Pickup Slot 15:00 - 17:00 WIB -> SLA Start: Next day 08:00 WIB
  const start3 = resolveSlaStartDateTime('2026-09-01', '15:00 - 17:00 WIB');
  assert(start3.year === 2026 && start3.month === 9 && start3.day === 2 && start3.hour === 8, 'Pickup 15-17 -> SLA Start 2 Sept 08:00 WIB');

  // Scenario A: SLA 24h, Pickup 08-10 (1 Sept) -> Expected: 2 Sept 11:00 - 14:00 WIB
  const scA = calculateEarliestDeliveryDateTime('2026-09-01', '08:00 - 10:00 WIB', 24);
  assert(scA.earliestDate === '2026-09-02' && scA.earliestTimeSlot === '11:00 - 14:00 WIB', 'Scenario A: Pickup 08-10 + 24h SLA -> 2 Sept 11:00 - 14:00 WIB');

  // Scenario B: SLA 24h, Pickup 11-14 (1 Sept) -> Expected: 2 Sept 15:00 - 17:00 WIB
  const scB = calculateEarliestDeliveryDateTime('2026-09-01', '11:00 - 14:00 WIB', 24);
  assert(scB.earliestDate === '2026-09-02' && scB.earliestTimeSlot === '15:00 - 17:00 WIB', 'Scenario B: Pickup 11-14 + 24h SLA -> 2 Sept 15:00 - 17:00 WIB');

  // Scenario C: SLA 24h, Pickup 15-17 (1 Sept) -> Expected: 3 Sept 08:00 - 10:00 WIB
  const scC = calculateEarliestDeliveryDateTime('2026-09-01', '15:00 - 17:00 WIB', 24);
  assert(scC.earliestDate === '2026-09-03' && scC.earliestTimeSlot === '08:00 - 10:00 WIB', 'Scenario C: Pickup 15-17 + 24h SLA -> 3 Sept 08:00 - 10:00 WIB');

  // Scenario D: SLA 48h, Pickup 08-10 (1 Sept) -> Expected: 3 Sept 11:00 - 14:00 WIB
  const scD = calculateEarliestDeliveryDateTime('2026-09-01', '08:00 - 10:00 WIB', 48);
  assert(scD.earliestDate === '2026-09-03' && scD.earliestTimeSlot === '11:00 - 14:00 WIB', 'Scenario D: Pickup 08-10 + 48h SLA -> 3 Sept 11:00 - 14:00 WIB');

  // Scenario E: SLA 72h, Pickup 15-17 (1 Sept) -> Expected: 5 Sept 08:00 - 10:00 WIB
  const scE = calculateEarliestDeliveryDateTime('2026-09-01', '15:00 - 17:00 WIB', 72);
  assert(scE.earliestDate === '2026-09-05' && scE.earliestTimeSlot === '08:00 - 10:00 WIB', 'Scenario E: Pickup 15-17 + 72h SLA -> 5 Sept 08:00 - 10:00 WIB');

  // Boundary Equality Test: Completion at 11:00 WIB -> 11:00 - 14:00 WIB is VALID
  const valBoundary = validateDeliverySchedule('2026-09-01', '08:00 - 10:00 WIB', '2026-09-02', '11:00 - 14:00 WIB', 24);
  assert(valBoundary.isValid === true, 'Boundary Equality: Delivery slot starting at completion hour (11:00) is VALID');

  // Boundary Rejection Test: Slot before completion hour -> REJECTED
  const valEarlySlot = validateDeliverySchedule('2026-09-01', '08:00 - 10:00 WIB', '2026-09-02', '08:00 - 10:00 WIB', 24);
  assert(valEarlySlot.isValid === false, 'Boundary Rejection: Slot 08:00-10:00 before 11:00 completion is REJECTED');

  // Slot Filtering Test: On earliest delivery date, only valid slots are returned
  const availableSameDay = filterAvailableDeliverySlots('2026-09-02', '2026-09-02', '11:00 - 14:00 WIB');
  assert(availableSameDay.length === 2 && availableSameDay.includes('11:00 - 14:00 WIB') && availableSameDay.includes('15:00 - 17:00 WIB') && !availableSameDay.includes('08:00 - 10:00 WIB'), 'filterAvailableDeliverySlots correctly filters out 08:00 slot on earliest delivery day');

  console.log('\n==================================================');
  console.log(`OPERATIONAL SLA BOUNDARY SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runOperationalSlaBoundaryTests();
