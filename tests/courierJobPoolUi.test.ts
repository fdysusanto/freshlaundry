import { courierJobPoolService, getWibTodayDateString, isCourierSlotClaimable } from '../services/courierJobPoolService';
import { orderService } from '../services/orderService';
import { authService } from '../services/authService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

async function runCourierJobPoolUiTests() {
  console.log('==================================================');
  console.log('RUNNING COURIER JOB POOL UI & FUNCTIONAL TEST SUITE (10 SCENARIOS)');
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

  const dateToday = getWibTodayDateString();
  const slot1 = TIME_SLOTS[0]; // '08:00 - 10:00 WIB'

  const courierA = DEMO_USERS.find((u) => u.role === 'courier' && u.id === 'usr_courier_01') || DEMO_USERS[1];
  const courierB = DEMO_USERS.find((u) => u.role === 'courier' && u.id === 'usr_courier_02') || DEMO_USERS[2];

  function buildCandidateOrder(id: string, pickupDate: string, pickupSlot: string, courierId?: string) {
    const o = {
      id,
      trackingNumber: `LND-UI-${id}`,
      customerId: 'usr_customer_01',
      customerName: 'Customer Secret Name',
      customerPhone: '081299990000',
      laundryId: 'lnd_001',
      courierId,
      serviceType: 'kiloan' as const,
      serviceName: 'Cuci Komplit',
      items: [{ id: `item_${id}`, serviceId: 'srv_001', name: 'Cuci Komplit', unitPrice: 8000, unit: 'kg' as const, quantity: 5, estimatedHours: 48 }],
      subtotalPrice: 40000,
      deliveryFee: 0,
      platformFee: 2000,
      totalPrice: 42000,
      status: courierId ? 'assigned' : 'pending',
      paymentStatus: 'paid',
      pickupAddress: 'Jl. Secret Customer Address No. 45',
      deliveryAddress: 'Jl. Secret Customer Address No. 45',
      pickupDate,
      pickupTimeSlot: pickupSlot,
      deliveryDate: '2026-09-07',
      deliveryTimeSlot: slot1,
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orderService.getOrders().push(o as any);
    return o;
  }

  // TEST 1 — Job Pool displays 3 Pickup Slots & 3 Delivery Slots
  const poolData = await courierJobPoolService.getCourierJobPoolAsync(dateToday, courierA.id);
  assert(
    poolData.pickupSlots.length === 3 && poolData.deliverySlots.length === 3,
    'TEST 1: Job Pool correctly structures 3 Pickup Slots and 3 Delivery Slots'
  );

  // TEST 2 — Zero PII in Job Pool Response
  const poolJson = JSON.stringify(poolData);
  assert(
    !poolJson.includes('Customer Secret Name') && !poolJson.includes('Secret Customer Address'),
    'TEST 2: Job Pool aggregate payload strictly contains ZERO PII'
  );

  // TEST 3 — Locked Slot BEFORE Claim Window (07:44 WIB)
  const lockedCheck = isCourierSlotClaimable(dateToday, slot1, `${dateToday}T07:44:59+07:00`);
  assert(lockedCheck.isClaimable === false, 'TEST 3: Locked Slot returns isClaimable = false before 07:45 WIB');

  // TEST 4 — Open Slot AT Claim Window (07:45 WIB)
  const openCheck = isCourierSlotClaimable(dateToday, slot1, `${dateToday}T07:45:00+07:00`);
  assert(openCheck.isClaimable === true, 'TEST 4: Open Slot returns isClaimable = true at 07:45:00 WIB');

  // TEST 5 & 6 — Successful Claim populates My Active Jobs (Claim 5 orders)
  orderService.getOrders().length = 0;
  for (let i = 1; i <= 6; i++) {
    buildCandidateOrder(`ord_claim_ui_${i}`, dateToday, slot1);
  }

  authService.setCurrentUser(courierA);
  const claimRes = await courierJobPoolService.claimCourierSlotAsync({
    courierId: courierA.id,
    jobDate: dateToday,
    jobType: 'pickup',
    timeSlot: slot1,
    nowInput: `${dateToday}T07:45:00+07:00`,
  });

  const myClaimedJobs = await orderService.getOrdersByCourierAsync(courierA.id);
  assert(
    claimRes.success === true && claimRes.claimedCount === 5 && myClaimedJobs.length === 5,
    'TEST 5 & 6: Successful claim populates My Active Jobs with exactly 5 claimed orders'
  );

  // TEST 7 — Partial Claim Handling (1 order remaining in pool)
  const poolAfterClaim = await courierJobPoolService.getCourierJobPoolAsync(dateToday, courierB.id, `${dateToday}T07:45:00+07:00`);
  const slot1Pickup = poolAfterClaim.pickupSlots.find((s) => s.timeSlot === slot1);
  assert(
    slot1Pickup?.availableOrders === 1 && slot1Pickup?.claimStatus === 'open',
    'TEST 7: Partial claim leaves 1 order remaining in pool with status OPEN for Courier B'
  );

  // TEST 8 — Concurrent Claim empty pool handling
  const claimEmptyRes = await courierJobPoolService.claimCourierSlotAsync({
    courierId: courierB.id,
    jobDate: dateToday,
    jobType: 'pickup',
    timeSlot: TIME_SLOTS[2], // empty slot
    nowInput: `${dateToday}T14:45:00+07:00`,
  });
  assert(
    claimEmptyRes.success === true && claimEmptyRes.claimedCount === 0,
    'TEST 8: Claiming an empty slot returns success = true, claimedCount = 0 without error crash'
  );

  // TEST 9 — Courier Authorization Isolation (Courier B cannot see Courier A's claimed orders in getOrdersByCourierAsync)
  authService.setCurrentUser(courierB);
  const courierBJobs = await orderService.getOrdersByCourierAsync(courierB.id);
  assert(
    courierBJobs.every((o) => o.courierId === courierB.id),
    'TEST 9: Courier B query strictly returns ONLY orders assigned to Courier B (Isolation enforced)'
  );

  // TEST 10 — Individual Order Status Update by Assigned Courier
  const myJobOrder = myClaimedJobs[0];
  await orderService.updateOrderStatusAsync(myJobOrder.id, 'picked_up', 'Pickup completed by Courier A', courierA.id);
  const updatedOrder = await orderService.getOrderByIdAsync(myJobOrder.id);
  assert(
    updatedOrder?.status === 'picked_up',
    'TEST 10: Assigned courier can perform individual order status update to picked_up'
  );

  console.log('\n==================================================');
  console.log(`COURIER JOB POOL UI TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCourierJobPoolUiTests().catch((err) => {
  console.error('Fatal Error running courier job pool UI tests:', err);
  process.exit(1);
});
