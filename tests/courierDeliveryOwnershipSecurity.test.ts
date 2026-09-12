import { orderService } from '../services/orderService';
import { courierJobPoolService, getWibTodayDateString } from '../services/courierJobPoolService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

async function runDeliveryOwnershipSecurityTests() {
  console.log('==================================================');
  console.log('RUNNING DELIVERY OWNERSHIP SECURITY TEST SUITE');
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

  const courierA = DEMO_USERS.find((u) => u.role === 'courier' && u.id === 'usr_courier_01') || DEMO_USERS[1];
  const courierB = DEMO_USERS.find((u) => u.role === 'courier' && u.id === 'usr_courier_02') || DEMO_USERS[2];
  const courierC = DEMO_USERS.find((u) => u.role === 'courier' && u.id === 'usr_admin_01') || { id: 'usr_courier_03', role: 'courier', fullName: 'Kurir C' };
  const customerUser = DEMO_USERS.find((u) => u.role === 'customer') || DEMO_USERS[0];
  const ownerUser = DEMO_USERS.find((u) => u.role === 'laundry_owner') || { id: 'usr_owner_01', role: 'laundry_owner', laundryId: 'lnd_001' };

  function createTestOrder(id: string, status: any = 'pending', courierId?: string) {
    const o = {
      id,
      trackingNumber: `LND-SEC-${id}`,
      customerId: customerUser.id,
      customerName: 'Customer Test',
      customerPhone: '081234567890',
      laundryId: 'lnd_001',
      laundryName: 'Laundry Bersih',
      courierId,
      serviceType: 'kiloan' as const,
      serviceName: 'Cuci Komplit',
      items: [{ id: `item_${id}`, serviceId: 'srv_001', name: 'Cuci Komplit', unitPrice: 10000, unit: 'kg' as const, quantity: 5 }],
      subtotalPrice: 50000,
      deliveryFee: 0,
      platformFee: 2000,
      totalPrice: 52000,
      status,
      paymentStatus: 'paid' as const,
      pickupAddress: 'Jl. Pemuda No. 10',
      deliveryAddress: 'Jl. Pemuda No. 10',
      pickupDate: dateToday,
      pickupTimeSlot: slot1,
      deliveryDate: dateToday,
      deliveryTimeSlot: slot1,
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orderService.getOrders().push(o as any);
    return o;
  }

  // Clear existing orders
  orderService.getOrders().length = 0;

  // ---------------------------------------------------------------------------
  // TEST 1: Pickup courier without claim READY_FOR_DELIVERY -> OUT_FOR_DELIVERY -> 403 Forbidden
  // ---------------------------------------------------------------------------
  const order1 = createTestOrder('ord_sec_t1', 'ready_for_delivery', courierA.id);
  let test1Blocked = false;
  try {
    await orderService.transitionOrderStatusAsync(
      order1.id,
      'out_for_delivery',
      { id: courierA.id, role: 'courier' },
      'Pickup courier mencoba delivery tanpa claim'
    );
  } catch (err: any) {
    test1Blocked = err.message.includes('Akses Ditolak') || err.message.includes('belum ditugaskan');
  }
  assert(test1Blocked, 'TEST 1: Pickup courier (Kurir A) without claim attempts READY_FOR_DELIVERY -> OUT_FOR_DELIVERY REJECTED (403)');

  // ---------------------------------------------------------------------------
  // TEST 2: Pickup courier without claim OUT_FOR_DELIVERY -> DELIVERED -> 403 Forbidden
  // ---------------------------------------------------------------------------
  const order2 = createTestOrder('ord_sec_t2', 'out_for_delivery', courierA.id);
  // Set pickupCourier to Courier A but deliveryCourier to null/undefined
  (order2 as any).pickupCourier = { id: courierA.id, name: courierA.fullName };
  (order2 as any).deliveryCourier = null;
  let test2Blocked = false;
  try {
    await orderService.transitionOrderStatusAsync(
      order2.id,
      'delivered',
      { id: courierA.id, role: 'courier' },
      'Pickup courier mencoba set delivered tanpa claim'
    );
  } catch (err: any) {
    test2Blocked = err.message.includes('Akses Ditolak') || err.message.includes('tidak berhak');
  }
  assert(test2Blocked, 'TEST 2: Pickup courier (Kurir A) without claim attempts OUT_FOR_DELIVERY -> DELIVERED REJECTED (403)');

  // ---------------------------------------------------------------------------
  // TEST 3: Unrelated courier (Kurir C) attempts delivery transition without claim -> 403 Forbidden
  // ---------------------------------------------------------------------------
  const order3 = createTestOrder('ord_sec_t3', 'ready_for_delivery');
  let test3Blocked = false;
  try {
    await orderService.transitionOrderStatusAsync(
      order3.id,
      'out_for_delivery',
      { id: courierC.id, role: 'courier' },
      'Kurir C mencoba delivery tanpa claim'
    );
  } catch (err: any) {
    test3Blocked = err.message.includes('Akses Ditolak');
  }
  assert(test3Blocked, 'TEST 3: Unrelated courier (Kurir C) attempts delivery transition without claim REJECTED (403)');

  // ---------------------------------------------------------------------------
  // TEST 4, 5, 6: Courier B claims delivery job -> SUCCESS & executes transitions
  // ---------------------------------------------------------------------------
  const order4 = createTestOrder('ord_sec_t4', 'ready_for_delivery');
  order4.courierId = undefined; // Unassigned in job pool

  const claimResB = await courierJobPoolService.claimCourierSlotAsync({
    courierId: courierB.id,
    jobDate: dateToday,
    jobType: 'delivery',
    timeSlot: slot1,
    nowInput: `${dateToday}T07:45:00+07:00`,
  });

  const isClaimedByB = claimResB.success && claimResB.claimedOrderIds.includes(order4.id);
  assert(isClaimedByB, 'TEST 4: Courier B claims delivery job from Job Pool SUCCESS, becomes Delivery Job Owner');

  // TEST 5: Verify status is OUT_FOR_DELIVERY after claim
  const isOutForDelivery = order4.status === 'out_for_delivery' && order4.courierId === courierB.id;
  assert(isOutForDelivery, 'TEST 5: Order transitions to OUT_FOR_DELIVERY and courier_id assigned to Kurir B');

  // TEST 6: Delivery Job Owner (Kurir B) transitions OUT_FOR_DELIVERY -> DELIVERED
  let test6Success = false;
  try {
    const updated = await orderService.transitionOrderStatusAsync(
      order4.id,
      'delivered',
      { id: courierB.id, role: 'courier' },
      'Kurir B menyelesaikan pengantaran'
    );
    test6Success = updated?.status === 'delivered';
  } catch (err: any) {
    console.error('Test 6 error:', err.message);
  }
  assert(test6Success, 'TEST 6: Delivery Job Owner (Kurir B) transitions OUT_FOR_DELIVERY -> DELIVERED SUCCESS');

  // ---------------------------------------------------------------------------
  // TEST 7: Pickup courier (Kurir A) claims delivery job themselves from Job Pool -> SUCCESS
  // ---------------------------------------------------------------------------
  orderService.getOrders().length = 0;
  const order7 = createTestOrder('ord_sec_t7', 'ready_for_delivery');
  order7.courierId = undefined;
  (order7 as any).pickupCourier = { id: courierA.id, name: courierA.fullName };

  const claimResA = await courierJobPoolService.claimCourierSlotAsync({
    courierId: courierA.id,
    jobDate: dateToday,
    jobType: 'delivery',
    timeSlot: slot1,
    nowInput: `${dateToday}T07:45:00+07:00`,
  });

  const isClaimedByA = claimResA.success && claimResA.claimedOrderIds.includes(order7.id);
  let test7DeliverSuccess = false;
  if (isClaimedByA) {
    const updated = await orderService.transitionOrderStatusAsync(
      order7.id,
      'delivered',
      { id: courierA.id, role: 'courier' },
      'Kurir A (sebagai Delivery Owner yang sah) menyelesaikan pengantaran'
    );
    test7DeliverSuccess = updated?.status === 'delivered';
  }

  assert(
    isClaimedByA && test7DeliverSuccess,
    'TEST 7: Pickup courier (Kurir A) claims delivery job from Job Pool SUCCESS & executes delivery'
  );

  // ---------------------------------------------------------------------------
  // TEST 8: Other courier attempts update after job is claimed by Kurir B -> 403 Forbidden
  // ---------------------------------------------------------------------------
  orderService.getOrders().length = 0;
  const order8 = createTestOrder('ord_sec_t8', 'ready_for_delivery');
  order8.courierId = undefined;

  await courierJobPoolService.claimCourierSlotAsync({
    courierId: courierB.id,
    jobDate: dateToday,
    jobType: 'delivery',
    timeSlot: slot1,
    nowInput: `${dateToday}T07:45:00+07:00`,
  });

  let test8Blocked = false;
  try {
    await orderService.transitionOrderStatusAsync(
      order8.id,
      'delivered',
      { id: courierC.id, role: 'courier' },
      'Kurir C mencoba mencuri order Kurir B'
    );
  } catch (err: any) {
    test8Blocked = err.message.includes('Akses Ditolak');
  }
  assert(test8Blocked, 'TEST 8: Other courier (Kurir C) attempts update after job claimed by Kurir B REJECTED (403)');

  // ---------------------------------------------------------------------------
  // TEST 9: Concurrent claim -> Exactly ONE winner
  // ---------------------------------------------------------------------------
  orderService.getOrders().length = 0;
  const order9 = createTestOrder('ord_sec_t9', 'ready_for_delivery');
  order9.courierId = undefined;

  const [claimConcB, claimConcC] = await Promise.all([
    courierJobPoolService.claimCourierSlotAsync({ courierId: courierB.id, jobDate: dateToday, jobType: 'delivery', timeSlot: slot1, nowInput: `${dateToday}T07:45:00+07:00` }),
    courierJobPoolService.claimCourierSlotAsync({ courierId: courierC.id, jobDate: dateToday, jobType: 'delivery', timeSlot: slot1, nowInput: `${dateToday}T07:45:00+07:00` }),
  ]);

  const totalClaimed = claimConcB.claimedCount + claimConcC.claimedCount;
  const overlapIds = claimConcB.claimedOrderIds.filter((id) => claimConcC.claimedOrderIds.includes(id));
  assert(
    totalClaimed === 1 && overlapIds.length === 0,
    'TEST 9: Concurrent delivery claim results in exactly ONE winner (0 duplicate claims)'
  );

  // ---------------------------------------------------------------------------
  // TEST 10: Order still in IN_WASHING -> Courier attempts delivery transition -> REJECTED
  // ---------------------------------------------------------------------------
  orderService.getOrders().length = 0;
  const order10 = createTestOrder('ord_sec_t10', 'in_washing');

  let test10Blocked = false;
  try {
    await orderService.transitionOrderStatusAsync(
      order10.id,
      'out_for_delivery',
      { id: courierB.id, role: 'courier' },
      'Mencoba delivery saat order masih dicuci'
    );
  } catch (err: any) {
    test10Blocked = err.message.includes('Transisi status tidak valid') || err.message.includes('Akses Ditolak');
  }
  assert(test10Blocked, 'TEST 10: Courier attempts delivery action on IN_WASHING order REJECTED');

  console.log('\n==================================================');
  console.log(`DELIVERY OWNERSHIP SECURITY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDeliveryOwnershipSecurityTests().catch((err) => {
  console.error('Fatal Error running delivery ownership security test suite:', err);
  process.exit(1);
});
