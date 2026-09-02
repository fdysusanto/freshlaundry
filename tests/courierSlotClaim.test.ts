import { orderService } from '../services/orderService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

async function runCourierSlotClaimTests() {
  console.log('==================================================');
  console.log('RUNNING ATOMIC SLOT COURIER JOB CLAIM SUITE (10 SCENARIOS)');
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

  const courierA = DEMO_USERS.find((u) => u.role === 'courier' && u.id === 'usr_courier_01') || DEMO_USERS[1];
  const courierB = DEMO_USERS.find((u) => u.role === 'courier' && u.id === 'usr_courier_02') || DEMO_USERS[2];

  const dateToday = '2026-09-05';
  const slot1 = TIME_SLOTS[0]; // '08:00 - 10:00 WIB'
  const slot2 = TIME_SLOTS[1]; // '11:00 - 14:00 WIB'

  // Helper to build test candidate orders in mock store
  function buildCandidateOrder(id: string, pickupDate: string, pickupSlot: string, status: any = 'pending', paymentStatus: any = 'paid', courierId?: string) {
    const o = {
      id,
      trackingNumber: `LND-CLAIM-${id}`,
      customerId: 'usr_customer_01',
      customerName: 'Customer Test',
      customerPhone: '081234567890',
      laundryId: 'lnd_001',
      courierId,
      serviceType: 'kiloan' as const,
      serviceName: 'Cuci Komplit',
      items: [{ id: `item_${id}`, serviceId: 'srv_001', name: 'Cuci Komplit', unitPrice: 8000, unit: 'kg' as const, quantity: 5, estimatedHours: 48 }],
      subtotalPrice: 40000,
      deliveryFee: 0,
      platformFee: 2000,
      totalPrice: 42000,
      status,
      paymentStatus,
      pickupAddress: 'Jl. Test Slot Claim',
      deliveryAddress: 'Jl. Test Slot Claim',
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

  // Clear existing orders for clean isolation
  orderService.getOrders().length = 0;

  // TEST 1 — Claim Before Window (07:44:59 WIB for 08:00 slot -> REJECTED)
  buildCandidateOrder('ord_claim_t1', dateToday, slot1);
  await assertThrowsAsync(
    async () => {
      await orderService.claimSlotJobBatchAsync(
        courierA.id,
        dateToday,
        'pickup',
        slot1,
        5,
        `${dateToday}T07:44:59.999+07:00`
      );
    },
    'SLOT_CLAIM_NOT_YET_OPEN',
    'TEST 1: Claim at 07:44:59 WIB (before 07:45 window) -> REJECTED with SLOT_CLAIM_NOT_YET_OPEN'
  );

  // TEST 2 — Claim Exactly At Window (07:45:00 WIB for 08:00 slot -> ALLOWED)
  const res2 = await orderService.claimSlotJobBatchAsync(
    courierA.id,
    dateToday,
    'pickup',
    slot1,
    5,
    `${dateToday}T07:45:00.000+07:00`
  );
  assert(res2.success === true && res2.claimedCount === 1, 'TEST 2: Claim exactly at 07:45:00 WIB -> ALLOWED (1 order claimed)');

  // Clear orders store for capacity test
  orderService.getOrders().length = 0;

  // TEST 3 — Claim Maximum Capacity (8 available orders -> Courier A gets 5, 3 remaining)
  const pool8: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const ord = buildCandidateOrder(`ord_cap_${i}`, dateToday, slot1);
    pool8.push(ord.id);
  }

  const res3 = await orderService.claimSlotJobBatchAsync(
    courierA.id,
    dateToday,
    'pickup',
    slot1,
    5,
    `${dateToday}T07:45:00+07:00`
  );
  assert(res3.claimedCount === 5, 'TEST 3: Courier A claims 8-order pool -> gets MAX 5 orders');
  assert(res3.claimedOrderIds.length === 5, 'TEST 3: Exactly 5 order IDs returned in claimed payload');

  // TEST 4 — Second Courier Claim (Courier B claims remaining 3 orders)
  const res4 = await orderService.claimSlotJobBatchAsync(
    courierB.id,
    dateToday,
    'pickup',
    slot1,
    5,
    `${dateToday}T07:45:00+07:00`
  );
  assert(res4.claimedCount === 3, 'TEST 4: Courier B claims remaining 3 orders');
  assert(
    !res4.claimedOrderIds.some((id) => res3.claimedOrderIds.includes(id)),
    'TEST 4: Courier B claimed order IDs are completely disjoint from Courier A claimed orders'
  );

  // TEST 5 — Empty Pool (0 available orders -> Returns 0 claimed orders)
  const res5 = await orderService.claimSlotJobBatchAsync(
    courierB.id,
    dateToday,
    'pickup',
    slot1,
    5,
    `${dateToday}T07:45:00+07:00`
  );
  assert(res5.success === true && res5.claimedCount === 0, 'TEST 5: Claiming empty pool returns success = true, claimedCount = 0');

  // TEST 6 — Concurrency Safety (Simulate simultaneous claim calls)
  orderService.getOrders().length = 0;
  for (let i = 1; i <= 8; i++) {
    buildCandidateOrder(`ord_conc_${i}`, dateToday, slot1);
  }

  const [concA, concB] = await Promise.all([
    orderService.claimSlotJobBatchAsync(courierA.id, dateToday, 'pickup', slot1, 5, `${dateToday}T07:45:00+07:00`),
    orderService.claimSlotJobBatchAsync(courierB.id, dateToday, 'pickup', slot1, 5, `${dateToday}T07:45:00+07:00`),
  ]);

  const overlap = concA.claimedOrderIds.filter((id) => concB.claimedOrderIds.includes(id));
  assert(overlap.length === 0, 'TEST 6: Concurrent claims result in ZERO duplicate order assignments (no overlap)');
  assert(concA.claimedCount + concB.claimedCount === 8, 'TEST 6: Total claimed across both couriers equals 8 (5 + 3)');

  // TEST 7 — Capacity Isolation by Time Slot (Courier A claims 5 in Slot 1, then claims Slot 2 -> ALLOWED)
  orderService.getOrders().length = 0;
  for (let i = 1; i <= 5; i++) {
    buildCandidateOrder(`ord_slot2_${i}`, dateToday, slot2);
  }

  const res7 = await orderService.claimSlotJobBatchAsync(
    courierA.id,
    dateToday,
    'pickup',
    slot2,
    5,
    `${dateToday}T10:45:00+07:00`
  );
  assert(res7.claimedCount === 5, 'TEST 7: Courier A claiming a different time slot (11:00 - 14:00) -> ALLOWED (5 orders claimed)');

  // TEST 8 — Job Type Isolation (Courier A claims Delivery slot job for same date/slot -> ALLOWED)
  orderService.getOrders().length = 0;
  for (let i = 1; i <= 3; i++) {
    const ordDeliv = buildCandidateOrder(`ord_deliv_${i}`, dateToday, slot1, 'ready_for_delivery');
    ordDeliv.deliveryDate = dateToday;
    ordDeliv.deliveryTimeSlot = slot1;
  }

  const res8 = await orderService.claimSlotJobBatchAsync(
    courierA.id,
    dateToday,
    'delivery',
    slot1,
    5,
    `${dateToday}T07:45:00+07:00`
  );
  assert(res8.claimedCount === 3, 'TEST 8: Courier A claiming Delivery job type for same date/slot -> ALLOWED (3 delivery orders claimed)');

  // TEST 9 — Existing Assignment Protection (Order already has courier_id -> NOT CLAIMABLE)
  orderService.getOrders().length = 0;
  buildCandidateOrder('ord_assigned_already', dateToday, slot1, 'assigned', 'paid', courierB.id);

  const res9 = await orderService.claimSlotJobBatchAsync(
    courierA.id,
    dateToday,
    'pickup',
    slot1,
    5,
    `${dateToday}T07:45:00+07:00`
  );
  assert(res9.claimedCount === 0, 'TEST 9: Pre-assigned order (courier_id IS NOT NULL) is NOT claimable by Courier A');

  // TEST 10 — Duplicate Claim & Capacity Enforcement (Courier A at capacity 5 tries to claim again -> REJECTED)
  orderService.getOrders().length = 0;
  for (let i = 1; i <= 5; i++) {
    buildCandidateOrder(`ord_dup_${i}`, dateToday, slot1, 'assigned', 'paid', courierA.id);
  }
  buildCandidateOrder('ord_dup_6', dateToday, slot1, 'pending', 'paid'); // 6th order unassigned

  await assertThrowsAsync(
    async () => {
      await orderService.claimSlotJobBatchAsync(
        courierA.id,
        dateToday,
        'pickup',
        slot1,
        5,
        `${dateToday}T07:45:00+07:00`
      );
    },
    'MAX_CAPACITY_REACHED',
    'TEST 10: Courier A with 5 claimed orders in same slot attempting duplicate claim -> REJECTED with MAX_CAPACITY_REACHED'
  );

  console.log('\n==================================================');
  console.log(`ATOMIC SLOT COURIER JOB CLAIM TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCourierSlotClaimTests().catch((err) => {
  console.error('Fatal Error running courier slot claim tests:', err);
  process.exit(1);
});
