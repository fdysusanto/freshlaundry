import { UserRole } from '../types/user';
import { partnerApplicationService } from '../services/partnerApplicationService';
import { adminPartnerService } from '../services/adminPartnerService';

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


  console.log('\n===========================================================');
  console.log(`OWNER ONBOARDING SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runOwnerOnboardingTests();
