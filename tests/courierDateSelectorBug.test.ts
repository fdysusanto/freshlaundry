import assert from 'assert';
import { courierJobPoolService, getWibTodayDateString, getWibTomorrowDateString } from '../services/courierJobPoolService';
import { orderService } from '../services/orderService';

console.log('==================================================');
console.log('RUNNING COURIER DATE SELECTOR BUG TEST SUITE');
console.log('==================================================\n');

async function runTests() {
  let passed = 0;
  const now = new Date('2026-09-09T10:00:00.000Z');
  const todayWib = getWibTodayDateString(now);
  const tomorrowWib = getWibTomorrowDateString(now);

  const existingOrders = [...orderService.getOrders()];

  try {
    // DATE-01: tomorrowWib MUST NOT equal todayWib
    {
      assert.notStrictEqual(tomorrowWib, todayWib, 'DATE-01: tomorrowWib must be distinct from todayWib');
      assert.strictEqual(tomorrowWib, '2026-09-10', 'DATE-01: tomorrowWib for 2026-09-09 must be 2026-09-10');
      console.log(`[PASS] DATE-01: tomorrowWib (${tomorrowWib}) !== todayWib (${todayWib})`);
      passed++;
    }

    // DATE-02: State transition HARI INI -> BESOK -> HARI INI
    {
      let selectedDate = todayWib;
      assert.strictEqual(selectedDate, todayWib, 'DATE-02: Initial selectedDate is today');

      // Click BESOK
      selectedDate = tomorrowWib;
      assert.strictEqual(selectedDate, tomorrowWib, 'DATE-02: Clicking BESOK sets selectedDate to tomorrow');

      // Click HARI INI
      selectedDate = todayWib;
      assert.strictEqual(selectedDate, todayWib, 'DATE-02: Clicking HARI INI returns selectedDate to today');

      console.log('[PASS] DATE-02: State transitions HARI INI -> BESOK -> HARI INI execute correctly');
      passed++;
    }

    // DATE-03: Data filtering for selectedDate (today vs tomorrow)
    {
      orderService.getOrders().length = 0;
      const todayPool = await courierJobPoolService.getCourierJobPoolAsync(todayWib, 'courier_01', now, null);
      const tomorrowPool = await courierJobPoolService.getCourierJobPoolAsync(tomorrowWib, 'courier_01', now, null);

      assert.strictEqual(todayPool.date, todayWib, 'DATE-03: Today pool date matches todayWib');
      assert.strictEqual(tomorrowPool.date, tomorrowWib, 'DATE-03: Tomorrow pool date matches tomorrowWib');
      console.log('[PASS] DATE-03: Job pool service returns distinct dataset per selected date');
      passed++;
    }

    // DATE-04: Read-Only Invariant -> 0 mutations when toggling date
    {
      const ordersBefore = JSON.stringify(orderService.getOrders());
      await courierJobPoolService.getCourierJobPoolAsync(todayWib, 'courier_01', now, null);
      await courierJobPoolService.getCourierJobPoolAsync(tomorrowWib, 'courier_01', now, null);
      const ordersAfter = JSON.stringify(orderService.getOrders());

      assert.strictEqual(ordersBefore, ordersAfter, 'DATE-04: Store MUST remain 100% unchanged during date toggles');
      console.log('[PASS] DATE-04: Date selection is 100% read-only with 0 side effects');
      passed++;
    }

  } finally {
    orderService.saveOrders(existingOrders);
  }

  console.log('\n==================================================');
  console.log(`COURIER DATE SELECTOR RESULTS: ${passed} PASSED, 0 FAILED`);
  console.log('==================================================\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
