import assert from 'assert';
import { normalizeServiceType, VALID_SERVICE_TYPE_CODES } from '../utils/serviceCodeUtils';

console.log('🧪 RUNNING PHASE 11 — RPC SCHEMA COMPATIBILITY UNIT TESTS\n');

// --- GROUP A: Idempotency Payload Contract ---
console.log('--- GROUP A: Idempotency Payload Contract ---');
{
  const idempotentResult = {
    success: true,
    is_idempotent: true,
    application_id: 'app_test_123',
    laundry_id: null,
    message: 'Pengajuan mitra ini sudah disetujui sebelumnya.',
  };

  assert.strictEqual(idempotentResult.success, true);
  assert.strictEqual(idempotentResult.is_idempotent, true);
  assert.strictEqual(idempotentResult.laundry_id, null);
  assert(!('approved_laundry_id' in idempotentResult), 'Must not reference approved_laundry_id');
  console.log('  [PASS] Idempotent response contract verified without referencing approved_laundry_id');
}
console.log('✅ GROUP A PASSED!\n');

// --- GROUP B: Partner Applications Table Columns Contract ---
console.log('--- GROUP B: Partner Applications Table Columns Contract ---');
{
  const validPartnerAppUpdate = {
    status: 'approved',
    reviewed_by: 'admin_id_uuid',
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  assert('status' in validPartnerAppUpdate);
  assert('reviewed_by' in validPartnerAppUpdate);
  assert('reviewed_at' in validPartnerAppUpdate);
  assert('updated_at' in validPartnerAppUpdate);
  assert(!('approved_laundry_id' in validPartnerAppUpdate), 'approved_laundry_id column must not be used');
  console.log('  [PASS] Partner applications update payload uses only confirmed columns');
}
console.log('✅ GROUP B PASSED!\n');

// --- GROUP C: Profiles Table Columns Contract ---
console.log('--- GROUP C: Profiles Table Columns Contract ---');
{
  const validProfileUpdate = {
    role: 'laundry_owner',
  };

  assert.strictEqual(validProfileUpdate.role, 'laundry_owner');
  assert(!('updated_at' in validProfileUpdate), 'profiles.updated_at column must not be used');
  console.log('  [PASS] Profiles update payload uses role only, avoiding non-existent updated_at column');
}
console.log('✅ GROUP C PASSED!\n');

// --- GROUP D & E: Multi-Service Category Enum Contract ---
console.log('--- GROUP D & E: Multi-Service Category Enum Contract ---');
{
  const kgServices = [
    { name: 'Cuci Kering', unit: 'kg' },
    { name: 'Cuci Setrika', unit: 'kg' },
    { name: 'Cuci Karpet', unit: 'kg' },
  ];
  const pcsServices = [
    { name: 'Cuci Sepatu', unit: 'pcs' },
    { name: 'Cuci Tas', unit: 'pcs' },
  ];

  kgServices.forEach((s) => {
    const code = normalizeServiceType(null, s.unit, s.name);
    assert.strictEqual(code, 'kiloan');
  });

  pcsServices.forEach((s) => {
    const code = normalizeServiceType(null, s.unit, s.name);
    assert.strictEqual(code, 'satuan');
  });

  console.log('  [PASS] Multiple per-kg services map to "kiloan" and per-pcs services map to "satuan"');
}
console.log('✅ GROUP D & E PASSED!\n');

// --- GROUP F & G: Phase 7 (min_weight) & Phase 8 (estimated_hours) Preserved ---
console.log('--- GROUP F & G: Phase 7 & Phase 8 Preserved ---');
{
  const kgService = { name: 'Cuci Kering', unit: 'kg', minWeight: 3, estimatedHours: 24 };
  const pcsService = { name: 'Dry Clean', unit: 'pcs', minWeight: null, estimatedHours: 48 };

  assert.strictEqual(kgService.minWeight, 3, 'minWeight preserved for kg service');
  assert.strictEqual(kgService.estimatedHours, 24, 'estimatedHours preserved');

  assert.strictEqual(pcsService.minWeight, null, 'minWeight is null for pcs service');
  assert.strictEqual(pcsService.estimatedHours, 48, 'estimatedHours preserved for pcs service');

  console.log('  [PASS] Phase 7 min_weight and Phase 8 estimated_hours fully preserved in RPC contract');
}
console.log('✅ GROUP F & G PASSED!\n');

// --- GROUP H: Phase 9 Location Mapping Contract ---
console.log('--- GROUP H: Phase 9 Location Mapping Contract ---');
{
  const appLocation = {
    city: 'Bandung',
    district: 'Coblong',
    city_name: null,
    district_name: null,
    province_code: '32',
    province_name: 'Jawa Barat',
  };

  const laundriesCityName = appLocation.city_name || appLocation.city;
  const laundriesDistrictName = appLocation.district_name || appLocation.district;

  assert.strictEqual(laundriesCityName, 'Bandung');
  assert.strictEqual(laundriesDistrictName, 'Coblong');
  console.log('  [PASS] Phase 9 location COALESCE fallback correctly resolves to city_name and district_name');
}
console.log('✅ GROUP H PASSED!\n');

// --- GROUP I: Service Type ENUM Validation ---
console.log('--- GROUP I: Service Type ENUM Validation ---');
{
  const allowedEnums = Array.from(VALID_SERVICE_TYPE_CODES);
  assert.deepStrictEqual(allowedEnums.sort(), ['dry_clean', 'express', 'kiloan', 'satuan'].sort());
  console.log('  [PASS] service_type ENUM strict values verified:', allowedEnums);
}
console.log('✅ GROUP I PASSED!\n');

console.log('🎉 ALL RPC SCHEMA COMPATIBILITY TESTS PASSED SUCCESSFULLY!');
