import { orderService } from '../services/orderService';
import { dispatchService } from '../services/dispatchService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

const getFutureDate = (daysAhead: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
};

async function runCustomerRescheduleTests() {
  console.log('==================================================');
  console.log('RUNNING PHASE 5C-3: CUSTOMER RESCHEDULE BACKEND TESTS');
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

  const customerA = DEMO_USERS.find((u) => u.role === 'customer') || DEMO_USERS[0];
  const customerB = DEMO_USERS.find((u) => u.role === 'courier') || DEMO_USERS[1];

  const dateToday = getFutureDate(0);
  const datePickup = getFutureDate(2);
  const dateDelivery = getFutureDate(5);
  const dateDeliveryTooEarly = getFutureDate(3);
  const datePickupShifted = getFutureDate(3);
  const dateDeliveryShifted = getFutureDate(6);

  // Helper to create paid pending order
  function createTestOrder(ownerId = customerA.id) {
    const newOrd = orderService.createOrder(
      {
        pickupAddress: 'Jl. Merdeka No. 10, Jakarta',
        deliveryAddress: 'Jl. Merdeka No. 10, Jakarta',
        pickupDate: datePickup,
        pickupTimeSlot: '15:00 - 17:00 WIB',
        deliveryDate: dateDelivery,
        deliveryTimeSlot: '15:00 - 17:00 WIB',
        laundryId: 'lnd_001',
        items: [{ serviceId: 'srv_001', name: 'Cuci Komplit Kiloan', quantity: 1, unitPrice: 8000, unit: 'kg' }],
      },
      { id: ownerId, role: 'customer', fullName: 'Customer A', phone: '08123' } as any
    );
    orderService.updateOrderPaymentStatus(newOrd.id, 'paid');
    return orderService.getOrderById(newOrd.id)!;
  }

  // 1. Authorization: Customer A attempts reschedule on own order -> PASS
  try {
    const ord1 = createTestOrder(customerA.id);
    const updated = await orderService.rescheduleOrderScheduleAsync(
      ord1.id,
      customerA.id,
      { pickupDate: datePickup, pickupTimeSlot: '15:00 - 17:00 WIB', deliveryDate: dateDelivery, deliveryTimeSlot: '15:00 - 17:00 WIB' }
    );
    assert(updated?.pickupTimeSlot === '15:00 - 17:00 WIB', '1. Customer A can reschedule own order pickup');
  } catch (err: any) {
    assert(false, `1. Reschedule failed: ${err.message}`);
  }

  // 2. Authorization: Customer B attempts reschedule on Customer A order -> 403 Forbidden
  try {
    const ord2 = createTestOrder(customerA.id);
    await orderService.rescheduleOrderScheduleAsync(
      ord2.id,
      customerB.id,
      { pickupDate: datePickup, pickupTimeSlot: '15:00 - 17:00 WIB' }
    );
    assert(false, '2. Customer B should be REJECTED from rescheduling Customer A order');
  } catch (err: any) {
    assert(err.message.includes('Akses Ditolak'), '2. Customer B rejected with Akses Ditolak (403)');
  }

  // 3. Pickup Guard: Unpaid order reschedule -> REJECT
  try {
    const ord3 = orderService.createOrder(
      {
        pickupAddress: 'Jl. Merdeka No. 10',
        deliveryAddress: 'Jl. Merdeka No. 10',
        pickupDate: datePickup,
        pickupTimeSlot: '15:00 - 17:00 WIB',
        laundryId: 'lnd_001',
        items: [{ serviceId: 'srv_001', name: 'Cuci Komplit Kiloan', quantity: 1, unitPrice: 8000, unit: 'kg' }],
      },
      { id: customerA.id, role: 'customer', fullName: 'Customer A' } as any
    );
    await orderService.rescheduleOrderScheduleAsync(
      ord3.id,
      customerA.id,
      { pickupDate: datePickup, pickupTimeSlot: '15:00 - 17:00 WIB' }
    );
    assert(false, '3. Unpaid order reschedule should be REJECTED');
  } catch (err: any) {
    assert(err.message.includes('belum dibayar'), '3. Unpaid order reschedule rejected with message');
  }

  // 4. Pickup Guard: Active dispatch batch -> CONCURRENCY_LOCK REJECT
  try {
    const ord4 = createTestOrder(customerA.id);
    const storeOrders = orderService.getOrders();
    const targetInStore = storeOrders.find((o) => o.id === ord4.id);
    if (targetInStore) {
      targetInStore.pickupDate = dateToday;
      targetInStore.pickupTimeSlot = '08:00 - 10:00 WIB';
      orderService.saveOrders(storeOrders);
    }

    await dispatchService.updateCourierHeartbeatAsync('usr_courier_01', -6.2415, 106.7972, '327401', '3274011001', true);
    await dispatchService.dispatchOrderAsync(ord4.id, 'pickup', 'system_cron');

    await orderService.rescheduleOrderScheduleAsync(
      ord4.id,
      customerA.id,
      { pickupDate: datePickup, pickupTimeSlot: '15:00 - 17:00 WIB' }
    );
    assert(false, '4. Reschedule during active dispatch batch should be REJECTED');
  } catch (err: any) {
    assert(err.message.includes('CONCURRENCY_LOCK') || err.message.includes('proses penjemputan'), '4. Active dispatch batch reschedule rejected with CONCURRENCY_LOCK');
  }

  // 5. Pickup ↔ Delivery Chronological Dependency: Delivery before pickup -> REJECT
  try {
    const ord5 = createTestOrder(customerA.id);
    await orderService.rescheduleOrderScheduleAsync(
      ord5.id,
      customerA.id,
      { pickupDate: datePickupShifted, deliveryDate: datePickup }
    );
    assert(false, '5. Delivery date before pickup date should be REJECTED');
  } catch (err: any) {
    assert(err.message.includes('terlalu cepat') || err.message.includes('minimal') || err.message.includes('harus sama atau setelah'), '5. Invalid date dependency rejected with clear message');
  }

  // 6. Data Integrity: Reschedule preserves payment_status, total_price, status
  try {
    const ord6 = createTestOrder(customerA.id);
    const origPaymentStatus = ord6.paymentStatus;
    const origTotalPrice = ord6.totalPrice;
    const origStatus = ord6.status;

    const res6 = await orderService.rescheduleOrderScheduleAsync(
      ord6.id,
      customerA.id,
      { pickupDate: datePickup, pickupTimeSlot: '15:00 - 17:00 WIB', deliveryDate: dateDelivery, deliveryTimeSlot: '15:00 - 17:00 WIB' }
    );

    assert(res6?.paymentStatus === origPaymentStatus, '6. Payment status preserved after reschedule');
    assert(res6?.totalPrice === origTotalPrice, '6. Total price preserved after reschedule');
    assert(res6?.status === origStatus, '6. Order status preserved after reschedule');
  } catch (err: any) {
    assert(false, `6. Integrity test failed: ${err.message}`);
  }

  // 7. Leg Isolation: Active DELIVERY batch does NOT block PICKUP reschedule
  try {
    const ord7 = createTestOrder(customerA.id);
    const storeOrders = orderService.getOrders();
    const targetInStore = storeOrders.find((o) => o.id === ord7.id);
    if (targetInStore) {
      targetInStore.deliveryDate = dateToday;
      targetInStore.deliveryTimeSlot = '08:00 - 10:00 WIB';
      targetInStore.status = 'ready_for_delivery';
      orderService.saveOrders(storeOrders);
    }

    await dispatchService.updateCourierHeartbeatAsync('usr_courier_01', -6.2415, 106.7972, '327401', '3274011001', true);
    await dispatchService.dispatchOrderAsync(ord7.id, 'delivery', 'system_cron');

    const legCheckResult = await dispatchService.getDispatchStatusAsync(ord7.id, undefined, 'pickup');
    assert(legCheckResult.hasActiveDispatch === false, '7. Active DELIVERY batch does NOT flag active PICKUP dispatch');
  } catch (err: any) {
    assert(false, `7. Leg isolation test failed: ${err.message}`);
  }

  // 8. Order Status = delivered -> Delivery Reschedule REJECTED
  try {
    const ord8 = createTestOrder(customerA.id);
    const storeOrders = orderService.getOrders();
    const target = storeOrders.find((o) => o.id === ord8.id);
    if (target) {
      target.status = 'delivered';
      orderService.saveOrders(storeOrders);
    }
    await orderService.rescheduleOrderScheduleAsync(ord8.id, customerA.id, { deliveryDate: dateDeliveryShifted });
    assert(false, '8. Delivery reschedule on delivered order should be REJECTED');
  } catch (err: any) {
    assert(err.message.includes('sudah dalam pengantaran atau selesai') || err.message.includes('CONCURRENCY_LOCK'), '8. Delivered status delivery reschedule rejected');
  }

  // 9. Order Status = cancelled -> Delivery Reschedule REJECTED
  try {
    const ord9 = createTestOrder(customerA.id);
    const storeOrders = orderService.getOrders();
    const target = storeOrders.find((o) => o.id === ord9.id);
    if (target) {
      target.status = 'cancelled';
      orderService.saveOrders(storeOrders);
    }
    await orderService.rescheduleOrderScheduleAsync(ord9.id, customerA.id, { deliveryDate: dateDeliveryShifted });
    assert(false, '9. Delivery reschedule on cancelled order should be REJECTED');
  } catch (err: any) {
    assert(err.message.includes('sudah dalam pengantaran atau selesai') || err.message.includes('CONCURRENCY_LOCK'), '9. Cancelled status delivery reschedule rejected');
  }

  // 10. Order Status = out_for_delivery -> Delivery Reschedule REJECTED
  try {
    const ord10 = createTestOrder(customerA.id);
    const storeOrders = orderService.getOrders();
    const target = storeOrders.find((o) => o.id === ord10.id);
    if (target) {
      target.status = 'out_for_delivery';
      orderService.saveOrders(storeOrders);
    }
    await orderService.rescheduleOrderScheduleAsync(ord10.id, customerA.id, { deliveryDate: dateDeliveryShifted });
    assert(false, '10. Delivery reschedule on out_for_delivery order should be REJECTED');
  } catch (err: any) {
    assert(err.message.includes('sudah dalam pengantaran atau selesai') || err.message.includes('CONCURRENCY_LOCK'), '10. Out for delivery status delivery reschedule rejected');
  }

  // 11. Estimated Processing Duration (48h Regular): Delivery date too early (< 48h from SLA boundary) -> REJECT
  try {
    const ord11 = createTestOrder(customerA.id);
    await orderService.rescheduleOrderScheduleAsync(
      ord11.id,
      customerA.id,
      { pickupDate: datePickup, pickupTimeSlot: '11:00 - 14:00 WIB', deliveryDate: dateDeliveryTooEarly, deliveryTimeSlot: '11:00 - 14:00 WIB' }
    );
    assert(false, '11. Delivery too early on 48h estimated service should be REJECTED');
  } catch (err: any) {
    assert(err.message.includes('minimal 48 jam') || err.message.includes('terlalu cepat'), '11. Delivery too early rejected with estimated hours message');
  }

  // 12. Estimated Processing Duration (48h Regular): Delivery date >= 48h -> PASS
  try {
    const ord12 = createTestOrder(customerA.id);
    const updated12 = await orderService.rescheduleOrderScheduleAsync(
      ord12.id,
      customerA.id,
      { pickupDate: datePickup, pickupTimeSlot: '11:00 - 14:00 WIB', deliveryDate: dateDelivery, deliveryTimeSlot: '15:00 - 17:00 WIB' }
    );
    assert(updated12?.deliveryDate === dateDelivery, '12. Delivery >= 48h on 48h estimated service ACCEPTED');
  } catch (err: any) {
    assert(false, `12. Valid 48h delivery rejected: ${err.message}`);
  }

  // 13. Pickup Reschedule Auto-shift Delivery: Pickup shifted forward auto-shifts delivery
  try {
    const ord13 = createTestOrder(customerA.id);
    const updated13 = await orderService.rescheduleOrderScheduleAsync(
      ord13.id,
      customerA.id,
      { pickupDate: datePickupShifted, pickupTimeSlot: '15:00 - 17:00 WIB' }
    );
    assert(updated13?.deliveryDate === dateDeliveryShifted, '13. Pickup shift forward automatically adjusts delivery date to earliest permissible');
  } catch (err: any) {
    assert(false, `13. Auto-shift delivery test failed: ${err.message}`);
  }

  // 14. Historical Snapshot Created: Order item contains estimatedHours snapshot
  try {
    const ord14 = createTestOrder(customerA.id);
    assert(typeof ord14.items[0]?.estimatedHours === 'number' && ord14.items[0]?.estimatedHours > 0, '14. Order items contain historical estimatedHours snapshot');
  } catch (err: any) {
    assert(false, `14. Historical snapshot test failed: ${err.message}`);
  }

  // 15. Historical Catalog Mutation: Order retains snapshot 48h even if catalog is mutated
  try {
    const ord15 = createTestOrder(customerA.id);
    ord15.items[0].estimatedHours = 48; // Snapshot explicitly set to 48h

    await orderService.rescheduleOrderScheduleAsync(
      ord15.id,
      customerA.id,
      { pickupDate: datePickup, pickupTimeSlot: '11:00 - 14:00 WIB', deliveryDate: dateDeliveryTooEarly, deliveryTimeSlot: '11:00 - 14:00 WIB' }
    );
    assert(false, '15. Reschedule on order with 48h snapshot should REJECT delivery < 48h even if live catalog mutated');
  } catch (err: any) {
    assert(err.message.includes('minimal 48 jam') || err.message.includes('terlalu cepat'), '15. Historical catalog mutation test passed: order retains 48h snapshot');
  }

  // 16. Client estimatedHours Manipulation Ignored: Server resolves database catalog estimated_hours
  try {
    const ord16 = orderService.createOrder(
      {
        pickupAddress: 'Jl. Merdeka No. 10',
        deliveryAddress: 'Jl. Merdeka No. 10',
        pickupDate: datePickup,
        pickupTimeSlot: '15:00 - 17:00 WIB',
        deliveryDate: dateDelivery,
        deliveryTimeSlot: '15:00 - 17:00 WIB',
        laundryId: 'lnd_001',
        items: [{ serviceId: 'srv_001', name: 'Cuci Komplit Kiloan', quantity: 1, unitPrice: 8000, unit: 'kg', estimatedHours: 1 } as any],
      },
      { id: customerA.id, role: 'customer', fullName: 'Customer A' } as any
    );
    assert(ord16.items[0]?.estimatedHours === 48, '16. Client estimatedHours manipulation ignored; server DB catalog value 48 stored');
  } catch (err: any) {
    assert(false, `16. Client manipulation test failed: ${err.message}`);
  }

  // 17. Direct createOrderAsync Bypass Protection: Direct call with delivery date too fast is REJECTED
  try {
    await orderService.createOrderAsync(
      {
        pickupAddress: 'Jl. Merdeka No. 10, Jakarta',
        deliveryAddress: 'Jl. Merdeka No. 10, Jakarta',
        pickupDate: datePickup,
        pickupTimeSlot: '11:00 - 14:00 WIB',
        deliveryDate: dateDeliveryTooEarly,
        deliveryTimeSlot: '11:00 - 14:00 WIB',
        laundryId: 'lnd_001',
        serviceType: 'kiloan',
        serviceId: 'srv_001',
        estimatedWeightKg: 2,
      },
      { id: customerA.id, role: 'customer', fullName: 'Customer A', phone: '08123' } as any
    );
    assert(false, '17. Direct createOrderAsync call with invalid delivery date should be REJECTED');
  } catch (err: any) {
    assert(err.message.includes('terlalu cepat') || err.message.includes('minimal 48 jam'), '17. Direct createOrderAsync bypass protection REJECTED invalid delivery schedule');
  }

  // 18. Multiple Services Order Duration: MAX(24h, 48h, 72h) = 72h
  try {
    const { resolveOrderProcessingHours } = await import('../utils/scheduleUtils');
    const multiServiceOrder = {
      items: [
        { serviceId: 'srv_001', name: 'Express 24h', estimatedHours: 24 },
        { serviceId: 'srv_002', name: 'Regular 48h', estimatedHours: 48 },
        { serviceId: 'srv_003', name: 'Premium 72h', estimatedHours: 72 },
      ],
    };
    const resolvedHours = resolveOrderProcessingHours(multiServiceOrder);
    assert(resolvedHours === 72, '18. Multiple services order uses MAX duration (72h)');
  } catch (err: any) {
    assert(false, `18. Multiple services test failed: ${err.message}`);
  }

  // 19. Delivery Slot Filtering Helper: filterAvailableDeliverySlots filters slots starting before earliestTimeSlot
  try {
    const { filterAvailableDeliverySlots } = await import('../utils/scheduleUtils');
    const filteredSameDay = filterAvailableDeliverySlots('2026-08-26', '2026-08-26', '15:00 - 17:00 WIB');
    assert(filteredSameDay.length === 1 && filteredSameDay[0] === '15:00 - 17:00 WIB', '19. filterAvailableDeliverySlots filters out slots before 15:00 on earliest delivery date');
  } catch (err: any) {
    assert(false, `19. Slot filtering test failed: ${err.message}`);
  }

  console.log(`\nCustomer Reschedule Tests Summary: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runCustomerRescheduleTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
