import { courierJobPoolService, isCourierSlotClaimable } from '../services/courierJobPoolService';
import { orderService } from '../services/orderService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

async function runCourierJobPoolServiceTests() {
  console.log('==================================================');
  console.log('RUNNING COURIER JOB POOL SERVICE TEST SUITE');
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

  const dateToday = '2026-09-05';
  const slot1 = TIME_SLOTS[0]; // '08:00 - 10:00 WIB'
  const slot2 = TIME_SLOTS[1]; // '11:00 - 14:00 WIB'

  function buildTestOrder(id: string, pickupDate: string, pickupSlot: string, status: any = 'pending', paymentStatus: any = 'paid', courierId?: string) {
    const o = {
      id,
      trackingNumber: `LND-POOL-${id}`,
      customerId: 'usr_customer_01',
      customerName: 'Customer Sensitive PII',
      customerPhone: '081299998888',
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
      pickupAddress: 'Jl. Sensitive Customer Address No. 123',
      deliveryAddress: 'Jl. Sensitive Customer Address No. 123',
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

  // Clear orders for isolation
  orderService.getOrders().length = 0;

  // TEST 1 — Pickup Job Pool Aggregation (8 available orders for 08:00 slot -> availableOrders = 8)
  for (let i = 1; i <= 8; i++) {
    buildTestOrder(`ord_pool_p_${i}`, dateToday, slot1);
  }

  const pool1 = await courierJobPoolService.getCourierJobPoolAsync(dateToday, undefined, `${dateToday}T07:45:00+07:00`);
  const slot1Pickup = pool1.pickupSlots.find((s) => s.timeSlot === slot1);
  assert(slot1Pickup !== undefined && slot1Pickup.availableOrders === 8, 'TEST 1: Pickup Job Pool aggregates exactly 8 available orders for slot 08:00 - 10:00');

  // TEST 2 — Delivery Job Pool Aggregation (Only ready_for_delivery orders included)
  orderService.getOrders().length = 0;
  for (let i = 1; i <= 3; i++) {
    const oDeliv = buildTestOrder(`ord_pool_d_${i}`, dateToday, slot1, 'ready_for_delivery');
    oDeliv.deliveryDate = dateToday;
    oDeliv.deliveryTimeSlot = slot1;
  }

  const pool2 = await courierJobPoolService.getCourierJobPoolAsync(dateToday, undefined, `${dateToday}T07:45:00+07:00`);
  const slot1Delivery = pool2.deliverySlots.find((s) => s.timeSlot === slot1);
  assert(slot1Delivery !== undefined && slot1Delivery.availableOrders === 3, 'TEST 2: Delivery Job Pool aggregates exactly 3 ready_for_delivery orders');

  // TEST 3 — Unpaid Orders Excluded from Job Pool
  orderService.getOrders().length = 0;
  buildTestOrder('ord_unpaid', dateToday, slot1, 'pending', 'unpaid');

  const pool3 = await courierJobPoolService.getCourierJobPoolAsync(dateToday, undefined, `${dateToday}T07:45:00+07:00`);
  const slot1Unpaid = pool3.pickupSlots.find((s) => s.timeSlot === slot1);
  assert(slot1Unpaid?.availableOrders === 0, 'TEST 3: Unpaid orders (paymentStatus !== "paid") EXCLUDED from Job Pool');

  // TEST 4 — Already Assigned Orders Excluded from Job Pool
  orderService.getOrders().length = 0;
  buildTestOrder('ord_assigned', dateToday, slot1, 'assigned', 'paid', 'usr_courier_01');

  const pool4 = await courierJobPoolService.getCourierJobPoolAsync(dateToday, undefined, `${dateToday}T07:45:00+07:00`);
  const slot1Assigned = pool4.pickupSlots.find((s) => s.timeSlot === slot1);
  assert(slot1Assigned?.availableOrders === 0, 'TEST 4: Already assigned orders (courier_id IS NOT NULL) EXCLUDED from Job Pool');

  // TEST 5 — Different Date Excluded
  orderService.getOrders().length = 0;
  buildTestOrder('ord_tomorrow', '2026-09-06', slot1);

  const pool5 = await courierJobPoolService.getCourierJobPoolAsync(dateToday, undefined, `${dateToday}T07:45:00+07:00`);
  const slot1DiffDate = pool5.pickupSlots.find((s) => s.timeSlot === slot1);
  assert(slot1DiffDate?.availableOrders === 0, 'TEST 5: Orders from different date EXCLUDED from current date Job Pool');

  // TEST 6 — Different Time Slots Grouped Correctly
  orderService.getOrders().length = 0;
  buildTestOrder('ord_s1_a', dateToday, slot1);
  buildTestOrder('ord_s1_b', dateToday, slot1);
  buildTestOrder('ord_s2_a', dateToday, slot2);

  const pool6 = await courierJobPoolService.getCourierJobPoolAsync(dateToday, undefined, `${dateToday}T07:45:00+07:00`);
  const pS1 = pool6.pickupSlots.find((s) => s.timeSlot === slot1);
  const pS2 = pool6.pickupSlots.find((s) => s.timeSlot === slot2);
  assert(pS1?.availableOrders === 2 && pS2?.availableOrders === 1, 'TEST 6: Orders grouped accurately across distinct time slots (Slot 1: 2, Slot 2: 1)');

  // TEST 7 — Claim Window Boundary LOCKED (07:44:59 WIB)
  const windowBefore = isCourierSlotClaimable(dateToday, slot1, `${dateToday}T07:44:59.999+07:00`);
  const pool7 = await courierJobPoolService.getCourierJobPoolAsync(dateToday, undefined, `${dateToday}T07:44:59.999+07:00`);
  const slot7Status = pool7.pickupSlots.find((s) => s.timeSlot === slot1)?.claimStatus;
  assert(windowBefore.isClaimable === false && slot7Status === 'locked', 'TEST 7: At 07:44:59 WIB (before 07:45 cutoff), slot status is LOCKED');

  // TEST 8 — Claim Window Boundary OPEN (07:45:00 WIB)
  const windowOpen = isCourierSlotClaimable(dateToday, slot1, `${dateToday}T07:45:00.000+07:00`);
  const pool8 = await courierJobPoolService.getCourierJobPoolAsync(dateToday, undefined, `${dateToday}T07:45:00.000+07:00`);
  const slot8Status = pool8.pickupSlots.find((s) => s.timeSlot === slot1)?.claimStatus;
  assert(windowOpen.isClaimable === true && slot8Status === 'open', 'TEST 8: At 07:45:00 WIB (exactly 15 mins before slot), slot status is OPEN');

  // TEST 9 — PII Protection Audit (Response MUST NOT contain PII properties)
  const poolJson = JSON.stringify(pool6);
  const containsPiiName = poolJson.includes('Customer Sensitive PII');
  const containsPiiAddress = poolJson.includes('Sensitive Customer Address');
  const containsPiiPhone = poolJson.includes('081299998888');
  assert(
    !containsPiiName && !containsPiiAddress && !containsPiiPhone,
    'TEST 9: Job Pool Response DOES NOT contain customer PII (Name, Address, Phone are strictly absent)'
  );

  console.log('\n==================================================');
  console.log(`COURIER JOB POOL SERVICE TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCourierJobPoolServiceTests().catch((err) => {
  console.error('Fatal Error running courier job pool service tests:', err);
  process.exit(1);
});
