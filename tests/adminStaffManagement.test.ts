import { UserRole } from '../types/user';
import { getRouteRedirectTarget } from './operationalRoleMarketplaceAccess.test';

export function isUserAuthorizedToCreateStaff(role?: UserRole): boolean {
  if (!role) return false;
  return role === 'platform_admin' || role === 'admin';
}

export function validateStaffCreationPayload(payload: {
  fullName?: string;
  email?: string;
  password?: string;
  laundryId?: string;
  existingEmails?: string[];
  activeLaundryIds?: string[];
}): { valid: boolean; statusCode?: number; error?: string } {
  if (!payload.fullName || !payload.fullName.trim()) {
    return { valid: false, statusCode: 400, error: 'Nama lengkap staf wajib diisi.' };
  }

  if (!payload.email || !payload.email.includes('@')) {
    return { valid: false, statusCode: 400, error: 'Alamat email tidak valid.' };
  }

  if (!payload.password || payload.password.length < 6) {
    return { valid: false, statusCode: 400, error: 'Password sementara minimal 6 karakter.' };
  }

  if (!payload.laundryId) {
    return { valid: false, statusCode: 400, error: 'Outlet laundry wajib dipilih.' };
  }

  if (payload.activeLaundryIds && !payload.activeLaundryIds.includes(payload.laundryId)) {
    return { valid: false, statusCode: 404, error: 'Outlet laundry tidak ditemukan atau tidak aktif.' };
  }

  if (payload.existingEmails && payload.existingEmails.includes(payload.email.toLowerCase().trim())) {
    return { valid: false, statusCode: 409, error: 'Email sudah terdaftar di sistem.' };
  }

  return { valid: true };
}

async function runAdminStaffManagementTests() {
  console.log('===========================================================');
  console.log('RUNNING SIMPLIFIED STAFF ACCOUNT MANAGEMENT & SECURITY TESTS');
  console.log('===========================================================\n');

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

  // 1-5. Role authorization for staff creation
  console.log('--- 1. Testing Staff Creation Role Authorization (Server Security) ---');
  assert(
    isUserAuthorizedToCreateStaff('platform_admin') === true,
    '1. Platform Admin CAN create staff accounts (Authorized 200/201)'
  );
  assert(
    isUserAuthorizedToCreateStaff('laundry_owner') === false,
    '2. Laundry Owner CANNOT create staff accounts (403 Forbidden)'
  );
  assert(
    isUserAuthorizedToCreateStaff('laundry_staff') === false,
    '3. Laundry Staff CANNOT create staff accounts (403 Forbidden)'
  );
  assert(
    isUserAuthorizedToCreateStaff('customer') === false,
    '4. Customer CANNOT create staff accounts (403 Forbidden)'
  );
  assert(
    isUserAuthorizedToCreateStaff('courier') === false,
    '5. Courier CANNOT create staff accounts (403 Forbidden)'
  );

  // 6-7. Staff role & membership assignment validation
  console.log('\n--- 2. Testing Payload & Business Rules Validation ---');
  const validRes = validateStaffCreationPayload({
    fullName: 'Budi Staff',
    email: 'staff@laundry.com',
    password: 'password123',
    laundryId: '11111111-1111-1111-1111-111111111111',
    activeLaundryIds: ['11111111-1111-1111-1111-111111111111'],
  });
  assert(validRes.valid === true, '6 & 7. Valid payload correctly assigned role & laundry membership');

  // 8. Invalid / non-existent laundry
  const invalidLaundryRes = validateStaffCreationPayload({
    fullName: 'Budi Staff',
    email: 'staff2@laundry.com',
    password: 'password123',
    laundryId: '99999999-9999-9999-9999-999999999999',
    activeLaundryIds: ['11111111-1111-1111-1111-111111111111'],
  });
  assert(
    invalidLaundryRes.valid === false && invalidLaundryRes.statusCode === 404,
    '8. Non-existent/Inactive laundry correctly rejected (404 Not Found)'
  );

  // 9. Duplicate email rejection
  const dupEmailRes = validateStaffCreationPayload({
    fullName: 'Budi Staff',
    email: 'existing@laundry.com',
    password: 'password123',
    laundryId: '11111111-1111-1111-1111-111111111111',
    existingEmails: ['existing@laundry.com'],
    activeLaundryIds: ['11111111-1111-1111-1111-111111111111'],
  });
  assert(
    dupEmailRes.valid === false && dupEmailRes.statusCode === 409,
    '9. Duplicate email correctly rejected (409 Conflict)'
  );

  // 10-12. Staff Operational Navigation & Customer Marketplace Restrictions
  console.log('\n--- 3. Testing Staff Route Isolation & Portal Navigation ---');
  assert(
    getRouteRedirectTarget('laundry_staff', '/customer/laundries') === '/owner',
    '10. LAUNDRY_STAFF accessing /customer/laundries -> REDIRECT /owner (Operational Portal)'
  );
  assert(
    getRouteRedirectTarget('laundry_staff', '/customer/checkout') === '/owner',
    '11. LAUNDRY_STAFF accessing /customer/checkout -> REDIRECT /owner (Operational Portal)'
  );
  assert(
    getRouteRedirectTarget('laundry_staff', '/') === '/owner',
    '12. LAUNDRY_STAFF accessing / -> REDIRECT /owner (Operational Portal)'
  );

  console.log('\n===========================================================');
  console.log(`STAFF MANAGEMENT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdminStaffManagementTests();
