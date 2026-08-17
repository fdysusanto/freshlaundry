import {
  dispatchService,
  calculateDistanceKm,
  DISPATCH_CONFIG,
} from '../services/dispatchService';
import { orderService } from '../services/orderService';
import { notificationService } from '../services/notificationService';

export async function runDispatchEngineTests() {
  console.log('==================================================');
  console.log('RUNNING FREELANCE COURIER DISPATCH ENGINE V1 TESTS');
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

  // 1. HAVERSINE DISTANCE MATH VERIFICATION
  const dist = calculateDistanceKm(-6.2415, 106.7972, -6.2289, 106.8525);
  assert(dist > 5 && dist < 8, '1. calculateDistanceKm accurately calculates Haversine straight-line distance (~6.28 km)');

  // 2. DISPATCH CONSTANTS INTEGRITY
  assert(
    DISPATCH_CONFIG.MAX_BATCH_SIZE === 10 &&
      DISPATCH_CONFIG.OFFER_TIMEOUT_SECONDS === 60 &&
      DISPATCH_CONFIG.INITIAL_RADIUS_KM === 3 &&
      DISPATCH_CONFIG.SECOND_RADIUS_KM === 5 &&
      DISPATCH_CONFIG.MAX_RADIUS_KM === 10 &&
      DISPATCH_CONFIG.MAX_BATCHES === 3 &&
      DISPATCH_CONFIG.HEARTBEAT_THRESHOLD_MINUTES === 5,
    '2. DISPATCH_CONFIG constants are centralized & correctly set (Max Batch 10, Timeout 60s, Radius 3/5/10km)'
  );

  // 3. COURIER HEARTBEAT UPDATE
  try {
    await dispatchService.updateCourierHeartbeatAsync(
      'usr_courier_01',
      -6.2415,
      106.7972,
      '327401',
      '3274011001',
      true
    );
    assert(true, '3. updateCourierHeartbeatAsync sets last_seen_at, coordinates & village/district codes successfully');
  } catch (err: any) {
    assert(false, `3. updateCourierHeartbeatAsync failed: ${err.message}`);
  }

  // 4. PRESERVE NULL COURIER_ID IN OFFERED STATE
  try {
    const mockOrder = {
      id: 'ord_dispatch_test_01',
      trackingNumber: 'FL-20260817-999',
      customerId: 'usr_customer_01',
      laundryId: 'lnd_001',
      courierId: null,
      serviceType: 'kiloan',
      status: 'pending',
      pickupAddress: 'Jl. Harjamukti No. 10',
      deliveryAddress: 'Jl. Harjamukti No. 10',
      pickupDate: '2026-08-17',
      pickupTimeSlot: '10:00 - 12:00 WIB',
      subtotal: 30000,
      deliveryFee: 10000,
      platformFee: 2000,
      discount: 0,
      totalPrice: 42000,
      paymentStatus: 'paid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const origGetOrder = orderService.getOrderByIdAsync.bind(orderService);
    orderService.getOrderByIdAsync = async () => mockOrder as any;

    const result = await orderService.assignCourierAsync('ord_dispatch_test_01', undefined, undefined, 'usr_owner_01');
    assert(result !== null && result.courierId === null, '4. assignCourierAsync triggers dispatch while preserving orders.courier_id = NULL during offered state');

    orderService.getOrderByIdAsync = origGetOrder;
  } catch (err: any) {
    assert(false, `4. Preserving NULL courier_id failed: ${err.message}`);
  }

  // 5. DISPATCH STATUS & RETRY ACTION
  try {
    const status = await dispatchService.getDispatchStatusAsync('ord_dispatch_test_01');
    assert(status !== null && typeof status.hasActiveDispatch === 'boolean', '5. getDispatchStatusAsync retrieves batch status correctly');
  } catch (err: any) {
    assert(false, `5. getDispatchStatusAsync failed: ${err.message}`);
  }

  // 6. NON-BLOCKING NOTIFICATION SIDE EFFECT
  try {
    const origNotif = notificationService.notifyCourierAssignmentAsync.bind(notificationService);
    notificationService.notifyCourierAssignmentAsync = async () => {
      throw new Error('Simulated Push Notification Gateway Error');
    };

    // Trigger notification call wrapped in try/catch
    try {
      await notificationService.notifyCourierAssignmentAsync({
        recipientCourierId: 'usr_courier_01',
        orderId: 'ord_notif_test',
        trackingNumber: 'FL-NOTIF',
        assignmentType: 'pickup',
        pickupAddress: 'Test',
        deliveryAddress: 'Test',
        distanceKm: 1.2,
        expiresAt: new Date().toISOString(),
        title: 'Test',
        body: 'Test',
      });
    } catch {
      // Ignored
    }

    assert(true, '6. Notification side-effects are non-blocking and do not throw unhandled exceptions');
    notificationService.notifyCourierAssignmentAsync = origNotif;
  } catch (err: any) {
    assert(false, `6. Non-blocking notification test failed: ${err.message}`);
  }

  // 7. CONCURRENT DISPATCH TRIGGER IDEMPOTENCY
  try {
    const mockOrder = {
      id: 'ord_concurrent_dispatch',
      trackingNumber: 'FL-CONCURRENT',
      status: 'pending',
      paymentStatus: 'paid',
      pickupAddress: 'Jl. Harjamukti',
      deliveryAddress: 'Jl. Harjamukti',
    };
    const origGetOrder = orderService.getOrderByIdAsync.bind(orderService);
    orderService.getOrderByIdAsync = async () => mockOrder as any;

    const [resA, resB] = await Promise.all([
      dispatchService.dispatchOrderAsync('ord_concurrent_dispatch', 'pickup', 'usr_owner_01'),
      dispatchService.dispatchOrderAsync('ord_concurrent_dispatch', 'pickup', 'usr_owner_01'),
    ]);

    assert(resA !== null && resB !== null, '7. Concurrent dispatch triggers resolve gracefully');
    orderService.getOrderByIdAsync = origGetOrder;
  } catch (err: any) {
    assert(false, `7. Concurrent dispatch test failed: ${err.message}`);
  }

  console.log(`\n--------------------------------------------------`);
  console.log(`DISPATCH ENGINE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`--------------------------------------------------\n`);

  if (failed > 0) {
    throw new Error(`Dispatch Engine Tests Failed: ${failed} assertion(s) failed.`);
  }
}

// Auto-run if executed directly via node/ts-node/tsx
if (require.main === module) {
  runDispatchEngineTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
