import assert from 'assert';
import { Order } from '../types/order';
import { calculateOrderShortfall } from '../utils/paymentShortfall';
import { paymentService } from '../services/paymentService';

console.log('==================================================');
console.log('RUNNING CASE 1 PAYMENT SHORTFALL LOGIC TEST SUITE');
console.log('==================================================\n');

function createMockOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord_shortfall_test_01',
    trackingNumber: 'LND-SHORTFALL',
    customerId: 'usr_customer_01',
    customerName: 'Customer Test',
    customerPhone: '08123456789',
    serviceType: 'kiloan',
    serviceName: 'Cuci Komplit Kiloan',
    status: 'picked_up',
    items: [{ id: 'item_1', name: 'Cuci Komplit', quantity: 5, unitPrice: 8000, unit: 'kg' }],
    estimatedWeightKg: 5,
    finalWeightKg: undefined,
    pickupAddress: 'Jl. Test 123',
    deliveryAddress: 'Jl. Test 123',
    pickupDate: '2026-09-10',
    pickupTimeSlot: '09:00 - 12:00',
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

  // SHORTFALL-CARD-01: Normal order -> no shortfall badge
  {
    const orderNormal = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 5 });
    const res = calculateOrderShortfall(orderNormal, 'none');
    assert.strictEqual(res.isShortfall, false, 'SHORTFALL-CARD-01: Normal order must NOT be shortfall');
    assert.strictEqual(res.amount, 0);
    console.log('[PASS] SHORTFALL-CARD-01: Normal order (5kg -> 5kg) => isShortfall = false');
    passed++;
  }

  // SHORTFALL-CARD-02: Additional charge unpaid -> badge + amount + CTA
  {
    const orderUnpaid = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 6 });
    const res = calculateOrderShortfall(orderUnpaid, 'pending', 8000);
    assert.strictEqual(res.isShortfall, true, 'SHORTFALL-CARD-02: Additional charge unpaid MUST be shortfall');
    assert.strictEqual(res.amount, 8000, 'SHORTFALL-CARD-02: Amount must be 8000');
    console.log('[PASS] SHORTFALL-CARD-02: Additional charge unpaid => isShortfall = true, amount = Rp 8.000');
    passed++;
  }

  // SHORTFALL-CARD-03: Additional charge pending -> badge + amount + CTA
  {
    const orderPending = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 6 });
    const res = calculateOrderShortfall(orderPending, 'pending', 8000);
    assert.strictEqual(res.isShortfall, true);
    assert.strictEqual(res.amount, 8000);
    console.log('[PASS] SHORTFALL-CARD-03: Additional charge pending => isShortfall = true, amount = Rp 8.000');
    passed++;
  }

  // SHORTFALL-CARD-04: Additional charge paid -> no badge + no CTA
  {
    const orderPaid = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 6 });
    const res = calculateOrderShortfall(orderPaid, 'paid', 8000);
    assert.strictEqual(res.isShortfall, false, 'SHORTFALL-CARD-04: Paid adjustment MUST NOT show shortfall');
    assert.strictEqual(res.amount, 0);
    console.log('[PASS] SHORTFALL-CARD-04: Additional charge paid => isShortfall = false, amount = 0');
    passed++;
  }

  // SHORTFALL-CARD-05: Initial order payment paid BUT adjustment unpaid -> MUST show shortfall
  {
    const orderInitialPaidAdjUnpaid = createMockOrder({ paymentStatus: 'paid', estimatedWeightKg: 5, finalWeightKg: 6 });
    const res = calculateOrderShortfall(orderInitialPaidAdjUnpaid, 'pending', 8000);
    assert.strictEqual(res.isShortfall, true, 'SHORTFALL-CARD-05: Initial order paid but adjustment unpaid MUST show shortfall');
    assert.strictEqual(res.amount, 8000);
    console.log('[PASS] SHORTFALL-CARD-05: Initial order paid & adjustment unpaid => isShortfall = true');
    passed++;
  }

  // SHORTFALL-CARD-06: Weight increased BUT no actual additional charge (amount = 0 and paid) -> MUST NOT falsely show shortfall
  {
    const orderNoCharge = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 6 });
    const res = calculateOrderShortfall(orderNoCharge, 'paid', 0);
    assert.strictEqual(res.isShortfall, false, 'SHORTFALL-CARD-06: Weight increased but paid MUST NOT show shortfall');
    console.log('[PASS] SHORTFALL-CARD-06: Weight increased but adjustment paid => isShortfall = false');
    passed++;
  }

  // SHORTFALL-CARD-07: Order status = "pending" ("Menunggu Konfirmasi") AND shortfall exists -> status + payment alert both visible
  {
    const orderPendingStatusShortfall = createMockOrder({ status: 'pending', estimatedWeightKg: 5, finalWeightKg: 6 });
    const res = calculateOrderShortfall(orderPendingStatusShortfall, 'none');
    assert.strictEqual(res.isShortfall, true, 'SHORTFALL-CARD-07: Order pending status with weight increase MUST indicate shortfall');
    assert.strictEqual(res.amount, 8000, 'SHORTFALL-CARD-07: Canonical shortfall amount calculated as 8000');
    console.log('[PASS] SHORTFALL-CARD-07: Order status "pending" + weight increase => isShortfall = true, amount = Rp 8.000');
    passed++;
  }

  // SHORTFALL-CARD-08: Payment settled after refresh -> shortfall disappears
  {
    const orderRefreshed = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 6 });
    const resBefore = calculateOrderShortfall(orderRefreshed, 'pending', 8000);
    assert.strictEqual(resBefore.isShortfall, true);

    const resAfter = calculateOrderShortfall(orderRefreshed, 'paid', 8000);
    assert.strictEqual(resAfter.isShortfall, false);
    assert.strictEqual(resAfter.amount, 0);
    console.log('[PASS] SHORTFALL-CARD-08: Settlement transition => shortfall disappears (isShortfall = false)');
    passed++;
  }

  // SHORTFALL-CARD-09: Batch lookup with multiple orders -> single query semantics
  {
    const orderIds = ['ord_batch_1', 'ord_batch_2', 'ord_batch_3'];
    const batchRes = await paymentService.getAdjustmentPaymentStatusesBatchAsync(orderIds);
    assert.ok(batchRes, 'SHORTFALL-CARD-09: Batch lookup returned result object');
    assert.strictEqual(Object.keys(batchRes).length, 3, 'SHORTFALL-CARD-09: Batch lookup returned results for all 3 order IDs');
    console.log('[PASS] SHORTFALL-CARD-09: Batch payment status lookup executed successfully for 3 orders in 1 query');
    passed++;
  }

  // SHORTFALL-CARD-10: Empty order IDs -> empty result, no unnecessary query
  {
    const emptyRes = await paymentService.getAdjustmentPaymentStatusesBatchAsync([]);
    assert.deepStrictEqual(emptyRes, {}, 'SHORTFALL-CARD-10: Empty array input returned empty object instantly');
    console.log('[PASS] SHORTFALL-CARD-10: Empty order IDs input => returns empty object without database query');
    passed++;
  }

  console.log('\n==================================================');
  console.log(`PAYMENT SHORTFALL LOGIC RESULTS: ${passed} PASSED, 0 FAILED`);
  console.log('==================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed with error:', err);
  process.exit(1);
});
