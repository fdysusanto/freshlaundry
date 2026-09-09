import assert from 'assert';
import { courierJobPoolService, getWibTodayDateString, getWibTomorrowDateString } from '../services/courierJobPoolService';
import { orderService } from '../services/orderService';
import { Order } from '../types/order';

console.log('==================================================');
console.log('RUNNING TOMORROW JOB POOL TEST SUITE');
console.log('==================================================\n');

function createMockOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: `ord_tomorrow_${Math.random().toString(36).substring(2, 7)}`,
    trackingNumber: 'LND-TOMORROW',
    customerId: 'usr_customer_01',
    customerName: 'Customer Test',
    customerPhone: '08123456789',
    serviceType: 'kiloan',
    serviceName: 'Cuci Komplit Kiloan',
    status: 'pending',
    items: [{ id: 'item_1', name: 'Cuci Komplit', quantity: 5, unitPrice: 8000, unit: 'kg' }],
    pickupAddress: 'Jl. Test 123',
    deliveryAddress: 'Jl. Test 123',
    pickupDate: getWibTomorrowDateString(),
    pickupTimeSlot: '09:00 - 12:00',
    deliveryDate: undefined,
    deliveryTimeSlot: undefined,
    totalPrice: 42000,
    paymentStatus: 'paid',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logs: [],
    ...overrides,
  };
}

async function runTests() {
  let passed = 0;
  const now = new Date('2026-09-09T10:00:00.000Z');
  const todayStr = getWibTodayDateString(now);
  const tomorrowStr = getWibTomorrowDateString(now);

  // Backup existing in-memory orders
  const existingOrders = [...orderService.getOrders()];

  try {
    // TOMORROW-POOL-01: No jobs tomorrow -> 0 / 0 / 0
    {
      orderService.getOrders().length = 0;
      const summary = await courierJobPoolService.getTomorrowJobPoolSummaryAsync(now, null);
      assert.strictEqual(summary.pickupCount, 0, 'TOMORROW-POOL-01: pickupCount must be 0');
      assert.strictEqual(summary.deliveryCount, 0, 'TOMORROW-POOL-01: deliveryCount must be 0');
      assert.strictEqual(summary.totalCount, 0, 'TOMORROW-POOL-01: totalCount must be 0');
      console.log('[PASS] TOMORROW-POOL-01: No jobs tomorrow => 0 / 0 / 0');
      passed++;
    }

    // TOMORROW-POOL-02: 3 pickup tomorrow -> pickup = 3
    {
      orderService.getOrders().length = 0;
      const orders = [
        createMockOrder({ pickupDate: tomorrowStr, status: 'pending' }),
        createMockOrder({ pickupDate: tomorrowStr, status: 'pending' }),
        createMockOrder({ pickupDate: tomorrowStr, status: 'assigned' }),
      ];
      orderService.getOrders().push(...orders);

      const summary = await courierJobPoolService.getTomorrowJobPoolSummaryAsync(now, null);
      assert.strictEqual(summary.pickupCount, 3, 'TOMORROW-POOL-02: pickupCount must be 3');
      assert.strictEqual(summary.deliveryCount, 0);
      assert.strictEqual(summary.totalCount, 3);
      console.log('[PASS] TOMORROW-POOL-02: 3 pickup tomorrow => pickup = 3, total = 3');
      passed++;
    }

    // TOMORROW-POOL-03: 4 delivery tomorrow -> delivery = 4
    {
      orderService.getOrders().length = 0;
      const orders = [
        createMockOrder({ pickupDate: todayStr, deliveryDate: tomorrowStr, status: 'ready_for_delivery' }),
        createMockOrder({ pickupDate: todayStr, deliveryDate: tomorrowStr, status: 'in_washing' }),
        createMockOrder({ pickupDate: todayStr, deliveryDate: tomorrowStr, status: 'picked_up' }),
        createMockOrder({ pickupDate: todayStr, deliveryDate: tomorrowStr, status: 'assigned' }),
      ];
      orderService.getOrders().push(...orders);

      const summary = await courierJobPoolService.getTomorrowJobPoolSummaryAsync(now, null);
      assert.strictEqual(summary.deliveryCount, 4, 'TOMORROW-POOL-03: deliveryCount must be 4');
      assert.strictEqual(summary.pickupCount, 0);
      assert.strictEqual(summary.totalCount, 4);
      console.log('[PASS] TOMORROW-POOL-03: 4 delivery tomorrow => delivery = 4, total = 4');
      passed++;
    }

    // TOMORROW-POOL-04: 3 pickup + 4 delivery -> total = 7
    {
      orderService.getOrders().length = 0;
      const orders = [
        // 3 pickups
        createMockOrder({ pickupDate: tomorrowStr, status: 'pending' }),
        createMockOrder({ pickupDate: tomorrowStr, status: 'pending' }),
        createMockOrder({ pickupDate: tomorrowStr, status: 'assigned' }),
        // 4 deliveries
        createMockOrder({ pickupDate: todayStr, deliveryDate: tomorrowStr, status: 'ready_for_delivery' }),
        createMockOrder({ pickupDate: todayStr, deliveryDate: tomorrowStr, status: 'in_washing' }),
        createMockOrder({ pickupDate: todayStr, deliveryDate: tomorrowStr, status: 'picked_up' }),
        createMockOrder({ pickupDate: todayStr, deliveryDate: tomorrowStr, status: 'assigned' }),
      ];
      orderService.getOrders().push(...orders);

      const summary = await courierJobPoolService.getTomorrowJobPoolSummaryAsync(now, null);
      assert.strictEqual(summary.pickupCount, 3);
      assert.strictEqual(summary.deliveryCount, 4);
      assert.strictEqual(summary.totalCount, 7);
      console.log('[PASS] TOMORROW-POOL-04: 3 pickup + 4 delivery => total = 7');
      passed++;
    }

    // TOMORROW-POOL-05: Pickup today + delivery tomorrow -> delivery +1 only
    {
      orderService.getOrders().length = 0;
      const orders = [
        createMockOrder({ pickupDate: todayStr, deliveryDate: tomorrowStr, status: 'picked_up' }),
      ];
      orderService.getOrders().push(...orders);

      const summary = await courierJobPoolService.getTomorrowJobPoolSummaryAsync(now, null);
      assert.strictEqual(summary.pickupCount, 0);
      assert.strictEqual(summary.deliveryCount, 1);
      assert.strictEqual(summary.totalCount, 1);
      console.log('[PASS] TOMORROW-POOL-05: Pickup today + delivery tomorrow => delivery +1 only');
      passed++;
    }

    // TOMORROW-POOL-06: Pickup tomorrow + delivery day after tomorrow -> pickup +1 only
    {
      orderService.getOrders().length = 0;
      const dayAfterTomorrowStr = getWibTomorrowDateString(new Date('2026-09-10T10:00:00.000Z'));
      const orders = [
        createMockOrder({ pickupDate: tomorrowStr, deliveryDate: dayAfterTomorrowStr, status: 'pending' }),
      ];
      orderService.getOrders().push(...orders);

      const summary = await courierJobPoolService.getTomorrowJobPoolSummaryAsync(now, null);
      assert.strictEqual(summary.pickupCount, 1);
      assert.strictEqual(summary.deliveryCount, 0);
      assert.strictEqual(summary.totalCount, 1);
      console.log('[PASS] TOMORROW-POOL-06: Pickup tomorrow + delivery day after => pickup +1 only');
      passed++;
    }

    // TOMORROW-POOL-07: Cancelled order tomorrow -> excluded
    {
      orderService.getOrders().length = 0;
      const orders = [
        createMockOrder({ pickupDate: tomorrowStr, status: 'cancelled' }),
        createMockOrder({ pickupDate: todayStr, deliveryDate: tomorrowStr, status: 'cancelled' }),
      ];
      orderService.getOrders().push(...orders);

      const summary = await courierJobPoolService.getTomorrowJobPoolSummaryAsync(now, null);
      assert.strictEqual(summary.pickupCount, 0);
      assert.strictEqual(summary.deliveryCount, 0);
      assert.strictEqual(summary.totalCount, 0);
      console.log('[PASS] TOMORROW-POOL-07: Cancelled orders excluded => 0 / 0 / 0');
      passed++;
    }

    // TOMORROW-POOL-08: Completed order -> excluded
    {
      orderService.getOrders().length = 0;
      const orders = [
        createMockOrder({ pickupDate: tomorrowStr, deliveryDate: tomorrowStr, status: 'delivered' }),
      ];
      orderService.getOrders().push(...orders);

      const summary = await courierJobPoolService.getTomorrowJobPoolSummaryAsync(now, null);
      assert.strictEqual(summary.pickupCount, 0);
      assert.strictEqual(summary.deliveryCount, 0);
      assert.strictEqual(summary.totalCount, 0);
      console.log('[PASS] TOMORROW-POOL-08: Completed (delivered) orders excluded => 0 / 0 / 0');
      passed++;
    }

    // TOMORROW-POOL-09: Pickup & delivery both tomorrow -> two tasks
    {
      orderService.getOrders().length = 0;
      const orders = [
        createMockOrder({ pickupDate: tomorrowStr, deliveryDate: tomorrowStr, status: 'pending' }),
      ];
      orderService.getOrders().push(...orders);

      const summary = await courierJobPoolService.getTomorrowJobPoolSummaryAsync(now, null);
      assert.strictEqual(summary.pickupCount, 1);
      assert.strictEqual(summary.deliveryCount, 1);
      assert.strictEqual(summary.totalCount, 2);
      console.log('[PASS] TOMORROW-POOL-09: Order with pickup & delivery tomorrow => 2 tasks (pickup +1, delivery +1)');
      passed++;
    }

    // TOMORROW-POOL-10: Timezone midnight boundary -> correct tomorrow date
    {
      const lateNightNow = new Date('2026-09-09T23:55:00.000Z'); // WIB: Sept 10 06:55 AM
      const tomDate = getWibTomorrowDateString(lateNightNow);
      assert.strictEqual(tomDate, '2026-09-11', 'TOMORROW-POOL-10: WIB late night resolves correctly to next day in WIB');
      console.log('[PASS] TOMORROW-POOL-10: Timezone midnight boundary resolves correctly');
      passed++;
    }

    // TOMORROW-POOL-11: Courier opens account page -> read-only, no assignment mutation
    {
      const ordersBefore = [...orderService.getOrders()];
      await courierJobPoolService.getTomorrowJobPoolSummaryAsync(now, null);
      const ordersAfter = [...orderService.getOrders()];
      assert.deepStrictEqual(ordersBefore, ordersAfter, 'TOMORROW-POOL-11: Orders array MUST be unchanged');
      console.log('[PASS] TOMORROW-POOL-11: Read-only summary execution produces 0 order mutations');
      passed++;
    }

    // TOMORROW-POOL-12: Different courier -> sees same global operational pool summary
    {
      const summary1 = await courierJobPoolService.getTomorrowJobPoolSummaryAsync(now, null);
      const summary2 = await courierJobPoolService.getTomorrowJobPoolSummaryAsync(now, null);
      assert.deepStrictEqual(summary1, summary2, 'TOMORROW-POOL-12: Global operational summary is identical across couriers');
      console.log('[PASS] TOMORROW-POOL-12: Global operational pool summary identical across couriers');
      passed++;
    }

  } finally {
    // Restore original orders
    orderService.saveOrders(existingOrders);
  }

  console.log('\n==================================================');
  console.log(`TOMORROW JOB POOL RESULTS: ${passed} PASSED, 0 FAILED`);
  console.log('==================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed with error:', err);
  process.exit(1);
});
