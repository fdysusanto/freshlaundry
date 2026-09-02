import { dispatchService } from '../services/dispatchService';
import { courierJobPoolService } from '../services/courierJobPoolService';
import { orderService } from '../services/orderService';
import { COURIER_DISPATCH_MODE, TIME_SLOTS } from '../utils/constants';

async function runLegacyDispatchIsolationTests() {
  console.log('==================================================');
  console.log('RUNNING LEGACY DISPATCH ISOLATION SUITE');
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

  const dateToday = '2026-09-05';
  const slot1 = TIME_SLOTS[0]; // '08:00 - 10:00 WIB'

  function buildTestOrder(id: string, pickupDate: string, pickupSlot: string, status: any = 'pending', paymentStatus: any = 'paid') {
    const o = {
      id,
      trackingNumber: `LND-ISOL-${id}`,
      customerId: 'usr_customer_01',
      customerName: 'Customer Test',
      customerPhone: '081234567890',
      laundryId: 'lnd_001',
      courierId: undefined,
      serviceType: 'kiloan' as const,
      serviceName: 'Cuci Komplit',
      items: [{ id: `item_${id}`, serviceId: 'srv_001', name: 'Cuci Komplit', unitPrice: 8000, unit: 'kg' as const, quantity: 5, estimatedHours: 48 }],
      subtotalPrice: 40000,
      deliveryFee: 0,
      platformFee: 2000,
      totalPrice: 42000,
      status,
      paymentStatus,
      pickupAddress: 'Jl. Test Isolation',
      deliveryAddress: 'Jl. Test Isolation',
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

  // TEST 1 — COURIER_DISPATCH_MODE constant is set to 'slot_pool'
  assert(COURIER_DISPATCH_MODE === 'slot_pool', 'TEST 1: COURIER_DISPATCH_MODE default constant is explicitly "slot_pool"');

  // TEST 2 — Payment Confirmation does NOT trigger individual 1-to-1 dispatch batch push
  orderService.getOrders().length = 0;
  const testOrd = buildTestOrder('ord_iso_01', dateToday, slot1, 'pending', 'paid');

  const dispatchResult = await dispatchService.dispatchOrderAsync(testOrd.id, 'pickup', 'system_payment_webhook');
  assert(
    dispatchResult.hasActiveDispatch === false && Boolean(dispatchResult.message?.includes('SLOT_POOL_MODE_ACTIVE')),
    'TEST 2: Payment confirmation calls dispatchOrderAsync() -> Bypasses 1-to-1 batch push (hasActiveDispatch = false)'
  );

  // TEST 3 — Order remains available in Pickup Job Pool with courier_id = NULL
  const poolRes = await courierJobPoolService.getCourierJobPoolAsync(dateToday, undefined, `${dateToday}T07:45:00+07:00`);
  const slot1Pickup = poolRes.pickupSlots.find((s) => s.timeSlot === slot1);
  assert(
    Boolean(testOrd.courierId === undefined && slot1Pickup?.availableOrders === 1),
    'TEST 3: Paid order cleanly accumulates in Pickup Job Pool with courier_id = NULL'
  );

  // TEST 4 — Order transition to ready_for_delivery does NOT trigger individual delivery dispatch batch push
  orderService.getOrders().length = 0;
  const delivOrd = buildTestOrder('ord_iso_02', dateToday, slot1, 'ready_for_delivery', 'paid');
  delivOrd.deliveryDate = dateToday;
  delivOrd.deliveryTimeSlot = slot1;

  const delivDispatchResult = await dispatchService.dispatchOrderAsync(delivOrd.id, 'delivery', 'system_cron');
  assert(
    delivDispatchResult.hasActiveDispatch === false && Boolean(delivDispatchResult.message?.includes('SLOT_POOL_MODE_ACTIVE')),
    'TEST 4: Order ready_for_delivery calls dispatchOrderAsync() -> Bypasses 1-to-1 delivery batch push'
  );

  // TEST 5 — Order ready_for_delivery cleanly accumulates in Delivery Job Pool with courier_id = NULL
  const delivPoolRes = await courierJobPoolService.getCourierJobPoolAsync(dateToday, undefined, `${dateToday}T07:45:00+07:00`);
  const slot1Delivery = delivPoolRes.deliverySlots.find((s) => s.timeSlot === slot1);
  assert(
    Boolean(delivOrd.courierId === undefined && slot1Delivery?.availableOrders === 1),
    'TEST 5: Ready_for_delivery order cleanly accumulates in Delivery Job Pool with courier_id = NULL'
  );

  console.log('\n==================================================');
  console.log(`LEGACY DISPATCH ISOLATION TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLegacyDispatchIsolationTests().catch((err) => {
  console.error('Fatal Error running legacy dispatch isolation tests:', err);
  process.exit(1);
});
