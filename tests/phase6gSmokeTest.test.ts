import { courierJobPoolService, getWibTodayDateString } from '../services/courierJobPoolService';
import { orderService } from '../services/orderService';
import { dispatchService } from '../services/dispatchService';
import { authService } from '../services/authService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

async function runPhase6gProductionSmokeTest() {
  console.log('==================================================');
  console.log('RUNNING PHASE 6G PRODUCTION SMOKE TEST & OPERATIONAL ACCEPTANCE');
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
  const customerUser = DEMO_USERS.find((u) => u.role === 'customer') || DEMO_USERS[0];

  const createdOrderIds: string[] = [];

  function createSmokeTestOrder(id: string) {
    const o = {
      id,
      trackingNumber: `SMK-${id}`,
      customerId: customerUser.id,
      customerName: `Smoke Customer ${id}`,
      customerPhone: '081288887777',
      laundryId: 'lnd_001',
      courierId: undefined,
      serviceType: 'kiloan' as const,
      serviceName: 'Cuci Komplit Express',
      items: [{ id: `item_${id}`, serviceId: 'srv_001', name: 'Cuci Komplit Express', unitPrice: 8000, unit: 'kg' as const, quantity: 5, estimatedHours: 48 }],
      subtotalPrice: 40000,
      deliveryFee: 0,
      platformFee: 2000,
      totalPrice: 42000,
      status: 'pending',
      paymentStatus: 'paid',
      pickupAddress: `Jl. Smoke Test Address ${id}`,
      deliveryAddress: `Jl. Smoke Test Address ${id}`,
      pickupDate: dateToday,
      pickupTimeSlot: slot1,
      deliveryDate: '2026-09-07',
      deliveryTimeSlot: slot1,
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orderService.getOrders().push(o as any);
    createdOrderIds.push(id);
    return o;
  }

  try {
    // -------------------------------------------------------------------------
    // STEP 1 & 2: Create 8 Paid Orders & Verify Isolation from Legacy Dispatch
    // -------------------------------------------------------------------------
    console.log('--- Step 1 & 2: Order Creation & Legacy Dispatch Isolation ---');
    for (let i = 1; i <= 8; i++) {
      createSmokeTestOrder(`ord_smk_${i}`);
    }

    const dispatchRes = await dispatchService.dispatchOrderAsync('ord_smk_1', 'pickup', 'system_payment_webhook');
    assert(
      dispatchRes.hasActiveDispatch === false && Boolean(dispatchRes.message?.includes('SLOT_POOL_MODE_ACTIVE')),
      'STEP 2: Orders accumulate into Job Pool without creating legacy 1-to-1 dispatch push (hasActiveDispatch = false)'
    );

    // -------------------------------------------------------------------------
    // STEP 3: Verify Zero PII in Aggregate Job Pool Query
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Zero PII Security Verification ---');
    const poolRes = await courierJobPoolService.getCourierJobPoolAsync(dateToday, courierA.id, `${dateToday}T07:45:00+07:00`);
    const slot1PickupPool = poolRes.pickupSlots.find((s) => s.timeSlot === slot1);
    const poolStr = JSON.stringify(poolRes);

    const hasPii = poolStr.includes('Smoke Customer') || poolStr.includes('081288887777') || poolStr.includes('Smoke Test Address');
    assert(
      slot1PickupPool?.availableOrders === 8 && !hasPii,
      'STEP 3: Job Pool correctly displays 8 available orders with ZERO PII before claim'
    );

    // -------------------------------------------------------------------------
    // STEP 4: Courier A Claims 5 Orders (Max Capacity Limit)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Courier A Atomic Claim (Max Capacity) ---');
    authService.setCurrentUser(courierA);
    const claimA = await courierJobPoolService.claimCourierSlotAsync({
      courierId: courierA.id,
      jobDate: dateToday,
      jobType: 'pickup',
      timeSlot: slot1,
      nowInput: `${dateToday}T07:45:00+07:00`,
    });

    assert(
      claimA.success === true && claimA.claimedCount === 5,
      'STEP 4: Courier A claims Pickup slot and receives exactly 5 orders (Max Capacity)'
    );

    // -------------------------------------------------------------------------
    // STEP 5: Courier B Claims Remaining 3 Orders
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5: Courier B Atomic Claim (Remaining Orders) ---');
    authService.setCurrentUser(courierB);
    const claimB = await courierJobPoolService.claimCourierSlotAsync({
      courierId: courierB.id,
      jobDate: dateToday,
      jobType: 'pickup',
      timeSlot: slot1,
      nowInput: `${dateToday}T07:45:00+07:00`,
    });

    const overlap = claimA.claimedOrderIds.filter((id) => claimB.claimedOrderIds.includes(id));
    assert(
      claimB.success === true && claimB.claimedCount === 3 && overlap.length === 0,
      'STEP 5: Courier B claims remaining 3 orders cleanly with 0 duplicate order IDs'
    );

    // -------------------------------------------------------------------------
    // STEP 6: Individual Order Status Updates for Courier A
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6: Individual Status Updates (Assigned -> Picked Up) ---');
    const orderA1Id = claimA.claimedOrderIds[0];
    await orderService.updateOrderStatusAsync(orderA1Id, 'picked_up', 'Driver A picked up laundry from customer', courierA.id);
    const updatedA1 = await orderService.getOrderByIdAsync(orderA1Id);

    assert(
      updatedA1?.status === 'picked_up' && updatedA1?.courierId === courierA.id,
      'STEP 6: Courier A successfully updates individual order status to picked_up'
    );

    // -------------------------------------------------------------------------
    // STEP 7 & 8: Pickup -> Washing -> Ready for Delivery -> Delivery Job Pool (Courier A != Courier B)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7 & 8: Full Lifecycle & Delivery Courier Handoff ---');
    // Weigh order & move to in_washing
    await orderService.updateActualWeightAndRecalculatePriceAsync(orderA1Id, 5, { id: 'usr_owner_01', role: 'laundry_owner', laundryId: 'lnd_001' });
    await orderService.updateOrderStatusAsync(orderA1Id, 'in_washing', 'Outlet verified weight and started washing', 'usr_owner_01');

    // Washing complete -> ready_for_delivery (courier_id reset to NULL)
    const rawOrderInMem = orderService.getOrders().find((o) => o.id === orderA1Id);
    if (rawOrderInMem) {
      rawOrderInMem.deliveryDate = dateToday;
      rawOrderInMem.deliveryTimeSlot = slot1;
    }
    await orderService.updateOrderStatusAsync(orderA1Id, 'ready_for_delivery', 'Washing completed, ready for delivery pool', 'usr_owner_01');
    const readyForDelivOrder = await orderService.getOrderByIdAsync(orderA1Id);

    const delivPoolRes = await courierJobPoolService.getCourierJobPoolAsync(dateToday, courierB.id, `${dateToday}T07:45:00+07:00`);
    const slot1DelivPool = delivPoolRes.deliverySlots.find((s) => s.timeSlot === slot1);

    assert(
      readyForDelivOrder?.courierId === undefined && (slot1DelivPool?.availableOrders ?? 0) >= 1,
      'STEP 7: Transition to ready_for_delivery resets courier_id to NULL and populates Delivery Job Pool'
    );

    // Courier B claims order #1 for Delivery (Pickup Courier A != Delivery Courier B)
    const delivClaimB = await courierJobPoolService.claimCourierSlotAsync({
      courierId: courierB.id,
      jobDate: dateToday,
      jobType: 'delivery',
      timeSlot: slot1,
      nowInput: `${dateToday}T07:45:00+07:00`,
    });

    const finalDelivOrder = await orderService.getOrderByIdAsync(orderA1Id);

    assert(
      delivClaimB.success === true && finalDelivOrder?.courierId === courierB.id && finalDelivOrder?.status === 'out_for_delivery',
      'STEP 8: Delivery Courier B claims order #1 (Pickup Courier A != Delivery Courier B successfully supported!)'
    );
  } finally {
    // -------------------------------------------------------------------------
    // STEP 9: Data Cleanup
    // -------------------------------------------------------------------------
    console.log('\n--- Step 9: Test Data Cleanup ---');
    const allOrders = orderService.getOrders();
    for (let i = allOrders.length - 1; i >= 0; i--) {
      if (createdOrderIds.includes(allOrders[i].id)) {
        allOrders.splice(i, 1);
      }
    }
    console.log(`Cleaned up ${createdOrderIds.length} smoke test orders from memory.`);
  }

  console.log('\n==================================================');
  console.log(`PHASE 6G PRODUCTION SMOKE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    console.error('OPERATIONAL ACCEPTANCE VERDICT: NO-GO ❌');
    process.exit(1);
  } else {
    console.log('OPERATIONAL ACCEPTANCE VERDICT: GO PRODUCTION READY 🚀');
  }
}

runPhase6gProductionSmokeTest().catch((err) => {
  console.error('Fatal Error running Phase 6G smoke test:', err);
  process.exit(1);
});
