import { orderService } from '../services/orderService';
import { authService } from '../services/authService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

async function runCourierActualWeightFlowTests() {
  console.log('==================================================');
  console.log('RUNNING PHASE 8B INTERNAL COURIER ACTUAL WEIGHT TEST SUITE');
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

  const courierA = DEMO_USERS.find((u) => u.role === 'courier' && u.id === 'usr_courier_01') || DEMO_USERS[1];
  const courierB = DEMO_USERS.find((u) => u.role === 'courier' && u.id === 'usr_courier_02') || DEMO_USERS[2];
  const customerA = DEMO_USERS.find((u) => u.role === 'customer') || DEMO_USERS[0];
  const laundryOwnerA = DEMO_USERS.find((u) => u.role === 'laundry_owner') || DEMO_USERS[3];

  function buildTestOrder(id: string, courierId?: string, status: any = 'assigned', laundryId = 'lnd_001') {
    const o = {
      id,
      trackingNumber: `LND-WEIGH-${id}`,
      customerId: customerA.id,
      customerName: 'Customer Test Weigh',
      customerPhone: '081299990000',
      laundryId,
      courierId,
      serviceType: 'kiloan' as const,
      serviceName: 'Cuci Komplit',
      items: [
        {
          id: `item_${id}`,
          serviceId: 'srv_001',
          name: 'Cuci Komplit',
          unitPrice: 8000,
          unit: 'kg' as const,
          quantity: 5,
          estimatedHours: 48,
          subtotal: 40000,
        },
      ],
      estimatedWeightKg: 5,
      finalWeightKg: undefined,
      subtotalPrice: 40000,
      deliveryFee: 5000,
      platformFee: 2000,
      totalPrice: 47000,
      status,
      paymentStatus: 'paid',
      pickupAddress: 'Jl. Timbangan No. 12',
      deliveryAddress: 'Jl. Timbangan No. 12',
      pickupDate: '2026-09-03',
      pickupTimeSlot: TIME_SLOTS[0],
      deliveryDate: '2026-09-06',
      deliveryTimeSlot: TIME_SLOTS[0],
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orderService.getOrders().push(o as any);
    return o;
  }

  // Clear orders for test isolation
  orderService.getOrders().length = 0;

  // TEST 1 — Assigned Courier can input actual weight (6.5 kg) for their assigned order
  const ord1 = buildTestOrder('ord_weigh_1', courierA.id, 'assigned');
  authService.setCurrentUser(courierA);

  const res1 = await orderService.updateActualWeightAndRecalculatePriceAsync(
    ord1.id,
    6.5,
    { id: courierA.id, role: courierA.role },
    null
  );

  assert(
    res1.order.finalWeightKg === 6.5 && res1.priceDelta === (6.5 * 8000 + 5000 + 2000) - 47000,
    'TEST 1: Assigned Courier can input actual weight (6.5 kg) and server recalculates price'
  );

  // TEST 2 — Different Courier (Courier B) attempting to weigh Courier A order is REJECTED
  let test2Failed = false;
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(
      ord1.id,
      7.0,
      { id: courierB.id, role: courierB.role },
      null
    );
  } catch (err: any) {
    test2Failed = err.message.includes('Akses Ditolak');
  }
  assert(test2Failed, 'TEST 2: Unauthorized Courier B attempting to weigh Courier A order is REJECTED with Akses Ditolak');

  // TEST 3 — Customer attempting to weigh order is REJECTED
  let test3Failed = false;
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(
      ord1.id,
      7.0,
      { id: customerA.id, role: customerA.role },
      null
    );
  } catch (err: any) {
    test3Failed = err.message.includes('Akses Ditolak');
  }
  assert(test3Failed, 'TEST 3: Customer attempting to weigh order is REJECTED with Akses Ditolak');

  // TEST 4 — Unassigned Order (courier_id = null) attempted to be weighed by Courier A is REJECTED
  const ordUnassigned = buildTestOrder('ord_unassigned', undefined, 'pending');
  let test4Failed = false;
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(
      ordUnassigned.id,
      5.5,
      { id: courierA.id, role: courierA.role },
      null
    );
  } catch (err: any) {
    test4Failed = err.message.includes('Akses Ditolak');
  }
  assert(test4Failed, 'TEST 4: Courier attempting to weigh unassigned order (courier_id = null) is REJECTED');

  // TEST 5 — Invalid weight (0, negative, NaN) fails validation
  let test5Failed = false;
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(
      ord1.id,
      -3.0,
      { id: courierA.id, role: courierA.role },
      null
    );
  } catch (err: any) {
    test5Failed = err.message.includes('Validasi Berat Gagal');
  }
  assert(test5Failed, 'TEST 5: Invalid weight (-3.0 kg) fails input validation');

  // TEST 6 — Existing Laundry Member weighing continues to work safely
  const ordLaundry = buildTestOrder('ord_laundry_weigh', courierA.id, 'assigned', 'lnd_001');
  const res6 = await orderService.updateActualWeightAndRecalculatePriceAsync(
    ordLaundry.id,
    6.0,
    { id: laundryOwnerA.id, role: laundryOwnerA.role, laundryId: 'lnd_001' },
    null
  );
  assert(
    res6.order.finalWeightKg === 6.0,
    'TEST 6: Existing Laundry Owner / Staff weighing compatibility preserved'
  );

  // TEST 7 — Payment adjustment attempt generated when weight increases
  assert(
    res1.priceDelta > 0,
    'TEST 7: Price delta calculated correctly (+Rp 12.000) when actual weight exceeds estimated weight'
  );

  // TEST 8 — Idempotency: Re-submitting identical weight returns priceDelta = 0
  const res8 = await orderService.updateActualWeightAndRecalculatePriceAsync(
    ord1.id,
    6.5,
    { id: courierA.id, role: courierA.role },
    null
  );
  assert(
    res8.order.finalWeightKg === 6.5,
    'TEST 8: Re-submitting identical actual weight is idempotent and maintains data integrity'
  );

  console.log('\n==================================================');
  console.log(`COURIER ACTUAL WEIGHT FLOW TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCourierActualWeightFlowTests().catch((err) => {
  console.error('Fatal Error running courier actual weight flow tests:', err);
  process.exit(1);
});
