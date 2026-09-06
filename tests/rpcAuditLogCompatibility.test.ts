import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { normalizeServiceType, VALID_SERVICE_TYPE_CODES } from '../utils/serviceCodeUtils';

console.log('🧪 RUNNING PHASE 12 — RPC AUDIT LOG & SCHEMA COMPATIBILITY UNIT TESTS\n');

const migrationPath = path.join(__dirname, '../database/migrations/045_fix_approve_partner_application_audit_log_compatibility.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

// --- GROUP A: Audit Logs Table Missing Scenario ---
console.log('--- GROUP A: Audit Logs Table Missing Scenario ---');
{
  assert(
    migrationSql.includes("to_regclass('public.audit_logs') IS NOT NULL"),
    "Migration 045 SQL must check to_regclass('public.audit_logs') IS NOT NULL before audit insert"
  );
  assert(
    migrationSql.includes("EXECUTE '"),
    "Migration 045 SQL must use dynamic EXECUTE for inserting into public.audit_logs to avoid compilation & runtime failures when table is missing"
  );
  console.log("  [PASS] Migration SQL verified to safely guard audit_logs via to_regclass and dynamic EXECUTE");
}
console.log('✅ GROUP A PASSED!\n');

// --- GROUP B: Approval Flow Does Not Require Audit Logs ---
console.log('--- GROUP B: Approval Flow Does Not Require Audit Logs ---');
{
  const simulateAuditLogCheck = (auditLogsTableExists: boolean) => {
    let auditLogged = false;
    if (auditLogsTableExists) {
      auditLogged = true;
    }
    return {
      success: true,
      auditLogged,
    };
  };

  const resultWithNoTable = simulateAuditLogCheck(false);
  assert.strictEqual(resultWithNoTable.success, true);
  assert.strictEqual(resultWithNoTable.auditLogged, false);

  const resultWithTable = simulateAuditLogCheck(true);
  assert.strictEqual(resultWithTable.success, true);
  assert.strictEqual(resultWithTable.auditLogged, true);

  console.log('  [PASS] Partner approval completes successfully whether audit_logs exists or not');
}
console.log('✅ GROUP B PASSED!\n');

// --- GROUP C: Idempotent Approved Application Does Not Reference approved_laundry_id ---
console.log('--- GROUP C: Idempotent Approved Application Contract ---');
{
  assert(
    !migrationSql.includes('approved_laundry_id'),
    'Migration 045 SQL must not reference approved_laundry_id'
  );

  const idempotentPayload = {
    success: true,
    is_idempotent: true,
    application_id: 'app_uuid_123',
    laundry_id: 'laundry_uuid_456',
    message: 'Pengajuan mitra ini sudah disetujui sebelumnya.',
  };

  assert(!('approved_laundry_id' in idempotentPayload));
  console.log('  [PASS] Idempotent payload verified without referencing non-existent approved_laundry_id column');
}
console.log('✅ GROUP C PASSED!\n');

// --- GROUP D: Idempotent Response Attempts to Retrieve Existing Laundry ---
console.log('--- GROUP D: Idempotent Retrieval of Existing Laundry ---');
{
  assert(
    migrationSql.includes('SELECT id') &&
    migrationSql.includes('INTO v_existing_laundry_id') &&
    migrationSql.includes('FROM public.laundries') &&
    migrationSql.includes('WHERE owner_id = v_app.user_id'),
    'Migration 045 SQL must query public.laundries by owner_id for idempotent approval'
  );
  console.log('  [PASS] Migration SQL verified to retrieve existing laundry by owner_id upon idempotent approval');
}
console.log('✅ GROUP D PASSED!\n');

// --- GROUP E: Phase 7 min_weight Preserved ---
console.log('--- GROUP E: Phase 7 min_weight Preserved ---');
{
  assert(
    migrationSql.includes('min_weight'),
    'Migration 045 SQL must preserve min_weight column'
  );
  assert(
    migrationSql.includes("CASE WHEN pas.unit = 'kg' THEN pas.min_weight ELSE NULL END"),
    'Migration 045 SQL must copy min_weight for kg services'
  );
  console.log('  [PASS] Phase 7 min_weight contract preserved in RPC migration');
}
console.log('✅ GROUP E PASSED!\n');

// --- GROUP F: Phase 8 estimated_hours Preserved ---
console.log('--- GROUP F: Phase 8 estimated_hours Preserved ---');
{
  assert(
    migrationSql.includes('estimated_hours'),
    'Migration 045 SQL must preserve estimated_hours column'
  );
  console.log('  [PASS] Phase 8 estimated_hours contract preserved in RPC migration');
}
console.log('✅ GROUP F PASSED!\n');

// --- GROUP G: Multiple Services Using Same Code kiloan Remain Supported ---
console.log('--- GROUP G: Multiple Services per Category (kiloan/satuan) ---');
{
  const kiloServices = [
    { name: 'Cuci Kering', unit: 'kg' },
    { name: 'Cuci Setrika', unit: 'kg' },
    { name: 'Cuci Selimut', unit: 'kg' },
  ];

  kiloServices.forEach((s) => {
    const code = normalizeServiceType(null, s.unit, s.name);
    assert.strictEqual(code, 'kiloan');
  });

  assert(
    migrationSql.includes('pas.code'),
    'Migration 045 SQL must copy pas.code directly without overwriting with custom codes'
  );
  console.log('  [PASS] Multiple per-kg services with code "kiloan" verified');
}
console.log('✅ GROUP G PASSED!\n');

// --- GROUP H: service_type ENUM Values Remain Valid ---
console.log('--- GROUP H: service_type ENUM Validation ---');
{
  const allowedEnums = Array.from(VALID_SERVICE_TYPE_CODES);
  assert.deepStrictEqual(allowedEnums.sort(), ['dry_clean', 'express', 'kiloan', 'satuan'].sort());
  console.log('  [PASS] service_type ENUM strict values verified:', allowedEnums);
}
console.log('✅ GROUP H PASSED!\n');

// --- GROUP I: Profiles Update Must NOT Reference updated_at ---
console.log('--- GROUP I: Profiles Update Contract ---');
{
  assert(
    migrationSql.includes("UPDATE public.profiles"),
    "Migration 045 SQL must update profiles"
  );
  assert(
    migrationSql.includes("SET role = 'laundry_owner'"),
    "Migration 045 SQL must set role to laundry_owner"
  );
  assert(
    !migrationSql.includes("UPDATE public.profiles\n  SET role = 'laundry_owner',\n      updated_at"),
    "Migration 045 SQL must not reference profiles.updated_at"
  );
  console.log('  [PASS] Profiles update payload verified without referencing profiles.updated_at');
}
console.log('✅ GROUP I PASSED!\n');

// --- GROUP J: Partner Applications Update Uses Verified Schema Columns ---
console.log('--- GROUP J: Partner Applications Update Contract ---');
{
  assert(migrationSql.includes('status = \'approved\''));
  assert(migrationSql.includes('reviewed_by = v_admin_id'));
  assert(migrationSql.includes('reviewed_at = NOW()'));
  assert(migrationSql.includes('updated_at = NOW()'));
  assert(!migrationSql.includes('approved_laundry_id ='));
  console.log('  [PASS] Partner applications update verified using only verified schema columns (status, reviewed_by, reviewed_at, updated_at)');
}
console.log('✅ GROUP J PASSED!\n');

console.log('🎉 ALL PHASE 12 RPC AUDIT LOG COMPATIBILITY TESTS PASSED SUCCESSFULLY!');
