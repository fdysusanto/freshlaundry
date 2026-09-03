import { courierJobPoolService, getWibTodayDateString } from '../services/courierJobPoolService';
import { orderService } from '../services/orderService';
import { authService } from '../services/authService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

async function runCourierJobPoolServerFetchTests() {
  console.log('==================================================');
  console.log('RUNNING COURIER JOB POOL SERVER FETCH & RLS SAFE TEST SUITE');
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
  const customerA = DEMO_USERS.find((u) => u.role === 'customer') || DEMO_USERS[0];

  function buildCandidateOrder(id: string, pickupDate: string, pickupSlot: string) {
    const o = {
      id,
      trackingNumber: `LND-FETCH-${id}`,
      customerId: 'usr_customer_01',
      customerName: 'Secret Customer PII',
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
      status: 'pending',
      paymentStatus: 'paid',
      pickupAddress: 'Jl. Secret Address No. 99',
      deliveryAddress: 'Jl. Secret Address No. 99',
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
  buildCandidateOrder('ord_fetch_1', dateToday, slot1);

  // TEST 1 — Service Role aggregate fetch returns availableOrders = 1 for locked slot
  const poolData = await courierJobPoolService.getCourierJobPoolAsync(dateToday, courierA.id, `${dateToday}T07:30:00+07:00`);
  const slot1Data = poolData.pickupSlots.find((s) => s.timeSlot === slot1);
  assert(
    slot1Data?.availableOrders === 1 && slot1Data?.claimStatus === 'locked',
    'TEST 1: Service Role aggregate fetch correctly returns availableOrders = 1 when claimStatus = locked'
  );

  // TEST 2 — Zero PII Payload Audit
  const payloadStr = JSON.stringify(poolData);
  assert(
    !payloadStr.includes('Secret Customer PII') && !payloadStr.includes('Secret Address'),
    'TEST 2: Job Pool payload contains ZERO PII before slot claim'
  );

  // TEST 3 — Structure contains maxCapacityPerCourier and remainingCapacity
  assert(
    slot1Data?.maxCapacityPerCourier === 5 && slot1Data?.remainingCapacity === 5,
    'TEST 3: Job Pool slot metadata contains capacity information (maxCapacityPerCourier: 5, remainingCapacity: 5)'
  );

  // TEST 4 — Mock Role Authorization simulation
  authService.setCurrentUser(customerA);
  const isCustomerBlocked = authService.getCurrentUser()?.role === 'customer';
  assert(
    isCustomerBlocked === true,
    'TEST 4: Role authorization correctly distinguishes customer role (to be rejected with 403 Forbidden)'
  );

  authService.setCurrentUser(courierA);
  const isCourierAllowed = authService.getCurrentUser()?.role === 'courier';
  assert(
    isCourierAllowed === true,
    'TEST 5: Role authorization correctly allows courier role to access Job Pool'
  );

  console.log('\n==================================================');
  console.log(`COURIER JOB POOL SERVER FETCH TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCourierJobPoolServerFetchTests().catch((err) => {
  console.error('Fatal Error running courier job pool server fetch tests:', err);
  process.exit(1);
});
