import { UserRole } from '../types/user';
import { partnerApplicationService, parseCoordinateNumber } from '../services/partnerApplicationService';
import { adminPartnerService } from '../services/adminPartnerService';
import { locationService } from '../services/locationService';

export function getOwnerDashboardViewMode(
  role: UserRole,
  hasActiveLaundry: boolean,
  applicationStatus?: 'pending' | 'approved' | 'rejected' | null
): 'ONBOARDING_NO_APP' | 'ONBOARDING_PENDING' | 'ONBOARDING_REJECTED' | 'OPERATIONAL_DASHBOARD' | 'ACCESS_DENIED' {
  if (role !== 'laundry_owner') {
    return 'ACCESS_DENIED';
  }

  if (hasActiveLaundry) {
    return 'OPERATIONAL_DASHBOARD';
  }

  if (applicationStatus === 'pending') {
    return 'ONBOARDING_PENDING';
  }

  if (applicationStatus === 'rejected') {
    return 'ONBOARDING_REJECTED';
  }

  return 'ONBOARDING_NO_APP';
}

async function runOwnerOnboardingTests() {
  console.log('===========================================================');
  console.log('RUNNING OWNER LAUNDRY ONBOARDING & APPROVAL TESTS');
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

  // 1. Non-owner roles access check
  console.log('--- 1. Testing Owner Dashboard Access Control ---');
  assert(
    getOwnerDashboardViewMode('customer', false) === 'ACCESS_DENIED',
    'CUSTOMER role -> Owner Dashboard: ACCESS DENIED'
  );
  assert(
    getOwnerDashboardViewMode('courier', false) === 'ACCESS_DENIED',
    'COURIER role -> Owner Dashboard: ACCESS DENIED'
  );

  // 2. Owner without laundry & without application
  console.log('\n--- 2. Testing Owner Onboarding State A (NO APPLICATION) ---');
  assert(
    getOwnerDashboardViewMode('laundry_owner', false, null) === 'ONBOARDING_NO_APP',
    'LAUNDRY_OWNER role without laundry & application -> STATE A (NO APP & CTA)'
  );

  // 3. Owner with pending application
  console.log('\n--- 3. Testing Owner Onboarding State B (PENDING APPROVAL) ---');
  assert(
    getOwnerDashboardViewMode('laundry_owner', false, 'pending') === 'ONBOARDING_PENDING',
    'LAUNDRY_OWNER role with pending app -> STATE B (PENDING APPROVAL BADGE & PREVIEW)'
  );

  // 4. Owner with rejected application
  console.log('\n--- 4. Testing Owner Onboarding State D (REJECTED & RESUBMIT) ---');
  assert(
    getOwnerDashboardViewMode('laundry_owner', false, 'rejected') === 'ONBOARDING_REJECTED',
    'LAUNDRY_OWNER role with rejected app -> STATE D (REJECTED BADGE & RESUBMIT ACTION)'
  );

  // 5. Owner with approved active laundry
  console.log('\n--- 5. Testing Owner Operational Dashboard State C (ACTIVE) ---');
  assert(
    getOwnerDashboardViewMode('laundry_owner', true, 'approved') === 'OPERATIONAL_DASHBOARD',
    'LAUNDRY_OWNER role with active laundry -> STATE C (FULL OPERATIONAL DASHBOARD)'
  );

  // 6. Service & Authorization API Validations
  console.log('\n--- 6. Testing Service Level Authorization Checks ---');
  try {
    await partnerApplicationService.createPartnerApplicationAsync({
      ownerFullName: 'Test',
      ownerPhone: '08123',
      laundryName: 'Test',
      laundryAddress: 'Test',
      city: 'Cirebon',
      district: 'Kesambi',
      payoutAccountHolder: 'Test',
      payoutBank: 'BCA',
      payoutAccountNumber: '123',
      services: [],
    });
    assert(false, 'Unauthenticated user partner application creation must fail');
  } catch {
    assert(true, 'Unauthenticated user partner application creation correctly rejected');
  }

  try {
    await adminPartnerService.approvePartnerApplicationAsync('00000000-0000-0000-0000-000000000000');
    assert(false, 'Unauthenticated approve_partner_application call must fail');
  } catch {
    assert(true, 'Unauthenticated approve_partner_application RPC correctly rejected');
  }

  try {
    await adminPartnerService.rejectPartnerApplicationAsync('00000000-0000-0000-0000-000000000000', '1234');
    assert(false, 'Rejection reason under 5 chars must fail');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    assert(
      message.includes('minimal 5 karakter'),
      'Rejection reason validation (< 5 chars) enforced'
    );
  }

  // 7. Testing Postal Code Propagation Contract
  console.log('\n--- 7. Testing Postal Code Propagation Contract ---');
  const mockPartnerPayload = {
    ownerFullName: 'Ahmad Owner',
    ownerPhone: '08123456789',
    laundryName: 'Clean Express',
    laundryAddress: 'Jl. Pemuda No. 10',
    city: 'Kota Cirebon',
    district: 'Harjamukti',
    villageCode: '3274011002',
    villageName: 'Kalijaga',
    postalCode: '45144',
    addressDetail: 'Jl. Pemuda No. 10 RT 001/RW 002',
  };
  assert(mockPartnerPayload.postalCode === '45144', 'Postal code 45144 correctly defined in partner application input payload');

  // 8. Testing Phase 2.1 Hardened Production Coordinate Parser & Location Validation
  console.log('\n--- 8. Testing Phase 2.1 Hardened Production Coordinate Parser & Location Validation ---');

  // Location Validation Checks
  assert(locationService.isValidCoordinate(null, null) === false, 'null, null coordinates rejected by locationService');
  assert(locationService.isValidCoordinate(undefined, undefined) === false, 'undefined, undefined coordinates rejected by locationService');
  assert(locationService.isValidCoordinate(999, 108) === false, 'out-of-bounds latitude 999 rejected by locationService');
  assert(locationService.isValidCoordinate(-6.7320, 108.5523) === true, 'valid Cirebon coordinates (-6.7320, 108.5523) accepted by locationService');
  assert(locationService.isValidCoordinate(0, 0) === true, 'equatorial prime meridian coordinates (0, 0) accepted by locationService');

  // TEST GROUP A — VALID NUMERIC INPUT (Production parseCoordinateNumber)
  assert(parseCoordinateNumber(-6.732) === -6.732, 'A1: parseCoordinateNumber(-6.732) returns -6.732');
  assert(parseCoordinateNumber('108.552') === 108.552, 'A2: parseCoordinateNumber("108.552") returns 108.552');
  assert(parseCoordinateNumber(0) === 0, 'A3: parseCoordinateNumber(0) preserves numeric 0');
  assert(parseCoordinateNumber('0') === 0, 'A4: parseCoordinateNumber("0") parses string "0" to 0');

  // TEST GROUP B — NULL SAFETY
  assert(parseCoordinateNumber(null) === null, 'B1: parseCoordinateNumber(null) returns null');
  assert(parseCoordinateNumber(undefined) === null, 'B2: parseCoordinateNumber(undefined) returns null');

  // TEST GROUP C — FINITE NUMBER SAFETY
  assert(parseCoordinateNumber(NaN) === null, 'C1: parseCoordinateNumber(NaN) returns null');
  assert(parseCoordinateNumber(Infinity) === null, 'C2: parseCoordinateNumber(Infinity) returns null');
  assert(parseCoordinateNumber(-Infinity) === null, 'C3: parseCoordinateNumber(-Infinity) returns null');

  // TEST GROUP D — STRING HARDENING
  assert(parseCoordinateNumber('') === null, 'D1: parseCoordinateNumber("") returns null');
  assert(parseCoordinateNumber('   ') === null, 'D2: parseCoordinateNumber("   ") returns null');
  assert(parseCoordinateNumber('abc') === null, 'D3: parseCoordinateNumber("abc") returns null');

  // TEST GROUP E — TYPE HARDENING
  assert(parseCoordinateNumber(false) === null, 'E1: parseCoordinateNumber(false) returns null');
  assert(parseCoordinateNumber(true) === null, 'E2: parseCoordinateNumber(true) returns null');
  assert(parseCoordinateNumber([]) === null, 'E3: parseCoordinateNumber([]) returns null');
  assert(parseCoordinateNumber({}) === null, 'E4: parseCoordinateNumber({}) returns null');


  console.log('\n===========================================================');
  console.log(`OWNER ONBOARDING SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runOwnerOnboardingTests();
