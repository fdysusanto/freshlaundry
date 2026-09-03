import { courierJobPoolService, getWibTodayDateString } from '../services/courierJobPoolService';
import { orderService } from '../services/orderService';
import { authService } from '../services/authService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

async function runCourierSlotClaimDateTypeTests() {
  console.log('==================================================');
  console.log('RUNNING PHASE 7G DATE TYPE MISMATCH REGRESSION SUITE');
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
  const slot1 = TIME_SLOTS[0];

  const courierA = DEMO_USERS.find((u) => u.role === 'courier' && u.id === 'usr_courier_01') || DEMO_USERS[1];

  function buildCandidateOrder(id: string, pickupDate: string, pickupSlot: string, isDelivery = false) {
    const o = {
      id,
      trackingNumber: `LND-DATE-${id}`,
      customerId: 'usr_customer_01',
      customerName: 'Customer Test Date',
      customerPhone: '081299990000',
      laundryId: 'lnd_001',
      courierId: undefined,
      serviceType: 'kiloan' as const,
      serviceName: 'Cuci Komplit',
      items: [{ id: `item_${id}`, serviceId: 'srv_001', name: 'Cuci Komplit', unitPrice: 8000, unit: 'kg' as const, quantity: 5, estimatedHours: 48 }],
      subtotalPrice: 40000,
      deliveryFee: 0,
      platformFee: 2000,
      totalPrice: 42000,
      status: isDelivery ? 'ready_for_delivery' : 'pending',
      paymentStatus: 'paid',
      pickupAddress: 'Jl. Date Test Address No. 12',
      deliveryAddress: 'Jl. Date Test Address No. 12',
      pickupDate,
      pickupTimeSlot: pickupSlot,
      deliveryDate: pickupDate,
      deliveryTimeSlot: pickupSlot,
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orderService.getOrders().push(o as any);
    return o;
  }

  // Clear orders
  orderService.getOrders().length = 0;
  buildCandidateOrder('ord_date_pickup_1', dateToday, slot1, false);
  buildCandidateOrder('ord_date_deliv_1', dateToday, slot1, true);

  authService.setCurrentUser(courierA);

  // TEST 1 — Pickup Slot Claim Parameter Payload Format (p_job_date string format "YYYY-MM-DD")
  const pickupRes = await courierJobPoolService.claimCourierSlotAsync({
    courierId: courierA.id,
    jobDate: dateToday,
    jobType: 'pickup',
    timeSlot: slot1,
    nowInput: `${dateToday}T07:45:00+07:00`,
  });

  assert(
    pickupRes.success === true && pickupRes.claimedCount === 1,
    'TEST 1: Pickup claim path successfully processes string date payload (p_job_date: "YYYY-MM-DD")'
  );

  // TEST 2 — Delivery Slot Claim Parameter Payload Format
  const deliveryRes = await courierJobPoolService.claimCourierSlotAsync({
    courierId: courierA.id,
    jobDate: dateToday,
    jobType: 'delivery',
    timeSlot: slot1,
    nowInput: `${dateToday}T07:45:00+07:00`,
  });

  assert(
    deliveryRes.success === true && deliveryRes.claimedCount === 1,
    'TEST 2: Delivery claim path successfully processes string date payload (p_job_date: "YYYY-MM-DD")'
  );

  // TEST 3 — Capacity Limit 5 Enforcement
  orderService.getOrders().length = 0;
  for (let i = 1; i <= 6; i++) {
    buildCandidateOrder(`ord_cap_${i}`, dateToday, slot1, false);
  }

  const capRes = await courierJobPoolService.claimCourierSlotAsync({
    courierId: courierA.id,
    jobDate: dateToday,
    jobType: 'pickup',
    timeSlot: slot1,
    nowInput: `${dateToday}T07:45:00+07:00`,
  });

  assert(
    capRes.success === true && capRes.claimedCount === 5,
    'TEST 3: Claim slot capacity strictly caps claimed orders to maximum 5 orders'
  );

  console.log('\n==================================================');
  console.log(`COURIER SLOT CLAIM DATE TYPE TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCourierSlotClaimDateTypeTests().catch((err) => {
  console.error('Fatal Error running courier slot claim date type tests:', err);
  process.exit(1);
});
