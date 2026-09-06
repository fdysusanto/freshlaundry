import assert from 'node:assert';
import { normalizeEstimatedHours } from '../services/partnerApplicationService';
import { formatEstimatedTimeText } from '../app/(auth)/register/partner/page';

async function runTests() {
  console.log('🧪 RUNNING PHASE 8 — SERVICE ESTIMATED PROCESSING TIME UNIT TESTS');

  // TEST GROUP A: Default Resolution
  console.log('\n--- GROUP A: Default Estimated Hours Resolution ---');

  assert.strictEqual(normalizeEstimatedHours(null, 'kiloan', 'kg'), 24, 'A1 FAIL: Regular KG service defaults to 24h');
  assert.strictEqual(normalizeEstimatedHours(undefined, 'express', 'kg'), 6, 'A2 FAIL: Express service defaults to 6h');
  assert.strictEqual(normalizeEstimatedHours(null, 'dry_clean', 'pcs'), 48, 'A3 FAIL: Dry clean / pcs service defaults to 48h');
  assert.strictEqual(normalizeEstimatedHours('', 'unknown', 'kg'), 24, 'A4 FAIL: Unknown code defaults to 24h');

  console.log('✅ GROUP A PASSED!');

  // TEST GROUP B: Validation Logic
  console.log('\n--- GROUP B: Estimated Hours Validation ---');

  assert.strictEqual(normalizeEstimatedHours(1, 'kiloan', 'kg'), 1, 'B1 FAIL: 1 hour is valid');
  assert.strictEqual(normalizeEstimatedHours(6, 'kiloan', 'kg'), 6, 'B2 FAIL: 6 hours is valid');
  assert.strictEqual(normalizeEstimatedHours(24, 'kiloan', 'kg'), 24, 'B3 FAIL: 24 hours is valid');
  assert.strictEqual(normalizeEstimatedHours(48, 'kiloan', 'kg'), 48, 'B4 FAIL: 48 hours is valid');
  assert.strictEqual(normalizeEstimatedHours(168, 'kiloan', 'kg'), 168, 'B5 FAIL: 168 hours (7 days) is valid');

  // Invalid inputs fall back to service-aware defaults
  assert.strictEqual(normalizeEstimatedHours(0, 'kiloan', 'kg'), 24, 'B6 FAIL: 0 hours falls back to 24h default');
  assert.strictEqual(normalizeEstimatedHours(-5, 'express', 'kg'), 6, 'B7 FAIL: Negative hours falls back to 6h express default');
  assert.strictEqual(normalizeEstimatedHours(24.5, 'kiloan', 'kg'), 24, 'B8 FAIL: Decimal hours falls back to 24h default');
  assert.strictEqual(normalizeEstimatedHours(169, 'kiloan', 'kg'), 24, 'B9 FAIL: Out-of-bounds >168 hours falls back to 24h default');
  assert.strictEqual(normalizeEstimatedHours(NaN, 'kiloan', 'kg'), 24, 'B10 FAIL: NaN falls back to 24h default');

  console.log('✅ GROUP B PASSED!');

  // TEST GROUP C: Partner Application Payload Support
  console.log('\n--- GROUP C: Partner Application Payload & Coexistence ---');

  const customExpressService = {
    name: 'Cuci Express Super',
    price: 20000,
    unit: 'kg' as const,
    code: 'express',
    estimatedHours: 4, // Custom 4 hours!
  };

  const resolvedHours = normalizeEstimatedHours(
    customExpressService.estimatedHours,
    customExpressService.code,
    customExpressService.unit
  );
  assert.strictEqual(resolvedHours, 4, 'C1 FAIL: Custom 4 hours preserved over 6h express default');

  console.log('✅ GROUP C PASSED!');

  // TEST GROUP D: Phase 7 Minimum Weight & Phase 8 Estimated Hours Coexistence
  console.log('\n--- GROUP D: Phase 7 (Min Weight) & Phase 8 (Estimated Hours) Coexistence ---');

  const coexistingService = {
    name: 'Cuci Reguler Min 3KG Fast',
    price: 8000,
    unit: 'kg' as const,
    minWeight: 3,
    estimatedHours: 12,
  };

  const parsedMinWeight = coexistingService.minWeight;
  const parsedEstHours = normalizeEstimatedHours(coexistingService.estimatedHours, 'kiloan', coexistingService.unit);

  assert.strictEqual(parsedMinWeight, 3, 'D1 FAIL: minWeight 3 preserved');
  assert.strictEqual(parsedEstHours, 12, 'D2 FAIL: estimatedHours 12 preserved');

  console.log('✅ GROUP D PASSED!');

  // TEST GROUP E: Human-Friendly Time Formatter
  console.log('\n--- GROUP E: Time Formatter Preview ---');

  assert.strictEqual(formatEstimatedTimeText(6), '6 Jam', 'E1 FAIL: 6 -> 6 Jam');
  assert.strictEqual(formatEstimatedTimeText(12), '12 Jam', 'E2 FAIL: 12 -> 12 Jam');
  assert.strictEqual(formatEstimatedTimeText(24), '1 Hari', 'E3 FAIL: 24 -> 1 Hari');
  assert.strictEqual(formatEstimatedTimeText(36), '1 Hari 12 Jam', 'E4 FAIL: 36 -> 1 Hari 12 Jam');
  assert.strictEqual(formatEstimatedTimeText(48), '2 Hari', 'E5 FAIL: 48 -> 2 Hari');
  assert.strictEqual(formatEstimatedTimeText(72), '3 Hari', 'E6 FAIL: 72 -> 3 Hari');

  console.log('✅ GROUP E PASSED!');

  console.log('\n🎉 ALL PHASE 8 UNIT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ UNIT TEST FAILED:', err);
  process.exit(1);
});
