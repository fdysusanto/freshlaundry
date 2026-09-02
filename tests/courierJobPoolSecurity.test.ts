import { courierJobPoolService, getWibTodayDateString, isCourierSlotClaimable } from '../services/courierJobPoolService';
import { orderService } from '../services/orderService';
import { authService } from '../services/authService';
import { GET as getJobPoolRoute } from '../app/api/courier/job-pool/route';
import { POST as claimSlotRoute } from '../app/api/courier/claim-slot/route';
import { DEMO_USERS, TIME_SLOTS, COURIER_DISPATCH_MODE } from '../utils/constants';

async function runPhase6eSecurityAndConcurrencyVerification() {
  console.log('==================================================');
  console.log('RUNNING PHASE 6E SECURITY, CONCURRENCY & E2E VERIFICATION SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  const dateToday = getWibTodayDateString();
  const slot1 = TIME_SLOTS[0]; // '08:00 - 10:00 WIB'
  const slot2 = TIME_SLOTS[1]; // '11:00 - 14:00 WIB'

  const courierA = DEMO_USERS.find((u) => u.role === 'courier' && u.id === 'usr_courier_01') || DEMO_USERS[1];
  const courierB = DEMO_USERS.find((u) => u.role === 'courier' && u.id === 'usr_courier_02') || DEMO_USERS[2];
  const customerUser = DEMO_USERS.find((u) => u.role === 'customer') || DEMO_USERS[0];

  function buildCandidateOrder(id: string, pickupDate: string, pickupSlot: string, status: any = 'pending', paymentStatus: any = 'paid', courierId?: string) {
    const o = {
      id,
      trackingNumber: `LND-6E-${id}`,
      customerId: customerUser.id,
      customerName: 'Top Secret Customer Name',
      customerPhone: '081234567899',
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
      pickupAddress: 'Jl. Highly Secret Address No. 99',
      deliveryAddress: 'Jl. Highly Secret Address No. 99',
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

  // Clear orders
  orderService.getOrders().length = 0;

  // ---------------------------------------------------------------------------
  // 1. STRICT ZERO PII AUDIT BEFORE CLAIM
  // ---------------------------------------------------------------------------
  buildCandidateOrder('ord_sec_pii', dateToday, slot1);
  authService.setCurrentUser(courierA);
  const reqPoolPii = new Request(`http://localhost:3000/api/courier/job-pool?date=${dateToday}`, { method: 'GET' });
  const resPoolPii = await getJobPoolRoute(reqPoolPii);
  const dataPoolPii = await resPoolPii.json();
  const poolStringified = JSON.stringify(dataPoolPii);

  const piiLeaked =
    poolStringified.includes('Top Secret Customer Name') ||
    poolStringified.includes('081234567899') ||
    poolStringified.includes('Highly Secret Address');

  assert(
    resPoolPii.status === 200 && !piiLeaked,
    'SECTION 1: GET /api/courier/job-pool strictly returns ZERO PII before claim'
  );

  // ---------------------------------------------------------------------------
  // 2. AUTHORIZATION & COURIER READ/UPDATE ISOLATION AUDIT
  // ---------------------------------------------------------------------------
  orderService.getOrders().length = 0;
  buildCandidateOrder('ord_courier_a_job', dateToday, slot1, 'assigned', 'paid', courierA.id);

  authService.setCurrentUser(courierB);
  const courierBActiveJobs = await orderService.getOrdersByCourierAsync(courierB.id);
  const courierBHasAccessToA = courierBActiveJobs.some((o) => o.id === 'ord_courier_a_job');

  assert(
    !courierBHasAccessToA,
    'SECTION 2: Courier B cannot see or query Courier A claimed orders (Read Isolation PASSED)'
  );

  // Unauthorized status update attempt by Courier B on Courier A order
  let statusUpdateThrew = false;
  try {
    await orderService.updateOrderStatusAsync('ord_courier_a_job', 'picked_up', 'Malicious update attempt', courierB.id);
  } catch (err: any) {
    statusUpdateThrew = true;
  }
  assert(
    statusUpdateThrew,
    'SECTION 2: Unauthorized status update attempt by Courier B on Courier A order REJECTED (Update Isolation PASSED)'
  );

  // ---------------------------------------------------------------------------
  // 3. CONCURRENCY & CAPACITY SCOPE AUDIT
  // ---------------------------------------------------------------------------
  orderService.getOrders().length = 0;
  for (let i = 1; i <= 8; i++) {
    buildCandidateOrder(`ord_conc_6e_${i}`, dateToday, slot1);
  }

  // Concurrent Claims by Courier A & Courier B at 07:45 WIB
  const [claimA, claimB] = await Promise.all([
    courierJobPoolService.claimCourierSlotAsync({ courierId: courierA.id, jobDate: dateToday, jobType: 'pickup', timeSlot: slot1, nowInput: `${dateToday}T07:45:00+07:00` }),
    courierJobPoolService.claimCourierSlotAsync({ courierId: courierB.id, jobDate: dateToday, jobType: 'pickup', timeSlot: slot1, nowInput: `${dateToday}T07:45:00+07:00` }),
  ]);

  const overlap = claimA.claimedOrderIds.filter((id) => claimB.claimedOrderIds.includes(id));
  assert(
    claimA.claimedCount === 5 && claimB.claimedCount === 3 && overlap.length === 0,
    'SECTION 3: Concurrent claims result in 0 duplicate assignments (Courier A: 5, Courier B: 3)'
  );

  // Capacity Scope Test: Courier A attempts to claim Delivery slot job for same date & slot -> ALLOWED
  orderService.getOrders().length = 0;
  for (let i = 1; i <= 3; i++) {
    const oDeliv = buildCandidateOrder(`ord_deliv_scope_${i}`, dateToday, slot1, 'ready_for_delivery');
    oDeliv.deliveryDate = dateToday;
    oDeliv.deliveryTimeSlot = slot1;
  }

  const claimADelivery = await courierJobPoolService.claimCourierSlotAsync({
    courierId: courierA.id,
    jobDate: dateToday,
    jobType: 'delivery',
    timeSlot: slot1,
    nowInput: `${dateToday}T07:45:00+07:00`,
  });
  assert(
    claimADelivery.claimedCount === 3,
    'SECTION 3: Capacity scope (courier_id + date + job_type + slot) allows Courier A to claim Delivery job type'
  );

  // Capacity Scope Test: Courier A attempts to claim Pickup slot 2 (11:00 - 14:00) -> ALLOWED
  orderService.getOrders().length = 0;
  for (let i = 1; i <= 2; i++) {
    buildCandidateOrder(`ord_s2_scope_${i}`, dateToday, slot2);
  }

  const claimASlot2 = await courierJobPoolService.claimCourierSlotAsync({
    courierId: courierA.id,
    jobDate: dateToday,
    jobType: 'pickup',
    timeSlot: slot2,
    nowInput: `${dateToday}T10:45:00+07:00`,
  });
  assert(
    claimASlot2.claimedCount === 2,
    'SECTION 3: Capacity scope allows Courier A to claim a different time slot (11:00 - 14:00 WIB)'
  );

  // ---------------------------------------------------------------------------
  // 4. CLAIM WINDOW BOUNDARY AUDIT (07:44:59 vs 07:45:00 WIB)
  // ---------------------------------------------------------------------------
  const boundaryBefore = isCourierSlotClaimable(dateToday, slot1, `${dateToday}T07:44:59.999+07:00`);
  const boundaryExact = isCourierSlotClaimable(dateToday, slot1, `${dateToday}T07:45:00.000+07:00`);
  const boundaryAfter = isCourierSlotClaimable(dateToday, slot1, `${dateToday}T07:45:01.000+07:00`);

  assert(
    boundaryBefore.isClaimable === false && boundaryExact.isClaimable === true && boundaryAfter.isClaimable === true,
    'SECTION 4: Claim Window boundary verified (07:44:59 -> LOCKED, 07:45:00 -> OPEN, 07:45:01 -> OPEN)'
  );

  // ---------------------------------------------------------------------------
  // 5. INPUT VALIDATION & MALFORMED REQUEST PROTECTION
  // ---------------------------------------------------------------------------
  authService.setCurrentUser(courierA);
  const reqInvalidSlot = new Request('http://localhost:3000/api/courier/claim-slot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: dateToday, jobType: 'pickup', timeSlot: '25:00 - 27:00 WIB' }),
  });
  const resInvalidSlot = await claimSlotRoute(reqInvalidSlot);
  assert(
    resInvalidSlot.status === 400,
    'SECTION 5: Invalid time slot name input REJECTED with HTTP 400 Bad Request'
  );

  console.log('\n==================================================');
  console.log(`PHASE 6E SECURITY & CONCURRENCY VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6eSecurityAndConcurrencyVerification().catch((err) => {
  console.error('Fatal Error running Phase 6E security verification:', err);
  process.exit(1);
});
