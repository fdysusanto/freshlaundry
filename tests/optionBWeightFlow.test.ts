import { orderService } from '../services/orderService';
import { paymentService } from '../services/paymentService';
import { DEMO_USERS } from '../utils/constants';
import { Order } from '../types/order';

export async function runOptionBWeightFlowTests() {
  console.log('==================================================');
  console.log('RUNNING OPTION B WEIGHT FLOW TEST SUITE');
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

  function createMockOrder(id: string, courierId = courierA.id, status: any = 'picked_up', laundryId = 'lnd_001'): Order {
    return {
      id,
      trackingNumber: `LND-OPTB-${id}`,
      customerId: customerA.id,
      customerName: 'Customer Test Option B',
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
      pickupAddress: 'Jl. Test No. 1',
      deliveryAddress: 'Jl. Test No. 1',
      pickupDate: '2026-09-05',
      pickupTimeSlot: '09:00 - 12:00',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      logs: [],
    };
  }

  // Seed mock orders
  const orderA = createMockOrder('optb_ord_01');
  const orderB = createMockOrder('optb_ord_02');
  const orderC = createMockOrder('optb_ord_03');
  const orderD = createMockOrder('optb_ord_04');
  const orderE = createMockOrder('optb_ord_05');

  const existingOrders = orderService.getOrders();
  orderService.saveOrders([orderA, orderB, orderC, orderD, orderE, ...existingOrders]);

  // SCENARIO A: COURIER PRELIMINARY WEIGHT
  try {
    const resA = await orderService.saveCourierPreliminaryWeightAsync(orderA.id, 4.2, 'Timbangan awal kurir');
    assert(resA.order.courierWeightKg === 4.2, 'Scenario A.1: courierWeightKg saved as 4.2 kg');
    assert(resA.order.finalWeightKg === undefined, 'Scenario A.2: finalWeightKg remains undefined');
    assert(resA.order.totalPrice === 31000, 'Scenario A.3: totalPrice unchanged (no price recalculation)');

    const adjA = await paymentService.getAdjustmentPaymentStatusAsync(orderA.id);
    assert(!adjA.exists, 'Scenario A.4: NO adjustment payment attempt created on preliminary weigh');
  } catch (err: any) {
    assert(false, `Scenario A Exception: ${err.message}`);
  }

  // SCENARIO B: LAUNDRY CONFIRM COURIER WEIGHT
  try {
    await orderService.saveCourierPreliminaryWeightAsync(orderB.id, 4.2);
    const resB = await orderService.finalizeLaundryWeightAsync(orderB.id, 4.2, 'Pihak laundry konfirmasi berat kurir');
    assert(resB.order.finalWeightKg === 4.2, 'Scenario B.1: finalWeightKg set to 4.2 kg');
    assert(resB.order.weightFinalizedAt !== undefined, 'Scenario B.2: weightFinalizedAt is populated');
    assert(resB.priceDelta > 0, 'Scenario B.3: priceDelta recalculated (> 0 for 4.2 kg vs 3 kg est)');
    assert(resB.adjustmentPaymentAttempt !== null, 'Scenario B.4: Adjustment payment attempt created on finalization');
  } catch (err: any) {
    assert(false, `Scenario B Exception: ${err.message}`);
  }

  // SCENARIO C: LAUNDRY ADJUSTS COURIER WEIGHT
  try {
    await orderService.saveCourierPreliminaryWeightAsync(orderC.id, 4.2);
    const resC = await orderService.finalizeLaundryWeightAsync(orderC.id, 5.0, 'Laundry sesuaikan berat ke 5.0 kg');
    assert(resC.order.courierWeightKg === 4.2, 'Scenario C.1: courierWeightKg remains 4.2 kg');
    assert(resC.order.finalWeightKg === 5.0, 'Scenario C.2: finalWeightKg updated to 5.0 kg');
    assert(resC.order.items[0].quantity === 5.0, 'Scenario C.3: item quantity updated to 5.0 kg');
  } catch (err: any) {
    assert(false, `Scenario C Exception: ${err.message}`);
  }

  // SCENARIO D: PAYMENT CREATION ONLY AFTER FINALIZATION
  try {
    await orderService.saveCourierPreliminaryWeightAsync(orderD.id, 4.5);
    const adjBefore = await paymentService.getAdjustmentPaymentStatusAsync(orderD.id);
    assert(!adjBefore.exists, 'Scenario D.1: Payment attempts unchanged after preliminary weigh');

    const resD = await orderService.finalizeLaundryWeightAsync(orderD.id, 4.5);
    const adjAfter = await paymentService.getAdjustmentPaymentStatusAsync(orderD.id);
    assert(adjAfter.exists, 'Scenario D.2: Adjustment payment attempt exists ONLY after laundry finalization');
  } catch (err: any) {
    assert(false, `Scenario D Exception: ${err.message}`);
  }

  // SCENARIO E: PAID PAYMENT LOCK
  try {
    await orderService.finalizeLaundryWeightAsync(orderE.id, 5.0);
    // Mock paid adjustment
    const adjE = await paymentService.createAdjustmentPaymentAttemptAsync(orderE.id, 16000);
    if (adjE) {
      await paymentService.transitionPaymentStatusAsync(adjE.id, 'paid', 'Mock paid adjustment payment');
    }

    let lockBlocked = false;
    try {
      await orderService.finalizeLaundryWeightAsync(orderE.id, 6.0);
    } catch (lockErr: any) {
      lockBlocked = lockErr.message.includes('Penimbangan Ditolak');
    }
    assert(lockBlocked, 'Scenario E.1: Subsequent weight modification BLOCKED after payment adjustment is PAID');
  } catch (err: any) {
    assert(false, `Scenario E Exception: ${err.message}`);
  }

  // SCENARIO F: AUTHORIZATION
  try {
    let couriertoFinalizeBlocked = false;
    try {
      await orderService.saveCourierPreliminaryWeightAsync(orderA.id, 4.2);
      // Attempt preliminary weigh when already finalized
      await orderService.finalizeLaundryWeightAsync(orderB.id, 4.2);
      await orderService.saveCourierPreliminaryWeightAsync(orderB.id, 5.0);
    } catch (err: any) {
      couriertoFinalizeBlocked = err.message.includes('Penimbangan Ditolak');
    }
    assert(couriertoFinalizeBlocked, 'Scenario F.1: Courier preliminary weigh blocked after laundry finalization');
  } catch (err: any) {
    assert(false, `Scenario F Exception: ${err.message}`);
  }

  // SCENARIO G: UI INTEGRATION STATE RULES
  try {
    const freshOrder = (await orderService.getOrderByIdAsync(orderA.id))!;
    assert(freshOrder.courierWeightKg === 4.2, 'Scenario G.1: Preliminary weight visible for UI check');
    assert(freshOrder.weightFinalizedAt === undefined, 'Scenario G.2: weightFinalizedAt undefined triggers Verifikasi Berat button');

    const finalizedOrder = (await orderService.getOrderByIdAsync(orderB.id))!;
    assert(finalizedOrder.weightFinalizedAt !== undefined, 'Scenario G.3: weightFinalizedAt present hides Verifikasi Berat button');
  } catch (err: any) {
    assert(false, `Scenario G Exception: ${err.message}`);
  }

  console.log(`\n==================================================`);
  console.log(`OPTION B WEIGHT FLOW TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  return { passed, failed };
}

// Execute tests if run directly via ts-node
if (require.main === module) {
  runOptionBWeightFlowTests().catch((e) => {
    console.error('Fatal Test Runner Exception:', e);
    process.exit(1);
  });
}
