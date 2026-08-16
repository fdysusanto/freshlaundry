import { UserRole } from '../types/user';
import {
  isMarketplaceNavVisible,
  isCustomerDashboardVisible,
  isCustomerOrderCtaVisible,
  getRouteRedirectTarget,
} from './operationalRoleMarketplaceAccess.test';

export function getAdminNavItems(role?: UserRole): { id: string; label: string; href: string }[] {
  if (role !== 'platform_admin' && role !== 'admin') {
    return [];
  }

  return [
    { id: 'admin-home', label: 'Beranda', href: '/' },
    { id: 'admin-monitoring', label: 'Monitoring', href: '/admin' },
    { id: 'admin-laundry', label: 'Laundry', href: '/admin/partner-applications' },
    { id: 'admin-staff', label: 'Staff', href: '/admin/staff' },
    { id: 'admin-orders', label: 'Pesanan', href: '/admin' },
  ];
}

async function runAdminNavigationTests() {
  console.log('===========================================================');
  console.log('RUNNING PLATFORM ADMIN NAVIGATION & ROLE MATRIX TESTS');
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

  const adminNav = getAdminNavItems('platform_admin');
  const navIds = adminNav.map((i) => i.id);
  const uniqueIds = new Set(navIds);

  // 1-4. Admin items existence
  console.log('--- 1. Testing PLATFORM_ADMIN Nav Items ---');
  assert(
    adminNav.some((i) => i.label === 'Monitoring' && i.href === '/admin'),
    '1. PLATFORM_ADMIN has direct access to "Monitoring" (/admin)'
  );
  assert(
    adminNav.some((i) => i.label === 'Laundry' && i.href === '/admin/partner-applications'),
    '2. PLATFORM_ADMIN has direct access to "Laundry" (/admin/partner-applications)'
  );
  assert(
    adminNav.some((i) => i.label === 'Staff' && i.href === '/admin/staff'),
    '3. PLATFORM_ADMIN has direct access to "Staff" (/admin/staff)'
  );
  assert(
    adminNav.some((i) => i.label === 'Pesanan' && i.href === '/admin'),
    '4. PLATFORM_ADMIN has direct access to "Pesanan" (/admin)'
  );

  // 5-7. Admin Marketplace Hiding
  console.log('\n--- 2. Testing PLATFORM_ADMIN Marketplace Links Hiding ---');
  assert(
    isMarketplaceNavVisible('platform_admin') === false,
    '5. PLATFORM_ADMIN does NOT see "Cari Laundry"'
  );
  assert(
    isCustomerOrderCtaVisible('platform_admin') === false,
    '6. PLATFORM_ADMIN does NOT see "Pesan Laundry" CTA'
  );
  assert(
    isCustomerDashboardVisible('platform_admin') === false,
    '7. PLATFORM_ADMIN does NOT see "Customer Dashboard"'
  );

  // 8-9. Customer Marketplace Access
  console.log('\n--- 3. Testing CUSTOMER Marketplace Access Integrity ---');
  assert(
    isMarketplaceNavVisible('customer') === true,
    '8. CUSTOMER still sees "Cari Laundry"'
  );
  assert(
    isCustomerOrderCtaVisible('customer') === true,
    '9. CUSTOMER still sees "Pesan Laundry" CTA'
  );

  // 10-12. Operational Roles Marketplace Hiding
  console.log('\n--- 4. Testing Operational Roles Marketplace Hiding ---');
  assert(
    isMarketplaceNavVisible('courier') === false,
    '10. COURIER does NOT see marketplace nav'
  );
  assert(
    isMarketplaceNavVisible('laundry_owner') === false,
    '11. OWNER does NOT see marketplace nav'
  );
  assert(
    isMarketplaceNavVisible('laundry_staff') === false,
    '12. STAFF does NOT see marketplace nav'
  );

  // 13. Unique Key Verification
  console.log('\n--- 5. Testing Unique React Keys & Duplicate Protection ---');
  assert(
    uniqueIds.size === navIds.length,
    '13. All admin navigation items have 100% UNIQUE React keys'
  );

  console.log('\n===========================================================');
  console.log(`ADMIN NAVIGATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdminNavigationTests();
