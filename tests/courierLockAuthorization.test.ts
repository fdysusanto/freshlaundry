import assert from 'assert';
import { orderService, hasOrderArrivedAtLaundry } from '../services/orderService';
import { Order } from '../types/order';

async function runCourierOwnershipLockTests() {
  console.log('==================================================');
  console.log('TEST SUITE: COURIER PHYSICAL ARRIVAL & OWNERSHIP TRANSFER');
  console.log('==================================================\n');

  let passCount = 0;
  let failCount = 0;

  function report(testId: string, description: string, passed: boolean, detail?: string) {
    if (passed) {
      console.log(`✅ PASS: ${testId}. ${description}`);
      passCount++;
    } else {
      console.error(`❌ FAIL: ${testId}. ${description} ${detail ? `-> ${detail}` : ''}`);
      failCount++;
    }
  }

  const pickupCourierId = 'usr_courier_01';
  const deliveryCourierId = 'usr_courier_02';
  const outletOwnerId = 'usr_owner_01';

  // Seed baseline order in assigned status
  const baseOrder: Order = {
    id: 'ord_courier_lock_test_001',
    trackingNumber: 'LND-COURIER-LOCK-001',
    customerId: 'usr_customer_01',
    customerName: 'Customer Lock Test',
    customerPhone: '081234567890',
    laundryId: 'lnd_001',
    laundryName: 'FreshWash Outlet',
    courierId: pickupCourierId,
    courierName: 'Courier Pickup',
    serviceType: 'kiloan',
    serviceName: 'Cuci Komplit Kiloan',
    status: 'assigned',
    items: [
      { id: 'itm_1', serviceId: 'srv_001', name: 'Cuci Komplit', quantity: 5, unitPrice: 8000, unit: 'kg', minWeightSnapshot: 1, subtotal: 40000 },
    ],
    estimatedWeightKg: 5,
    pickupAddress: 'Jl. Customer 123',
    deliveryAddress: 'Jl. Customer 123',
    pickupDate: '2026-09-08',
    pickupTimeSlot: '09:00 - 11:00 WIB',
    subtotal: 40000,
    deliveryFee: 0,
    platformFee: 2000,
    discount: 0,
    totalPrice: 42000,
    paymentStatus: 'paid',
    assignmentId: 'asg_pickup_1',
    assignmentType: 'pickup',
    assignmentStatus: 'accepted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logs: [],
  };

  // Setup mock storage with test order
  orderService.saveOrders([baseOrder]);

  // ==================================================
  // COURIER-OWNERSHIP-01: Pickup courier assigned -> picked_up (assignmentStatus NOT completed)
  // ==================================================
  try {
    const res01 = orderService.transitionOrderStatus(
      baseOrder.id,
      'picked_up',
      { id: pickupCourierId, role: 'courier' },
      'Picked up from customer'
    );

    const isPickedUp = res01.status === 'picked_up';
    const isNotCompletedAsg = res01.assignmentStatus !== 'completed';
    const isNotArrivedYet = !hasOrderArrivedAtLaundry(res01);

    report(
      'COURIER-OWNERSHIP-01',
      'Pickup courier CAN transition assigned -> picked_up. assignmentStatus remains active during transport to outlet',
      isPickedUp && isNotCompletedAsg && isNotArrivedYet
    );
  } catch (err: any) {
    report('COURIER-OWNERSHIP-01', 'Pickup courier CAN transition assigned -> picked_up', false, err.message);
  }

  // ==================================================
  // COURIER-OWNERSHIP-02: Status picked_up & arrival log NOT EXISTS -> Courier CAN mark arrival
  // ==================================================
  try {
    const currentOrder = (await orderService.getOrderByIdAsync(baseOrder.id))!;
    assert(!hasOrderArrivedAtLaundry(currentOrder), 'Pre-condition: arrival log does not exist yet');

    // Courier preliminary weight update before arrival SHOULD be allowed
    const prelimRes = await orderService.saveCourierPreliminaryWeightAsync(baseOrder.id, 5.0);
    assert(prelimRes.courierWeightKg === 5.0, 'Courier preliminary weight during transport allowed');

    report(
      'COURIER-OWNERSHIP-02',
      'Status picked_up before arrival: Pickup courier STILL owns pickup job & can mark arrival',
      true
    );
  } catch (err: any) {
    report('COURIER-OWNERSHIP-02', 'Status picked_up before arrival actions', false, err.message);
  }

  // ==================================================
  // COURIER-OWNERSHIP-03: Courier marks arrival -> arrival log created AND assignmentStatus = completed
  // ==================================================
  try {
    const arrivedOrder = await orderService.markCourierArrivedAtLaundryAsync(baseOrder.id, pickupCourierId);
    assert(arrivedOrder !== null, 'Returned order from markCourierArrivedAtLaundryAsync is not null');
    assert(hasOrderArrivedAtLaundry(arrivedOrder), 'Arrival log courier_arrived_at_laundry exists');
    assert(arrivedOrder?.assignmentStatus === 'completed', 'assignmentStatus transitioned to completed');

    report(
      'COURIER-OWNERSHIP-03',
      'markCourierArrivedAtLaundryAsync() writes arrival log and sets assignmentStatus = completed',
      true
    );
  } catch (err: any) {
    report('COURIER-OWNERSHIP-03', 'markCourierArrivedAtLaundryAsync execution', false, err.message);
  }

  // ==================================================
  // COURIER-OWNERSHIP-04: Status picked_up & arrival log EXISTS -> Pickup courier weight update BLOCKED (403)
  // ==================================================
  try {
    let blocked = false;
    let errMsg = '';
    try {
      await orderService.saveCourierPreliminaryWeightAsync(baseOrder.id, 6.0);
    } catch (err: any) {
      errMsg = err.message || '';
      blocked = errMsg.includes('Akses Ditolak') || errMsg.includes('Tugas pickup telah selesai');
    }

    report(
      'COURIER-OWNERSHIP-04',
      'After arrival log EXISTS: Pickup courier weight update attempt is BLOCKED (403)',
      blocked,
      `Received error: "${errMsg}"`
    );
  } catch (err: any) {
    report('COURIER-OWNERSHIP-04', 'Weight update attempt after arrival', false, err.message);
  }

  // ==================================================
  // COURIER-OWNERSHIP-05: Status picked_up & arrival log EXISTS -> Pickup courier in_washing attempt BLOCKED (403)
  // ==================================================
  try {
    let blocked = false;
    let errMsg = '';
    try {
      orderService.transitionOrderStatus(
        baseOrder.id,
        'in_washing',
        { id: pickupCourierId, role: 'courier' },
        'Courier trying to start washing after arrival'
      );
    } catch (err: any) {
      errMsg = err.message || '';
      blocked = errMsg.includes('Akses Ditolak');
    }

    report(
      'COURIER-OWNERSHIP-05',
      'After arrival log EXISTS: Pickup courier in_washing attempt is BLOCKED (403)',
      blocked,
      `Received error: "${errMsg}"`
    );
  } catch (err: any) {
    report('COURIER-OWNERSHIP-05', 'In_washing attempt after arrival', false, err.message);
  }

  // ==================================================
  // COURIER-OWNERSHIP-06: Status picked_up & arrival log NOT EXISTS -> Pickup courier in_washing attempt BLOCKED
  // ==================================================
  try {
    const unarrivedOrder: Order = {
      ...baseOrder,
      id: 'ord_courier_lock_test_006',
      status: 'picked_up',
      logs: [],
    };
    orderService.saveOrders([unarrivedOrder, ...orderService.getOrders()]);

    let blocked = false;
    let errMsg = '';
    try {
      orderService.transitionOrderStatus(
        unarrivedOrder.id,
        'in_washing',
        { id: pickupCourierId, role: 'courier' },
        'Courier trying to start washing before arrival'
      );
    } catch (err: any) {
      errMsg = err.message || '';
      blocked = errMsg.includes('Akses Ditolak') || errMsg.includes('Hanya outlet laundry yang berhak');
    }

    report(
      'COURIER-OWNERSHIP-06',
      'Status picked_up before arrival: Pickup courier in_washing attempt is BLOCKED (Courier cannot start washing)',
      blocked,
      `Received error: "${errMsg}"`
    );
  } catch (err: any) {
    report('COURIER-OWNERSHIP-06', 'In_washing attempt before arrival', false, err.message);
  }

  // ==================================================
  // COURIER-OWNERSHIP-07: Outlet owner/staff CAN transition picked_up -> in_washing AFTER arrival confirmed & Washing Gate met
  // ==================================================
  try {
    // Finalize weight as laundry owner for baseOrder (which has arrived)
    await orderService.finalizeLaundryWeightAsync(baseOrder.id, 5.0, 'Weight verified by outlet', null);

    const washingRes = orderService.transitionOrderStatus(
      baseOrder.id,
      'in_washing',
      { id: outletOwnerId, role: 'laundry_owner', laundryId: 'lnd_001' },
      'Started washing by outlet owner'
    );

    report(
      'COURIER-OWNERSHIP-07',
      'Outlet owner/staff CAN transition picked_up -> in_washing after physical arrival and Washing Gate pass',
      washingRes.status === 'in_washing'
    );
  } catch (err: any) {
    report('COURIER-OWNERSHIP-07', 'Outlet owner in_washing transition', false, err.message);
  }

  // ==================================================
  // COURIER-OWNERSHIP-08: Delivery courier CAN transition ready_for_delivery -> out_for_delivery -> delivered
  // ==================================================
  try {
    // Transition in_washing -> ready_for_delivery by outlet owner
    orderService.transitionOrderStatus(
      baseOrder.id,
      'ready_for_delivery',
      { id: outletOwnerId, role: 'laundry_owner', laundryId: 'lnd_001' },
      'Washing complete'
    );

    // Assign delivery courier
    const orders = orderService.getOrders();
    const idx = orders.findIndex((o) => o.id === baseOrder.id);
    if (idx !== -1) {
      orders[idx].deliveryCourier = { id: deliveryCourierId, name: 'Delivery Courier', phone: '081299998888' };
      orderService.saveOrders(orders);
    }

    // Delivery courier starts delivery
    const outOrder = orderService.transitionOrderStatus(
      baseOrder.id,
      'out_for_delivery',
      { id: deliveryCourierId, role: 'courier' },
      'Out for delivery'
    );

    // Delivery courier completes delivery
    const deliveredOrder = orderService.transitionOrderStatus(
      baseOrder.id,
      'delivered',
      { id: deliveryCourierId, role: 'courier' },
      'Delivered to customer'
    );

    report(
      'COURIER-OWNERSHIP-08',
      'Delivery courier CAN transition ready_for_delivery -> out_for_delivery -> delivered',
      outOrder.status === 'out_for_delivery' && deliveredOrder.status === 'delivered'
    );
  } catch (err: any) {
    report('COURIER-OWNERSHIP-08', 'Delivery courier workflow', false, err.message);
  }

  // ==================================================
  // COURIER-OWNERSHIP-09: Pickup courier NOT assigned for delivery attempts ready_for_delivery -> out_for_delivery -> BLOCKED
  // ==================================================
  try {
    const baseOrder09: Order = {
      ...baseOrder,
      id: 'ord_courier_lock_test_009',
      status: 'ready_for_delivery',
      deliveryCourier: { id: deliveryCourierId, name: 'Delivery Courier', phone: '081299998888' },
    };
    orderService.saveOrders([baseOrder09]);

    let blocked = false;
    let errMsg = '';
    try {
      orderService.transitionOrderStatus(
        baseOrder09.id,
        'out_for_delivery',
        { id: pickupCourierId, role: 'courier' },
        'Pickup courier trying to take delivery task'
      );
    } catch (err: any) {
      errMsg = err.message || '';
      blocked = errMsg.includes('Akses Ditolak');
    }

    report(
      'COURIER-OWNERSHIP-09',
      'Pickup courier NOT assigned for delivery CANNOT transition ready_for_delivery -> out_for_delivery (403)',
      blocked,
      `Received error: "${errMsg}"`
    );
  } catch (err: any) {
    report('COURIER-OWNERSHIP-09', 'Unassigned delivery transition attempt', false, err.message);
  }

  console.log('\n==================================================');
  console.log(`SUMMARY: ${passCount} PASS, ${failCount} FAIL`);
  console.log('==================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runCourierOwnershipLockTests().catch((err) => {
  console.error('Fatal Test Runner Exception:', err);
  process.exit(1);
});
