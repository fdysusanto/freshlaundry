import { orderService } from '../services/orderService';
import { paymentService } from '../services/paymentService';
import { DEMO_USERS } from '../utils/constants';
import { Order } from '../types/order';

export async function runOptionBWeightStatusGuardTests() {
  console.log('==================================================');
  console.log('RUNNING OPTION B WEIGHT STATUS GUARD TEST SUITE');
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
  const customerA = DEMO_USERS.find((u) => u.role === 'customer') || DEMO_USERS[0];

  function createMockOrder(id: string, status: any, courierId = courierA.id, laundryId = 'lnd_001'): Order {
    return {
      id,
      trackingNumber: `LND-GUARD-${id}`,
      customerId: customerA.id,
      customerName: 'Customer Test Guard',
      customerPhone: '081299990000',
      laundryId,
      courierId,
      serviceType: 'kiloan',
      serviceName: 'Cuci Komplit',
      items: [
        {
          id: `item_${id}`,
          serviceId: 'srv_001',
          name: 'Cuci Komplit',
          unitPrice: 8000,
          unit: 'kg',
          quantity: 3,
          minWeightSnapshot: 1,
          subtotal: 24000,
        },
      ],
      estimatedWeightKg: 3,
      courierWeightKg: undefined,
      finalWeightKg: undefined,
      weightFinalizedAt: undefined,
      weightFinalizedBy: undefined,
      subtotal: 24000,
      deliveryFee: 5000,
      platformFee: 2000,
      discount: 0,
      totalPrice: 31000,
      status,
      paymentStatus: 'paid',
      pickupAddress: 'Jl. Guard No. 1',
      deliveryAddress: 'Jl. Guard No. 1',
      pickupDate: '2026-09-05',
      pickupTimeSlot: '09:00 - 12:00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      logs: [],
    };
  }

  // Seed mock orders with different statuses
  const orderPending = createMockOrder('guard_pending', 'pending');
  const orderAssigned = createMockOrder('guard_assigned', 'assigned');
  const orderPickedUp = createMockOrder('guard_picked_up', 'picked_up');
  const orderWashing = createMockOrder('guard_washing', 'in_washing');

  const existingOrders = orderService.getOrders();
  orderService.saveOrders([orderPending, orderAssigned, orderPickedUp, orderWashing, ...existingOrders]);

  // TEST A: Courier preliminary weight on PENDING -> BLOCKED
  try {
    let blocked = false;
    try {
      await orderService.saveCourierPreliminaryWeightAsync(orderPending.id, 4.2);
    } catch (err: any) {
      blocked = err.message.includes('Penimbangan Ditolak');
    }
    assert(blocked, 'TEST A: Courier preliminary weight on PENDING is BLOCKED');
  } catch (err: any) {
    assert(false, `TEST A Exception: ${err.message}`);
  }

  // TEST B: Courier preliminary weight on ASSIGNED -> ALLOWED
  try {
    const resB = await orderService.saveCourierPreliminaryWeightAsync(orderAssigned.id, 4.2);
    assert(resB.order.courierWeightKg === 4.2, 'TEST B: Courier preliminary weight on ASSIGNED is ALLOWED');
  } catch (err: any) {
    assert(false, `TEST B Exception: ${err.message}`);
  }

  // TEST C: Courier preliminary weight on PICKED_UP -> ALLOWED
  try {
    const resC = await orderService.saveCourierPreliminaryWeightAsync(orderPickedUp.id, 4.2);
    assert(resC.order.courierWeightKg === 4.2, 'TEST C: Courier preliminary weight on PICKED_UP is ALLOWED');
  } catch (err: any) {
    assert(false, `TEST C Exception: ${err.message}`);
  }

  // TEST D: Laundry finalization on PENDING -> BLOCKED
  try {
    let blocked = false;
    try {
      await orderService.finalizeLaundryWeightAsync(orderPending.id, 5.0);
    } catch (err: any) {
      blocked = err.message.includes('Penimbangan Ditolak');
    }
    assert(blocked, 'TEST D: Laundry finalization on PENDING is BLOCKED');
  } catch (err: any) {
    assert(false, `TEST D Exception: ${err.message}`);
  }

  // TEST E: Laundry finalization on ASSIGNED -> BLOCKED
  try {
    let blocked = false;
    try {
      await orderService.finalizeLaundryWeightAsync(orderAssigned.id, 5.0);
    } catch (err: any) {
      blocked = err.message.includes('Penimbangan Ditolak');
    }
    assert(blocked, 'TEST E: Laundry finalization on ASSIGNED is BLOCKED');
  } catch (err: any) {
    assert(false, `TEST E Exception: ${err.message}`);
  }

  // TEST F: Laundry finalization on PICKED_UP -> ALLOWED
  try {
    const resF = await orderService.finalizeLaundryWeightAsync(orderPickedUp.id, 4.5);
    assert(resF.order.finalWeightKg === 4.5, 'TEST F: Laundry finalization on PICKED_UP is ALLOWED');
    assert(resF.priceDelta > 0, 'TEST F: Price delta calculated correctly on finalization');
  } catch (err: any) {
    assert(false, `TEST F Exception: ${err.message}`);
  }

  // TEST G: Laundry finalization on IN_WASHING -> BLOCKED
  try {
    let blocked = false;
    try {
      await orderService.finalizeLaundryWeightAsync(orderWashing.id, 5.0);
    } catch (err: any) {
      blocked = err.message.includes('Penimbangan Ditolak');
    }
    assert(blocked, 'TEST G: Laundry finalization on IN_WASHING is BLOCKED');
  } catch (err: any) {
    assert(false, `TEST G Exception: ${err.message}`);
  }

  // TEST H: Direct API bypass attempt on PENDING order -> BLOCKED
  try {
    const mockReq = {
      json: async () => ({ action: 'finalize', finalWeightKg: 5.0 }),
      headers: { get: () => null },
    };
    // Direct service layer status check simulates API route check
    const orderBefore = (await orderService.getOrderByIdAsync(orderPending.id))!;
    assert(orderBefore.finalWeightKg === undefined, 'TEST H.1: Order pending finalWeightKg is undefined initially');
    
    let apiBlocked = false;
    try {
      await orderService.finalizeLaundryWeightAsync(orderPending.id, 5.0);
    } catch (err: any) {
      apiBlocked = true;
    }
    assert(apiBlocked, 'TEST H.2: Direct finalize attempt on PENDING rejected without financial recalculation');

    const orderAfter = (await orderService.getOrderByIdAsync(orderPending.id))!;
    assert(orderAfter.totalPrice === 31000, 'TEST H.3: Order totalPrice unchanged after rejected finalize attempt');
  } catch (err: any) {
    assert(false, `TEST H Exception: ${err.message}`);
  }

  // TEST I: Existing paid adjustment lock remains functional
  try {
    const orderPaidLock = createMockOrder('guard_paid_lock', 'picked_up');
    orderService.saveOrders([orderPaidLock, ...orderService.getOrders()]);
    
    await orderService.finalizeLaundryWeightAsync(orderPaidLock.id, 5.0);
    const adj = await paymentService.createAdjustmentPaymentAttemptAsync(orderPaidLock.id, 16000);
    if (adj) {
      await paymentService.transitionPaymentStatusAsync(adj.id, 'paid', 'Paid adjustment');
    }

    let lockBlocked = false;
    try {
      await orderService.finalizeLaundryWeightAsync(orderPaidLock.id, 6.0);
    } catch (err: any) {
      lockBlocked = err.message.includes('Penimbangan Ditolak');
    }
    assert(lockBlocked, 'TEST I: Paid adjustment lock functional');
  } catch (err: any) {
    assert(false, `TEST I Exception: ${err.message}`);
  }

  // TEST J: Existing courier financial isolation remains functional
  try {
    const orderIsolation = createMockOrder('guard_isolation', 'picked_up');
    orderService.saveOrders([orderIsolation, ...orderService.getOrders()]);

    const resPrelim = await orderService.saveCourierPreliminaryWeightAsync(orderIsolation.id, 4.2);
    assert(resPrelim.order.courierWeightKg === 4.2, 'TEST J.1: Preliminary weight saved');
    assert(resPrelim.order.finalWeightKg === undefined, 'TEST J.2: finalWeightKg remains undefined');
    assert(resPrelim.order.totalPrice === 31000, 'TEST J.3: totalPrice unchanged (financial isolation intact)');
  } catch (err: any) {
    assert(false, `TEST J Exception: ${err.message}`);
  }

  console.log(`\n==================================================`);
  console.log(`OPTION B WEIGHT STATUS GUARD TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  return { passed, failed };
}

if (require.main === module) {
  runOptionBWeightStatusGuardTests().catch((e) => {
    console.error('Fatal Test Runner Exception:', e);
    process.exit(1);
  });
}
