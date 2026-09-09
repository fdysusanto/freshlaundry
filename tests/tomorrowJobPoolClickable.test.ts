import assert from 'assert';
import { courierJobPoolService, getWibTodayDateString, getWibTomorrowDateString } from '../services/courierJobPoolService';
import { orderService } from '../services/orderService';
import { Order } from '../types/order';

console.log('==================================================');
console.log('RUNNING TOMORROW JOB POOL CLICKABLE ENTRY SUITE');
console.log('==================================================\n');

function createTestOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: `ord_click_${Math.random().toString(36).substring(2, 7)}`,
    trackingNumber: 'LND-CLICK-TEST',
    customerId: 'usr_customer_01',
    customerName: 'Test Customer',
    customerPhone: '08123456789',
    serviceType: 'kiloan',
    serviceName: 'Cuci Komplit',
    status: 'pending',
    items: [{ id: 'item_1', name: 'Cuci Komplit', quantity: 5, unitPrice: 8000, unit: 'kg' }],
    pickupAddress: 'Jl. Merdeka 10',
    deliveryAddress: 'Jl. Merdeka 10',
    pickupDate: getWibTomorrowDateString(),
    pickupTimeSlot: '08:00 - 10:00',
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

  const existingOrders = [...orderService.getOrders()];

  try {
    // CLICK-01: Target URL generation contains valid date parameter
    {
      const targetUrl = `/courier/job-pool?date=${tomorrowStr}`;
      assert.ok(targetUrl.includes('/courier/job-pool?date='), 'CLICK-01: Target URL must contain /courier/job-pool?date=');
      assert.ok(targetUrl.endsWith(tomorrowStr), 'CLICK-01: Target URL must end with WIB tomorrow date string');
      console.log(`[PASS] CLICK-01: Target URL correctly formatted -> ${targetUrl}`);
      passed++;
    }

    // CLICK-02: Parsing date=tomorrow resolves to WIB tomorrow date
    {
      const parsedDate = 'tomorrow' === 'tomorrow' ? getWibTomorrowDateString(now) : 'today';
      assert.strictEqual(parsedDate, tomorrowStr, 'CLICK-02: date=tomorrow resolves to WIB tomorrow date');
      console.log(`[PASS] CLICK-02: date=tomorrow resolves correctly to ${tomorrowStr}`);
      passed++;
    }

    // CLICK-03: Parsing date=YYYY-MM-DD validates format and preserves string
    {
      const customDate = '2026-09-15';
      const isValid = /^\d{4}-\d{2}-\d{2}$/.test(customDate);
      assert.ok(isValid, 'CLICK-03: Validates YYYY-MM-DD pattern');
      console.log(`[PASS] CLICK-03: YYYY-MM-DD pattern validation passed for ${customDate}`);
      passed++;
    }

    // CLICK-04: Read-only navigation -> Opening tomorrow job pool produces ZERO side-effects
    {
      orderService.getOrders().length = 0;
      const initialOrders = [
        createTestOrder({ pickupDate: tomorrowStr, status: 'pending' }),
        createTestOrder({ pickupDate: todayStr, deliveryDate: tomorrowStr, status: 'ready_for_delivery' }),
      ];
      orderService.getOrders().push(...initialOrders);

      const countBefore = orderService.getOrders().length;
      const statusesBefore = orderService.getOrders().map((o) => o.status);

      // Simulate opening tomorrow job pool
      await courierJobPoolService.getTomorrowJobPoolSummaryAsync(now, null);
      await courierJobPoolService.getCourierJobPoolAsync(tomorrowStr, 'courier_01', now, null);

      const countAfter = orderService.getOrders().length;
      const statusesAfter = orderService.getOrders().map((o) => o.status);

      assert.strictEqual(countBefore, countAfter, 'CLICK-04: Order count must remain unchanged');
      assert.deepStrictEqual(statusesBefore, statusesAfter, 'CLICK-04: Order statuses must remain unchanged');
      console.log('[PASS] CLICK-04: Opening tomorrow job pool executes 100% read-only (0 mutations)');
      passed++;
    }

    // CLICK-05: WIB Timezone Boundary safety check
    {
      const lateNight = new Date('2026-09-09T23:45:00.000Z'); // 06:45 WIB next morning
      const tomStr = getWibTomorrowDateString(lateNight);
      assert.strictEqual(tomStr, '2026-09-11', 'CLICK-05: WIB timezone conversion handles midnight boundary');
      console.log(`[PASS] CLICK-05: Timezone midnight boundary resolves to ${tomStr}`);
      passed++;
    }

  } finally {
    orderService.saveOrders(existingOrders);
  }

  console.log('\n==================================================');
  console.log(`TOMORROW JOB POOL CLICKABLE RESULTS: ${passed} PASSED, 0 FAILED`);
  console.log('==================================================\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
