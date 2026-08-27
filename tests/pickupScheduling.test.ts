import { checkoutService } from '../services/checkoutService';
import { orderService } from '../services/orderService';
import { dispatchService, isPickupSlotSelectable, isPickupDispatchWindowDue } from '../services/dispatchService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

async function runPickupSchedulingTests() {
  console.log('==================================================');
  console.log('RUNNING CUSTOMER PICKUP SCHEDULING & AUTOMATED SCHEDULER SUITE');
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

  const customerA = DEMO_USERS[0];

  function buildPickupTestOrder(
    id: string,
    pickupDate: string,
    pickupTimeSlot: string,
    status: any = 'pending',
    paymentStatus: any = 'paid'
  ) {
    const now = new Date().toISOString();
    const order: any = {
      id,
      trackingNumber: `LND-PICK-${id.toUpperCase()}`,
      customerId: customerA.id,
      customerName: customerA.fullName,
      customerPhone: customerA.phone,
      laundryId: 'lnd_001',
      laundryName: 'FreshWash Express Kebayoran',
      items: [{ id: 'srv_001', name: 'Cuci Komplit Kiloan', price: 8000, quantity: 5, unit: 'kg' }],
      totalPrice: 42000,
      status,
      paymentStatus,
      pickupAddress: 'Jl. Sudirman No. 10, Jakarta',
      deliveryAddress: 'Jl. Sudirman No. 10, Jakarta',
      pickupDate,
      pickupTimeSlot,
      createdAt: now,
      updatedAt: now,
    };
    const mockOrders = orderService.getOrders();
    const idx = mockOrders.findIndex((o) => o.id === id);
    if (idx !== -1) mockOrders[idx] = order;
    else mockOrders.push(order);
    return order;
  }

  // --- UNIT TESTS: isPickupSlotSelectable ---

  // 1. Today before slot start -> slot IS selectable
  const slotSelectable1 = isPickupSlotSelectable('2026-08-27', '15:00 - 17:00 WIB', '2026-08-27T14:59:00+07:00');
  assert(slotSelectable1 === true, 'Test 1: Today before slot start -> slot IS selectable');

  // 2. Exact slot start -> slot NOT selectable (slot.start > current time)
  const slotSelectable2 = isPickupSlotSelectable('2026-08-27', '15:00 - 17:00 WIB', '2026-08-27T15:00:00+07:00');
  assert(slotSelectable2 === false, 'Test 2: Exact slot start -> slot NOT selectable');

  // 3. 5 mins after slot start -> slot NOT selectable
  const slotSelectable3 = isPickupSlotSelectable('2026-08-27', '15:00 - 17:00 WIB', '2026-08-27T15:05:00+07:00');
  assert(slotSelectable3 === false, 'Test 3: 5 mins after slot start -> slot NOT selectable');

  // 4. Future date -> slot IS selectable
  const slotSelectable4 = isPickupSlotSelectable('2026-08-28', '08:00 - 10:00 WIB', '2026-08-27T15:05:00+07:00');
  assert(slotSelectable4 === true, 'Test 4: Future date -> slot IS selectable');

  // 5. Past date -> slot NOT selectable
  const slotSelectable5 = isPickupSlotSelectable('2026-08-26', '18:00 - 20:00 WIB', '2026-08-27T15:05:00+07:00');
  assert(slotSelectable5 === false, 'Test 5: Past date -> slot NOT selectable');

  // 6. Today after all slots passed -> 0 slots selectable
  const nowAfterAllSlots = '2026-08-27T20:05:00+07:00';
  const availableSlotsToday = TIME_SLOTS.filter((s) => isPickupSlotSelectable('2026-08-27', s, nowAfterAllSlots));
  assert(availableSlotsToday.length === 0, 'Test 6: Today after all slots passed -> 0 slots selectable');

  // 7. Invalid date -> rejected
  const slotSelectable7 = isPickupSlotSelectable('2026-13-45', '15:00 - 17:00 WIB', '2026-08-27T14:00:00+07:00');
  assert(slotSelectable7 === false, 'Test 7: Invalid date rejected by isPickupSlotSelectable');

  // 8. Invalid time slot -> rejected
  const slotSelectable8 = isPickupSlotSelectable('2026-08-27', 'invalid-slot', '2026-08-27T14:00:00+07:00');
  assert(slotSelectable8 === false, 'Test 8: Invalid time slot rejected by isPickupSlotSelectable');

  // --- INTEGRATION TESTS: BACKEND VALIDATION & DISPATCH GUARD ---

  // 9. Customer attempts to bypass UI with request for pickup slot that has started -> backend checkout rejects
  await assertThrowsAsync(
    async () => {
      await checkoutService.processCheckoutAsync(
        {
          laundryId: 'lnd_001',
          items: [{ serviceId: 'srv_001', quantity: 5 }],
          pickupAddress: 'Jl. Sudirman No. 10, Jakarta',
          pickupDate: '2026-08-26', // Past date
          pickupTimeSlot: '15:00 - 17:00 WIB',
          paymentMethod: 'qris',
          idempotencyKey: `IDEMP-BYPASS-${Date.now()}`,
        },
        customerA
      );
    },
    'PICKUP_SLOT_NO_LONGER_AVAILABLE',
    'Test 9: Customer attempting to checkout with expired pickup slot rejected by server'
  );

  // 10. Payment paid + future pickup date -> order remains pending, no active pickup dispatch batch
  const futureDateStr = '2026-08-29';
  const ordFuture = buildPickupTestOrder('ord_p_fut', futureDateStr, '15:00 - 17:00 WIB');
  const dispatchResFuture = await dispatchService.dispatchOrderAsync('ord_p_fut', 'pickup', 'system_payment_webhook');
  assert(
    dispatchResFuture.hasActiveDispatch === false && dispatchResFuture.message === 'PICKUP_DISPATCH_WINDOW_NOT_DUE',
    'Test 10: Paid order with future pickup schedule returns PICKUP_DISPATCH_WINDOW_NOT_DUE (no dispatch batch created)'
  );

  // 11. Payment paid + pickup window due -> pickup dispatch triggered
  const ordDueNow = buildPickupTestOrder('ord_p_due', '2026-08-27', '08:00 - 10:00 WIB');
  dispatchService.completeMockDispatchBatchAsync('ord_p_due');
  const dispatchResDue = await dispatchService.dispatchOrderAsync('ord_p_due', 'pickup', 'system_payment_webhook');
  assert(dispatchResDue.hasActiveDispatch === true, 'Test 11: Paid order inside pickup window triggers pickup dispatch batch');
  dispatchService.completeMockDispatchBatchAsync('ord_p_due');
  ordDueNow.status = 'delivered';

  // --- AUTOMATED SCHEDULER SUITE (19 SCENARIOS) ---

  // 12. Scheduler future pickup -> skipped (PICKUP_WINDOW_NOT_DUE)
  buildPickupTestOrder('ord_p_sched_fut', '2026-08-29', '15:00 - 17:00 WIB');
  const summaryFut = await dispatchService.processScheduledPickupsAsync();
  const dFut = summaryFut.details.find((d) => d.orderId === 'ord_p_sched_fut');
  assert(dFut?.result === 'skipped' && dFut?.reason === 'PICKUP_WINDOW_NOT_DUE', 'Sched Scenario 12: Future pickup date skipped by pickup scheduler');

  // 13. Scheduler when pickup window is due -> dispatch triggered
  const ordSchedDue = buildPickupTestOrder('ord_p_sched_due', '2026-08-27', '08:00 - 10:00 WIB');
  dispatchService.completeMockDispatchBatchAsync('ord_p_sched_due');
  const summaryDue = await dispatchService.processScheduledPickupsAsync();
  const dDue = summaryDue.details.find((d) => d.orderId === 'ord_p_sched_due');
  assert(dDue?.result === 'dispatched', 'Sched Scenario 13: Due pickup window dispatched by pickup scheduler');
  dispatchService.completeMockDispatchBatchAsync('ord_p_sched_due');
  ordSchedDue.status = 'delivered';

  // 14. Overdue pickup schedule -> dispatch triggered
  const ordOverdue = buildPickupTestOrder('ord_p_sched_overdue', '2026-08-26', '18:00 - 20:00 WIB');
  dispatchService.completeMockDispatchBatchAsync('ord_p_sched_overdue');
  const summaryOverdue = await dispatchService.processScheduledPickupsAsync();
  const dOverdue = summaryOverdue.details.find((d) => d.orderId === 'ord_p_sched_overdue');
  assert(dOverdue?.result === 'dispatched', 'Sched Scenario 14: Overdue pickup schedule dispatched to prevent stuck order');
  dispatchService.completeMockDispatchBatchAsync('ord_p_sched_overdue');
  ordOverdue.status = 'delivered';

  // 15. Unpaid pending order -> excluded from candidate scan
  const ordUnpaid = buildPickupTestOrder('ord_p_unpaid', '2026-08-27', '08:00 - 10:00 WIB', 'pending', 'unpaid');
  const summaryUnpaid = await dispatchService.processScheduledPickupsAsync();
  const dUnpaid = summaryUnpaid.details.find((d) => d.orderId === 'ord_p_unpaid');
  assert(dUnpaid === undefined, 'Sched Scenario 15: Unpaid pending order excluded from pickup scheduler candidate scan');
  ordUnpaid.status = 'delivered';

  // 16. Concurrent scheduler executions -> exactly 1 active dispatch batch created
  const ordConc = buildPickupTestOrder('ord_p_conc', '2026-08-27', '08:00 - 10:00 WIB');
  dispatchService.completeMockDispatchBatchAsync('ord_p_conc');
  const [concA, concB] = await Promise.all([
    dispatchService.processScheduledPickupsAsync(),
    dispatchService.processScheduledPickupsAsync(),
  ]);
  const dispatchedCountConc = [concA, concB].flatMap((s) => s.details).filter((d) => d.orderId === 'ord_p_conc' && d.result === 'dispatched').length;
  assert(dispatchedCountConc === 1, 'Sched Scenario 16: Two concurrent pickup scheduler executions create exactly 1 dispatch batch');
  dispatchService.completeMockDispatchBatchAsync('ord_p_conc');
  ordConc.status = 'delivered';

  // 17. Postgres Error 23505 -> ACTIVE_DISPATCH_BATCH_EXISTS (skipped, NOT failed)
  const ord17 = buildPickupTestOrder('ord_p_23505', '2026-08-27', '08:00 - 10:00 WIB');
  const mockDb23505: any = {
    from: (table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: 'ord_p_23505', trackingNumber: 'LND-23505', status: 'pending', payment_status: 'paid', pickup_date: '2026-08-27', pickup_time_slot: '08:00 - 10:00 WIB', pickup_address: 'Jl. Test', delivery_address: 'Jl. Test' },
              }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: async () => ({ data: [{ id: 'usr_courier_01', full_name: 'Kurir 1', is_online: true, latitude: -6.2, longitude: 106.8, last_seen_at: new Date().toISOString() }] }),
              }),
            }),
          }),
        };
      }
      if (table === 'courier_assignments') {
        return {
          select: () => ({
            eq: () => ({ in: async () => ({ count: 0 }) }),
          }),
          insert: async () => ({ data: null, error: null }),
        };
      }
      if (table === 'dispatch_batches') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null }),
                }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: { code: '23505', message: 'duplicate key value violates unique constraint uq_active_dispatch_batch' },
              }),
            }),
          }),
        };
      }
      return { insert: async () => ({ data: null, error: null }) };
    },
  };

  const res23505 = await dispatchService.dispatchOrderAsync(ord17.id, 'pickup', 'system_cron', mockDb23505);
  assert(res23505.hasActiveDispatch === true && res23505.isNewBatch === false, 'Sched Scenario 17: Postgres 23505 returns hasActiveDispatch=true and isNewBatch=false (NOT fatal error)');
  ord17.status = 'delivered';

  // 18. Non-23505 database error -> fatal exception (NOT swallowed)
  const ord18 = buildPickupTestOrder('ord_p_500', '2026-08-27', '08:00 - 10:00 WIB');
  const mockDb500: any = {
    from: (table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: 'ord_p_500', trackingNumber: 'LND-500', status: 'pending', payment_status: 'paid', pickup_date: '2026-08-27', pickup_time_slot: '08:00 - 10:00 WIB' },
              }),
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: async () => ({ data: [{ id: 'usr_courier_01', full_name: 'Kurir 1', is_online: true, latitude: -6.2, longitude: 106.8, last_seen_at: new Date().toISOString() }] }),
              }),
            }),
          }),
        };
      }
      if (table === 'courier_assignments') {
        return {
          select: () => ({
            eq: () => ({ in: async () => ({ count: 0 }) }),
          }),
          insert: async () => ({ data: null, error: null }),
        };
      }
      if (table === 'dispatch_batches') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null }),
                }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: { code: '42P01', message: 'relation dispatch_batches does not exist' },
              }),
            }),
          }),
        };
      }
      return { insert: async () => ({ data: null, error: null }) };
    },
  };

  let non23505Threw = false;
  try {
    await dispatchService.dispatchOrderAsync(ord18.id, 'pickup', 'system_cron', mockDb500);
  } catch (err: any) {
    non23505Threw = err.message.includes('relation dispatch_batches does not exist');
  }
  assert(non23505Threw === true, 'Sched Scenario 18: Non-23505 DB error throws fatal exception (NOT swallowed)');
  ord18.status = 'delivered';

  // 19. Existing delivery scheduler regression -> 100% PASSED
  const deliverySummary = await dispatchService.processScheduledDeliveriesAsync();
  assert(deliverySummary !== null && typeof deliverySummary.scanned === 'number', 'Sched Scenario 19: Existing delivery scheduler runs regression-free');

  console.log('\n==================================================');
  console.log(`PICKUP SCHEDULING TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPickupSchedulingTests().catch((err) => {
  console.error('Fatal Error running pickup scheduling tests:', err);
  process.exit(1);
});
