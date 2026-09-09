import assert from 'assert';
import { Order } from '../types/order';
import { calculateOrderShortfall } from '../utils/paymentShortfall';

console.log('==================================================');
console.log('RUNNING CASE 1 PAYMENT SHORTFALL LOGIC TEST SUITE');
console.log('==================================================\n');

// Mock order builder helper
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

  // SHORTFALL-01: Scenario A (5kg initial -> 5kg final)
  {
    const orderA = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 5 });
    const resultA = calculateOrderShortfall(orderA, 'none');
    assert.strictEqual(resultA.isShortfall, false, 'SHORTFALL-01: 5kg initial vs 5kg final must NOT be shortfall');
    assert.strictEqual(resultA.hasExtraWeight, false, 'SHORTFALL-01: hasExtraWeight must be false');
    console.log('[PASS] SHORTFALL-01: Scenario A (5kg -> 5kg) => isShortfall = false');
    passed++;
  }

  // SHORTFALL-02: Scenario B (5kg initial -> 6kg final, unpaid / pending adjustment)
  {
    const orderB = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 6 });
    const resultB = calculateOrderShortfall(orderB, 'pending');
    assert.strictEqual(resultB.isShortfall, true, 'SHORTFALL-02: 5kg initial vs 6kg final with pending adjustment MUST be shortfall');
    assert.strictEqual(resultB.hasExtraWeight, true, 'SHORTFALL-02: hasExtraWeight must be true');
    console.log('[PASS] SHORTFALL-02: Scenario B (5kg -> 6kg, pending adjustment) => isShortfall = true');
    passed++;
  }

  // SHORTFALL-03: Scenario C (5kg initial -> 6kg final, paid adjustment)
  {
    const orderC = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 6 });
    const resultC = calculateOrderShortfall(orderC, 'paid');
    assert.strictEqual(resultC.isShortfall, false, 'SHORTFALL-03: 5kg initial vs 6kg final with PAID adjustment MUST NOT be shortfall');
    assert.strictEqual(resultC.hasExtraWeight, true, 'SHORTFALL-03: hasExtraWeight is true, but isShortfall is FALSE');
    console.log('[PASS] SHORTFALL-03: Scenario C (5kg -> 6kg, PAID adjustment) => isShortfall = false');
    passed++;
  }

  // SHORTFALL-04: Scenario D (5kg initial -> 6kg final, adjustment status pending state machine)
  {
    const orderD = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 6 });
    const resultD = calculateOrderShortfall(orderD, 'pending');
    assert.strictEqual(resultD.isShortfall, true, 'SHORTFALL-04: Scenario D pending state machine => isShortfall = true');
    console.log('[PASS] SHORTFALL-04: Scenario D (5kg -> 6kg, pending state machine) => isShortfall = true');
    passed++;
  }

  // SHORTFALL-05: Scenario E (5kg initial -> 4kg final, weight decrease)
  {
    const orderE = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 4 });
    const resultE = calculateOrderShortfall(orderE, 'none');
    assert.strictEqual(resultE.isShortfall, false, 'SHORTFALL-05: 5kg initial vs 4kg final MUST NOT be shortfall');
    assert.strictEqual(resultE.hasExtraWeight, false, 'SHORTFALL-05: hasExtraWeight must be false');
    console.log('[PASS] SHORTFALL-05: Scenario E (5kg -> 4kg) => isShortfall = false');
    passed++;
  }

  // SHORTFALL-06: Unweighed Order (finalWeightKg = undefined)
  {
    const orderF = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: undefined });
    const resultF = calculateOrderShortfall(orderF, 'none');
    assert.strictEqual(resultF.isShortfall, false, 'SHORTFALL-06: Unweighed order must NOT be shortfall');
    console.log('[PASS] SHORTFALL-06: Unweighed order (finalWeightKg = undefined) => isShortfall = false');
    passed++;
  }

  // SHORTFALL-07: Outstanding balance integration check
  {
    const orderPending = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 6, totalPrice: 50000 });
    const resPending = calculateOrderShortfall(orderPending, 'pending');
    assert.strictEqual(resPending.isShortfall, true);

    const orderPaid = createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 6, totalPrice: 50000 });
    const resPaid = calculateOrderShortfall(orderPaid, 'paid');
    assert.strictEqual(resPaid.isShortfall, false);
    console.log('[PASS] SHORTFALL-07: Outstanding balance evaluation returns 0 when adjustment is paid');
    passed++;
  }

  // SHORTFALL-08: Customer UI CTA Availability Guard
  {
    const renderCTAForScenarioC = calculateOrderShortfall(createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 6 }), 'paid').isShortfall;
    const renderCTAForScenarioB = calculateOrderShortfall(createMockOrder({ estimatedWeightKg: 5, finalWeightKg: 6 }), 'pending').isShortfall;

    assert.strictEqual(renderCTAForScenarioC, false, 'SHORTFALL-08: KURANG BAYAR CTA must NOT render for Scenario C');
    assert.strictEqual(renderCTAForScenarioB, true, 'SHORTFALL-08: KURANG BAYAR CTA MUST render for Scenario B');
    console.log('[PASS] SHORTFALL-08: Customer UI CTA correctly hidden for Scenario C and shown for Scenario B');
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
