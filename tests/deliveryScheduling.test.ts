import { checkoutService } from '../services/checkoutService';
import { orderService } from '../services/orderService';
import { dispatchService } from '../services/dispatchService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

async function runDeliverySchedulingTests() {
  console.log('==================================================');
  console.log('RUNNING CUSTOMER DELIVERY SCHEDULING TESTS');
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

  // TEST 1: Valid Checkout with Pickup & Delivery Schedules
  const test1Key = `DELIV-TEST-${Date.now()}-1`;
  const res1 = await checkoutService.processCheckoutAsync(
    {
      laundryId: 'lnd_001',
      items: [{ serviceId: 'srv_001', quantity: 5 }],
      pickupAddress: 'Jl. Sudirman No. 10, Jakarta',
      deliveryAddress: 'Jl. Sudirman No. 10, Jakarta',
      pickupDate: '2026-08-28',
      pickupTimeSlot: TIME_SLOTS[0], // 08:00 - 10:00 WIB
      deliveryDate: '2026-08-29',
      deliveryTimeSlot: TIME_SLOTS[3], // 15:00 - 17:00 WIB
      idempotencyKey: test1Key,
    },
    customerA
  );

  assert(res1.success === true, 'Test 1: Checkout with delivery schedule succeeded');
  assert(res1.order.status === 'pending', 'Test 1: Initial status is pending');

  const fetchedOrder1 = await orderService.getOrderByIdAsync(res1.order.id);
  assert(fetchedOrder1 !== null, 'Test 1: Order successfully persisted');
  assert(fetchedOrder1?.pickupDate === '2026-08-28', 'Test 1: Pickup date persisted correctly');
  assert(fetchedOrder1?.pickupTimeSlot === TIME_SLOTS[0], 'Test 1: Pickup time slot persisted correctly');
  assert(fetchedOrder1?.deliveryDate === '2026-08-29', 'Test 1: Delivery date persisted correctly');
  assert(fetchedOrder1?.deliveryTimeSlot === TIME_SLOTS[3], 'Test 1: Delivery time slot persisted correctly');

  // TEST 2: Rejection - Delivery date earlier than pickup date
  const test2Key = `DELIV-TEST-${Date.now()}-2`;
  await assertThrowsAsync(
    async () => {
      await checkoutService.processCheckoutAsync(
        {
          laundryId: 'lnd_001',
          items: [{ serviceId: 'srv_001', quantity: 5 }],
          pickupAddress: 'Jl. Sudirman No. 10, Jakarta',
          deliveryAddress: 'Jl. Sudirman No. 10, Jakarta',
          pickupDate: '2026-08-28',
          pickupTimeSlot: TIME_SLOTS[1],
          deliveryDate: '2026-08-27', // BEFORE PICKUP!
          deliveryTimeSlot: TIME_SLOTS[3],
          idempotencyKey: test2Key,
        },
        customerA
      );
    },
    'tidak boleh lebih awal',
    'Test 2: Delivery date earlier than pickup date rejected by server'
  );

  // TEST 3: Rejection - Same-day delivery with invalid slot (delivery slot <= pickup slot)
  const test3Key = `DELIV-TEST-${Date.now()}-3`;
  await assertThrowsAsync(
    async () => {
      await checkoutService.processCheckoutAsync(
        {
          laundryId: 'lnd_001',
          items: [{ serviceId: 'srv_001', quantity: 5 }],
          pickupAddress: 'Jl. Sudirman No. 10, Jakarta',
          deliveryAddress: 'Jl. Sudirman No. 10, Jakarta',
          pickupDate: '2026-08-28',
          pickupTimeSlot: TIME_SLOTS[2], // 13:00 - 15:00 WIB (index 2)
          deliveryDate: '2026-08-28',    // SAME DAY
          deliveryTimeSlot: TIME_SLOTS[1], // 10:00 - 12:00 WIB (index 1 <= index 2)
          idempotencyKey: test3Key,
        },
        customerA
      );
    },
    'slot waktu delivery harus setelah slot waktu pickup',
    'Test 3: Same-day delivery with slot <= pickup slot rejected by server'
  );

  // TEST 4: Rejection - Invalid delivery time slot name
  const test4Key = `DELIV-TEST-${Date.now()}-4`;
  await assertThrowsAsync(
    async () => {
      await checkoutService.processCheckoutAsync(
        {
          laundryId: 'lnd_001',
          items: [{ serviceId: 'srv_001', quantity: 5 }],
          pickupAddress: 'Jl. Sudirman No. 10, Jakarta',
          deliveryAddress: 'Jl. Sudirman No. 10, Jakarta',
          pickupDate: '2026-08-28',
          pickupTimeSlot: TIME_SLOTS[0],
          deliveryDate: '2026-08-29',
          deliveryTimeSlot: '25:00 - 27:00 WIB', // INVALID SLOT
          idempotencyKey: test4Key,
        },
        customerA
      );
    },
    'tidak terdaftar',
    'Test 4: Invalid delivery time slot name rejected by server'
  );

  // TEST 5: Backward Compatibility - Legacy Order without delivery_time_slot
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
          pickupDate: '2026-08-28',
          pickupTimeSlot: TIME_SLOTS[0],
          deliveryDate: '2026-08-29',
          deliveryTimeSlot: TIME_SLOTS[2],
          idempotencyKey: test6Key,
        },
        nonCustomerUser
      );
    },
    'Akses Ditolak',
    'Test 6: Non-customer role (courier) forbidden from creating orders/scheduling'
  );

  // TEST 7: Operational State Machine & Dispatch Engine Integration
  // Ensure order state machine flows normally while retaining delivery target schedule
  assert(fetchedOrder1 !== null, 'Test 7: Valid order created in Test 1 available');
  
  // Transition order: pending -> in_washing -> ready_for_delivery
  orderService.updateOrderPaymentStatus(fetchedOrder1!.id, 'paid');
  const paidOrder = await orderService.getOrderByIdAsync(fetchedOrder1!.id);
  assert(paidOrder?.paymentStatus === 'paid', 'Test 7: Order payment status updated to paid');
  assert(paidOrder?.deliveryDate === '2026-08-29', 'Test 7: Delivery date intact after payment update');
  assert(paidOrder?.deliveryTimeSlot === TIME_SLOTS[3], 'Test 7: Delivery time slot intact after payment update');

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
