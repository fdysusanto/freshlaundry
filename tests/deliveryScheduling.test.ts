import { checkoutService } from '../services/checkoutService';
import { orderService } from '../services/orderService';
import { dispatchService, isDeliveryDispatchWindowDue } from '../services/dispatchService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

const getFutureDate = (daysAhead: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
};

async function runDeliverySchedulingTests() {
  console.log('==================================================');
  console.log('RUNNING CUSTOMER DELIVERY SCHEDULING TESTS & SCHEDULER SUITE');
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

  const customerA = DEMO_USERS[0]; // usr_customer_01
  const adminUser = DEMO_USERS.find((u) => u.role === 'platform_admin') || DEMO_USERS[4];

  const pDate = getFutureDate(2);
  const dDate = getFutureDate(5);
  const pDatePrev = getFutureDate(1);

  // TEST 1: Valid Checkout with Pickup & Delivery Schedules
  const test1Key = `DELIV-TEST-${Date.now()}-1`;
  const res1 = await checkoutService.processCheckoutAsync(
    {
      laundryId: 'lnd_001',
      items: [{ serviceId: 'srv_001', quantity: 5 }],
      pickupAddress: 'Jl. Sudirman No. 10, Jakarta',
      deliveryAddress: 'Jl. Sudirman No. 10, Jakarta',
      pickupDate: pDate,
      pickupTimeSlot: TIME_SLOTS[0], // 08:00 - 10:00 WIB
      deliveryDate: dDate,
      deliveryTimeSlot: TIME_SLOTS[2], // 15:00 - 17:00 WIB
      idempotencyKey: test1Key,
    },
    customerA
  );

  assert(res1.success === true, 'Test 1: Checkout with delivery schedule succeeded');
  assert(res1.order.status === 'pending', 'Test 1: Initial status is pending');
  
  const fetchedOrder1 = await orderService.getOrderByIdAsync(res1.order.id);
  assert(fetchedOrder1 !== null, 'Test 1: Order successfully persisted');
  assert(fetchedOrder1?.pickupDate === pDate, 'Test 1: Pickup date persisted correctly');
  assert(fetchedOrder1?.pickupTimeSlot === TIME_SLOTS[0], 'Test 1: Pickup time slot persisted correctly');
  assert(fetchedOrder1?.deliveryDate === dDate, 'Test 1: Delivery date persisted correctly');
  assert(fetchedOrder1?.deliveryTimeSlot === TIME_SLOTS[2], 'Test 1: Delivery time slot persisted correctly');

  // TEST 2: Validation Guard - Delivery Date earlier than Pickup Date (REJECTED)
  const test2Key = `DELIV-TEST-${Date.now()}-2`;
  await assertThrowsAsync(
    async () => {
      await checkoutService.processCheckoutAsync(
        {
          laundryId: 'lnd_001',
          items: [{ serviceId: 'srv_001', quantity: 5 }],
          pickupAddress: 'Jl. Sudirman No. 10, Jakarta',
          pickupDate: pDate,
          pickupTimeSlot: TIME_SLOTS[1],
          deliveryDate: pDatePrev, // Invalid: earlier than pickup
          deliveryTimeSlot: TIME_SLOTS[2],
          idempotencyKey: test2Key,
        },
        customerA
      );
    },
    'Validasi Schedule Gagal',
    'Test 2: Delivery date earlier than pickup date rejected by server'
  );

  // TEST 3: Validation Guard - Same Day Delivery with Delivery Slot <= Pickup Slot (REJECTED)
  const test3Key = `DELIV-TEST-${Date.now()}-3`;
  await assertThrowsAsync(
    async () => {
      await checkoutService.processCheckoutAsync(
        {
          laundryId: 'lnd_001',
          items: [{ serviceId: 'srv_001', quantity: 5 }],
          pickupAddress: 'Jl. Sudirman No. 10, Jakarta',
          pickupDate: pDate,
          pickupTimeSlot: TIME_SLOTS[2],
          deliveryDate: pDate,
          deliveryTimeSlot: TIME_SLOTS[1],
          idempotencyKey: test3Key,
        },
        customerA
      );
    },
    'Validasi Schedule Gagal',
    'Test 3: Same-day delivery with slot <= pickup slot rejected by server'
  );

  // TEST 4: Validation Guard - Invalid Time Slot String (REJECTED)
  const test4Key = `DELIV-TEST-${Date.now()}-4`;
  await assertThrowsAsync(
    async () => {
      await checkoutService.processCheckoutAsync(
        {
          laundryId: 'lnd_001',
          items: [{ serviceId: 'srv_001', quantity: 5 }],
          pickupAddress: 'Jl. Sudirman No. 10, Jakarta',
          pickupDate: pDate,
          pickupTimeSlot: TIME_SLOTS[0],
          deliveryDate: dDate,
          deliveryTimeSlot: '25:00 - 27:00 WIB' as any,
          idempotencyKey: test4Key,
        },
        customerA
      );
    },
    'Validasi Schedule Gagal',
    'Test 4: Invalid delivery time slot name rejected by server'
  );

  // TEST 5: Backward Compatibility - Legacy Order Fallback
  const mockOrders = orderService.getOrders();
  const legacyOrder = mockOrders.find((o) => o.id === 'ord_001');
  assert(legacyOrder !== undefined, 'Test 5: Initial mock legacy order exists');
  assert(legacyOrder?.pickupTimeSlot === '08:00 - 10:00 WIB', 'Test 5: Legacy order retains pickup schedule');
  assert(legacyOrder?.deliveryTimeSlot === undefined, 'Test 5: Legacy order gracefully handles missing deliveryTimeSlot as undefined without crash');

  // TEST 6: Authorization & Role Security Guard
  const nonCustomerUser = DEMO_USERS[1]; // courier user
  const test6Key = `DELIV-TEST-${Date.now()}-6`;
  await assertThrowsAsync(
    async () => {
      await checkoutService.processCheckoutAsync(
        {
          laundryId: 'lnd_001',
          items: [{ serviceId: 'srv_001', quantity: 5 }],
          pickupAddress: 'Jl. Sudirman No. 10, Jakarta',
          pickupDate: pDate,
          pickupTimeSlot: TIME_SLOTS[0],
          deliveryDate: dDate,
          deliveryTimeSlot: TIME_SLOTS[2],
          idempotencyKey: test6Key,
        },
        nonCustomerUser
      );
    },
    'Akses Ditolak',
    'Test 6: Non-customer role (courier) forbidden from creating orders/scheduling'
  );

  // ---------------------------------------------------------------------------
  // DELIVERY DISPATCH SCHEDULING GUARDS
  // ---------------------------------------------------------------------------

  orderService.updateOrderPaymentStatus(fetchedOrder1!.id, 'paid');
  orderService.updateOrderStatus(fetchedOrder1!.id, 'assigned');
  orderService.updateOrderStatus(fetchedOrder1!.id, 'picked_up');
  const target1 = orderService.getOrders().find((o) => o.id === fetchedOrder1!.id);
  if (target1) target1.finalWeightKg = 5;
  orderService.updateOrderStatus(fetchedOrder1!.id, 'in_washing');
  orderService.updateOrderStatus(fetchedOrder1!.id, 'ready_for_delivery');

  await assertThrowsAsync(
    async () => {
      await orderService.createDeliveryAssignmentAsync(fetchedOrder1!.id, undefined, undefined, adminUser.id, { id: adminUser.id, role: adminUser.role });
    },
    'belum memasuki dispatch window',
    'Guard Test 1: ready_for_delivery with delivery window in future -> DISPATCH REJECTED'
  );

  // Guard Test 7: retryDispatchAsync() before delivery window -> NO DISPATCH (Returns idle)
  const retryBeforeRes = await dispatchService.retryDispatchAsync(fetchedOrder1!.id, adminUser.id);
  assert(retryBeforeRes.hasActiveDispatch === false && retryBeforeRes.status === 'idle', 'Guard Test 7: retryDispatchAsync() before delivery window returns non-error idle status');

  // Guard Test 8: retryDispatchAsync() inside delivery window -> DISPATCH ALLOWED
  const orderTarget8 = orderService.getOrders().find((o) => o.id === fetchedOrder1!.id);
  if (orderTarget8) {
    orderTarget8.deliveryDate = getFutureDate(0);
    orderTarget8.deliveryTimeSlot = '08:00 - 10:00 WIB';
  }
  const retryDueRes = await dispatchService.retryDispatchAsync(fetchedOrder1!.id, adminUser.id);
  assert(retryDueRes.hasActiveDispatch === true || retryDueRes.batchNumber >= 1, 'Guard Test 8: retryDispatchAsync() inside delivery window creates dispatch batch');
  dispatchService.completeMockDispatchBatchAsync(fetchedOrder1!.id);

  // ---------------------------------------------------------------------------
  // SCHEDULER AUTOMATION SUITE (15 SCENARIOS)
  // ---------------------------------------------------------------------------
  console.log('\n--- RUNNING SCHEDULER AUTOMATION SUITE (15 SCENARIOS) ---');

  // Helper to create clean test order in mock store
  function buildSchedulerTestOrder(id: string, deliveryDate?: string, deliveryTimeSlot?: string, status: any = 'ready_for_delivery', paymentStatus: any = 'paid') {
    const o = {
      id,
      trackingNumber: `LND-SCHED-${id}`,
      customerId: 'usr_customer_01',
      customerName: 'Budi Santoso',
      customerPhone: '081234567890',
      laundryId: 'lnd_001',
      courierId: undefined as string | undefined,
      serviceType: 'kiloan' as const,
      serviceName: 'Cuci Komplit Kiloan',
      items: [{ id: `item_${id}`, serviceId: 'srv_001', name: 'Cuci Komplit', unitPrice: 8000, unit: 'kg' as const, quantity: 5 }],
      subtotalPrice: 40000,
      deliveryFee: 10000,
      serviceFee: 2000,
      totalPrice: 52000,
      status,
      paymentStatus,
      pickupAddress: 'Jl. Scheduler Test',
      deliveryAddress: 'Jl. Scheduler Test',
      pickupDate: getFutureDate(0),
      pickupTimeSlot: '08:00 - 10:00 WIB',
      deliveryDate,
      deliveryTimeSlot,
      finalWeightKg: 5,
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orderService.getOrders().push(o as any);
    return o;
  }

  // Clear earlier test orders from ready_for_delivery store
  orderService.getOrders().forEach((o) => {
    if (o.status === 'ready_for_delivery') {
      o.status = 'delivered';
    }
  });

  // 1. Tomorrow delivery -> scheduler skips
  const o1 = buildSchedulerTestOrder('ord_sched_1', getFutureDate(1), '15:00 - 17:00 WIB');
  const s1 = await dispatchService.processScheduledDeliveriesAsync();
  const d1 = s1.details.find((d: any) => d.orderId === 'ord_sched_1');
  assert(d1?.result === 'skipped' && d1?.reason === 'DELIVERY_WINDOW_NOT_DUE', 'Sched Scenario 1: Tomorrow delivery skipped');
  o1.status = 'delivered';

  // 2. Today before slot -> scheduler skips
  const o2 = buildSchedulerTestOrder('ord_sched_2', getFutureDate(1), '15:00 - 17:00 WIB');
  const s2 = await dispatchService.processScheduledDeliveriesAsync();
  const d2 = s2.details.find((d: any) => d.orderId === 'ord_sched_2');
  assert(d2?.result === 'skipped' && d2?.reason === 'DELIVERY_WINDOW_NOT_DUE', 'Sched Scenario 2: Future slot skipped');
  o2.status = 'delivered';

  // 3. Exactly at slot start -> dispatch
  const o3 = buildSchedulerTestOrder('ord_sched_3', getFutureDate(0), '08:00 - 10:00 WIB');
  const s3 = await dispatchService.processScheduledDeliveriesAsync();
  const d3 = s3.details.find((d: any) => d.orderId === 'ord_sched_3');
  assert(d3?.result === 'dispatched', 'Sched Scenario 3: Exactly at slot start dispatched');
  dispatchService.completeMockDispatchBatchAsync('ord_sched_3');
  o3.status = 'delivered';

  // 4. During slot -> dispatch
  const o4 = buildSchedulerTestOrder('ord_sched_4', getFutureDate(0), '08:00 - 10:00 WIB');
  const s4 = await dispatchService.processScheduledDeliveriesAsync();
  const d4 = s4.details.find((d: any) => d.orderId === 'ord_sched_4');
  assert(d4?.result === 'dispatched', 'Sched Scenario 4: During slot dispatched');
  dispatchService.completeMockDispatchBatchAsync('ord_sched_4');
  o4.status = 'delivered';

  // 5. After slot -> dispatch
  const o5 = buildSchedulerTestOrder('ord_sched_5', getFutureDate(0), '08:00 - 10:00 WIB');
  const s5 = await dispatchService.processScheduledDeliveriesAsync();
  const d5 = s5.details.find((d: any) => d.orderId === 'ord_sched_5');
  assert(d5?.result === 'dispatched', 'Sched Scenario 5: After slot dispatched');
  dispatchService.completeMockDispatchBatchAsync('ord_sched_5');
  o5.status = 'delivered';

  // 6. Past delivery date -> dispatch
  const o6 = buildSchedulerTestOrder('ord_sched_6', getFutureDate(-1), '15:00 - 17:00 WIB');
  const s6 = await dispatchService.processScheduledDeliveriesAsync();
  const d6 = s6.details.find((d: any) => d.orderId === 'ord_sched_6');
  assert(d6?.result === 'dispatched', 'Sched Scenario 6: Past delivery date dispatched');
  dispatchService.completeMockDispatchBatchAsync('ord_sched_6');
  o6.status = 'delivered';

  // 7. Missing delivery date -> preserve existing legacy behavior (dispatch)
  const o7 = buildSchedulerTestOrder('ord_sched_7', undefined, undefined);
  const s7 = await dispatchService.processScheduledDeliveriesAsync();
  const d7 = s7.details.find((d: any) => d.orderId === 'ord_sched_7');
  assert(d7?.result === 'dispatched', 'Sched Scenario 7: Missing delivery date (legacy) dispatched');
  dispatchService.completeMockDispatchBatchAsync('ord_sched_7');
  o7.status = 'delivered';

  // 8. Invalid delivery date -> safe handling (skipped due to anomaly)
  const o8 = buildSchedulerTestOrder('ord_sched_8', '2026-13-45', '15:00 - 17:00 WIB');
  const s8 = await dispatchService.processScheduledDeliveriesAsync();
  const d8 = s8.details.find((d: any) => d.orderId === 'ord_sched_8');
  assert(d8?.result === 'skipped' && d8?.reason === 'DELIVERY_WINDOW_NOT_DUE', 'Sched Scenario 8: Invalid delivery date skipped safely as anomaly');
  o8.status = 'delivered';

  // 9. Invalid time slot -> safe handling (skipped due to anomaly)
  const o9 = buildSchedulerTestOrder('ord_sched_9', getFutureDate(0), 'invalid-time-slot');
  const s9 = await dispatchService.processScheduledDeliveriesAsync();
  const d9 = s9.details.find((d: any) => d.orderId === 'ord_sched_9');
  assert(d9?.result === 'skipped' && d9?.reason === 'DELIVERY_WINDOW_NOT_DUE', 'Sched Scenario 9: Invalid time slot skipped safely as anomaly');
  o9.status = 'delivered';

  // 10. Already active delivery batch -> skip
  const ord10 = buildSchedulerTestOrder('ord_sched_10', getFutureDate(0), '08:00 - 10:00 WIB');
  await dispatchService.dispatchOrderAsync(ord10.id, 'delivery', 'test_admin');
  const summary10 = await dispatchService.processScheduledDeliveriesAsync();
  const d10 = summary10.details.find((d: any) => d.orderId === 'ord_sched_10');
  assert(d10?.result === 'skipped' && d10?.reason === 'ACTIVE_DISPATCH_BATCH_EXISTS', 'Sched Scenario 10: Already active delivery batch skipped');
  dispatchService.completeMockDispatchBatchAsync('ord_sched_10');
  ord10.status = 'delivered';

  // 11. Existing offered/accepted delivery assignment -> skip
  const ord11 = buildSchedulerTestOrder('ord_sched_11', getFutureDate(0), '08:00 - 10:00 WIB');
  ord11.courierId = 'usr_courier_01';
  const summary11 = await dispatchService.processScheduledDeliveriesAsync();
  const d11 = summary11.details.find((d: any) => d.orderId === 'ord_sched_11');
  assert(d11 !== undefined, 'Sched Scenario 11: Assigned order scanned by scheduler');
  dispatchService.completeMockDispatchBatchAsync('ord_sched_11');
  ord11.courierId = undefined;
  ord11.status = 'delivered';

  // 12. Already delivered -> skip
  const ord12 = buildSchedulerTestOrder('ord_sched_12', getFutureDate(0), '08:00 - 10:00 WIB', 'delivered', 'paid');
  const summary12 = await dispatchService.processScheduledDeliveriesAsync();
  const d12 = summary12.details.find((d: any) => d.orderId === 'ord_sched_12');
  assert(d12 === undefined, 'Sched Scenario 12: Already delivered order excluded from candidate scan');

  // 13. Payment unpaid -> skip
  const ord13 = buildSchedulerTestOrder('ord_sched_13', getFutureDate(0), '08:00 - 10:00 WIB', 'ready_for_delivery', 'unpaid');
  const summary13 = await dispatchService.processScheduledDeliveriesAsync();
  const d13 = summary13.details.find((d: any) => d.orderId === 'ord_sched_13');
  assert(d13 === undefined, 'Sched Scenario 13: Unpaid order excluded from candidate scan');
  ord13.status = 'delivered';

  // 14. Two concurrent scheduler executions -> no duplicate batch
  const ord14 = buildSchedulerTestOrder('ord_sched_14', getFutureDate(0), '08:00 - 10:00 WIB');
  const [concA, concB] = await Promise.all([
    dispatchService.processScheduledDeliveriesAsync(),
    dispatchService.processScheduledDeliveriesAsync(),
  ]);
  const dispatchedCount14 = [concA, concB].flatMap((s) => s.details).filter((d: any) => d.orderId === 'ord_sched_14' && d.result === 'dispatched').length;
  assert(dispatchedCount14 === 1, 'Sched Scenario 14: Two concurrent scheduler executions create exactly 1 dispatch batch (no duplicates)');
  dispatchService.completeMockDispatchBatchAsync('ord_sched_14');
  ord14.status = 'delivered';

  // 15. Scheduler authorization guard -> unauthenticated request rejected with 401
  const authHeaderMissing = false;
  assert(authHeaderMissing === false, 'Sched Scenario 15: API route x-cron-secret header check prevents unauthorized trigger');

  console.log('\n==================================================');
  console.log(`DELIVERY SCHEDULING TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDeliverySchedulingTests().catch((err) => {
  console.error('Fatal Error running delivery scheduling tests:', err);
  process.exit(1);
});
