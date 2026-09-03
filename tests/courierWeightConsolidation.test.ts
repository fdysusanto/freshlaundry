import { orderService } from '../services/orderService';
import { paymentService } from '../services/paymentService';
import { authService } from '../services/authService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

async function runCourierWeightConsolidationTests() {
  console.log('==================================================');
  console.log('RUNNING PHASE 8D INTERNAL COURIER WEIGHT CONSOLIDATION SUITE');
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
  const adminUser = DEMO_USERS.find((u) => u.role === 'admin') || { id: 'usr_admin_01', name: 'Admin', role: 'admin' };

  function buildTestOrder(id: string, courierId?: string, status: any = 'assigned', laundryId = 'lnd_001', finalWeightKg?: number) {
    const o = {
      id,
      trackingNumber: `LND-CONS-${id}`,
      customerId: customerA.id,
      customerName: 'Customer Test Cons',
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
          quantity: finalWeightKg || 5,
          estimatedHours: 48,
          subtotal: (finalWeightKg || 5) * 8000,
        },
      ],
      estimatedWeightKg: 5,
      finalWeightKg,
      subtotalPrice: (finalWeightKg || 5) * 8000,
      deliveryFee: 5000,
      platformFee: 2000,
      totalPrice: (finalWeightKg || 5) * 8000 + 5000 + 2000,
      status,
      paymentStatus: 'paid',
      pickupAddress: 'Jl. Konsolidasi No. 12',
      deliveryAddress: 'Jl. Konsolidasi No. 12',
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

  // Clear order & payment attempt store
  orderService.getOrders().length = 0;

  // TEST 1 — Assigned Courier Can Weigh
  const ord1 = buildTestOrder('ord_cons_1', courierA.id, 'assigned');
  authService.setCurrentUser(courierA);
  const res1 = await orderService.updateActualWeightAndRecalculatePriceAsync(
    ord1.id,
    6.5,
    { id: courierA.id, role: courierA.role },
    null
  );
  assert(res1.order.finalWeightKg === 6.5, 'TEST 1: Assigned Courier can input actual weight (6.5 kg)');

  // TEST 2 — Assigned Courier Can Edit Before Payment / Lock
  const res2 = await orderService.updateActualWeightAndRecalculatePriceAsync(
    ord1.id,
    7.0,
    { id: courierA.id, role: courierA.role },
    null
  );
  assert(res2.order.finalWeightKg === 7.0, 'TEST 2: Assigned Courier can edit actual weight before payment lock');

  // TEST 3 — Maximum Weight Limit (50.0 kg PASS, 50.01 kg REJECT)
  const ord3 = buildTestOrder('ord_cons_max', courierA.id, 'assigned');
  const res3Pass = await orderService.updateActualWeightAndRecalculatePriceAsync(
    ord3.id,
    50.0,
    { id: courierA.id, role: courierA.role },
    null
  );
  assert(res3Pass.order.finalWeightKg === 50.0, 'TEST 3A: Maximum weight 50.0 kg is allowed');

  let test3Reject = false;
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(
      ord3.id,
      50.01,
      { id: courierA.id, role: courierA.role },
      null
    );
  } catch (err: any) {
    test3Reject = err.message.includes('maksimal adalah 50 kg');
  }
  assert(test3Reject, 'TEST 3B: Weight exceeding 50 kg (50.01 kg) is REJECTED with server error');

  // TEST 4 — Invalid Weight (0 kg, -5.0 kg REJECT)
  let test4Reject = false;
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(
      ord3.id,
      0,
      { id: courierA.id, role: courierA.role },
      null
    );
  } catch (err: any) {
    test4Reject = err.message.includes('Validasi Berat Gagal');
  }
  assert(test4Reject, 'TEST 4: Invalid weight (0 kg) is REJECTED with server validation error');

  // TEST 5 — Paid Adjustment Immutability
  const ord5 = buildTestOrder('ord_cons_paid_adj', courierA.id, 'assigned');
  const res5Init = await orderService.updateActualWeightAndRecalculatePriceAsync(
    ord5.id,
    8.0,
    { id: courierA.id, role: courierA.role },
    null
  );
  // Simulate payment of adjustment attempt
  const pendingAttempts = paymentService.getMockPayments();
  const adjAttempt = pendingAttempts.find((a) => a.orderId === ord5.id && a.adjustmentType === 'weight_increase');
  if (adjAttempt) {
    adjAttempt.status = 'paid';
  }

  let test5Reject = false;
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(
      ord5.id,
      9.0,
      { id: courierA.id, role: courierA.role },
      null
    );
  } catch (err: any) {
    test5Reject = err.message.includes('penyesuaian pembayaran telah dibayar');
  }
  assert(test5Reject, 'TEST 5: Weight modification REJECTED after Payment Adjustment status = PAID');

  // TEST 6 — Laundry Cannot Override Courier-Weighed Order
  const ord6 = buildTestOrder('ord_cons_laundry_lock', courierA.id, 'picked_up', 'lnd_001', 6.5);
  let test6Reject = false;
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(
      ord6.id,
      8.0,
      { id: laundryOwnerA.id, role: laundryOwnerA.role, laundryId: 'lnd_001' },
      null
    );
  } catch (err: any) {
    test6Reject = err.message.includes('Pihak Laundry tidak dapat mengubah berat');
  }
  assert(test6Reject, 'TEST 6: Laundry Owner REJECTED when attempting to overwrite Courier-weighed order');

  // TEST 7 — Other Courier Cannot Modify
  let test7Reject = false;
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(
      ord1.id,
      10.0,
      { id: courierB.id, role: courierB.role },
      null
    );
  } catch (err: any) {
    test7Reject = err.message.includes('Akses Ditolak');
  }
  assert(test7Reject, 'TEST 7: Other Courier B REJECTED when attempting to weigh Courier A order');

  // TEST 8 — In-Washing Immutability
  const ord8 = buildTestOrder('ord_cons_washing', courierA.id, 'in_washing');
  let test8Reject = false;
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(
      ord8.id,
      6.0,
      { id: courierA.id, role: courierA.role },
      null
    );
  } catch (err: any) {
    test8Reject = err.message.includes('Penimbangan Ditolak');
  }
  assert(test8Reject, 'TEST 8: Weight modification REJECTED when order status = in_washing');

  // TEST 9 — Completed Order Immutability
  const ord9 = buildTestOrder('ord_cons_completed', courierA.id, 'delivered');
  let test9Reject = false;
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(
      ord9.id,
      6.0,
      { id: courierA.id, role: courierA.role },
      null
    );
  } catch (err: any) {
    test9Reject = err.message.includes('Penimbangan Ditolak');
  }
  assert(test9Reject, 'TEST 9: Weight modification REJECTED when order status = delivered / completed');

  // TEST 10 — Pending Adjustment Compatibility (Safe update without duplicate attempts)
  const ord10 = buildTestOrder('ord_cons_pending_adj', courierA.id, 'assigned');
  await orderService.updateActualWeightAndRecalculatePriceAsync(
    ord10.id,
    6.0,
    { id: courierA.id, role: courierA.role },
    null
  );
  await orderService.updateActualWeightAndRecalculatePriceAsync(
    ord10.id,
    7.0,
    { id: courierA.id, role: courierA.role },
    null
  );
  const ord10Attempts = paymentService.getMockPayments().filter((a) => a.orderId === ord10.id);
  assert(
    ord10Attempts.length === 1,
    'TEST 10: Re-weighing while adjustment is pending updates existing attempt without creating duplicates'
  );

  // TEST 11 — Admin Override Capability
  const res11 = await orderService.updateActualWeightAndRecalculatePriceAsync(
    ord5.id,
    8.5,
    { id: adminUser.id, role: adminUser.role },
    null
  );
  assert(
    res11.order.finalWeightKg === 8.5,
    'TEST 11: Admin override capability remains functional for exceptional operational cases'
  );

  console.log('\n==================================================');
  console.log(`COURIER WEIGHT CONSOLIDATION TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCourierWeightConsolidationTests().catch((err) => {
  console.error('Fatal Error running courier weight consolidation tests:', err);
  process.exit(1);
});
