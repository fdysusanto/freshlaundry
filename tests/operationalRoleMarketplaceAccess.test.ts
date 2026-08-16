import { UserRole } from '../types/user';

export function isMarketplaceNavVisible(role?: UserRole): boolean {
  if (!role) return true; // Guest users can see marketplace links
  return role === 'customer';
}

export function isCustomerDashboardVisible(role?: UserRole): boolean {
  return role === 'customer';
}

export function isCustomerOrderCtaVisible(role?: UserRole): boolean {
  if (!role) return true; // Guest users can see CTA
  return role === 'customer';
}

export function getRouteRedirectTarget(role?: UserRole, currentRoute?: string): string | null {
  if (!role || role === 'customer') return null; // No redirect for guest or customer

  const isCustomerRoute =
    currentRoute === '/' ||
    currentRoute === '/customer' ||
    currentRoute?.startsWith('/customer/laundries') ||
    currentRoute?.startsWith('/customer/checkout');

  if (!isCustomerRoute) return null;

  if (role === 'courier') return '/courier';
  if (role === 'laundry_owner' || role === 'laundry_staff') return '/owner';
  if (role === 'admin' || role === 'platform_admin') return '/admin';

  return '/';
}

function runOperationalRoleMarketplaceAccessTests() {
  console.log('===========================================================');
  console.log('RUNNING OPERATIONAL ROLE MARKETPLACE ACCESS & UI TESTS');
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

  // 1. CUSTOMER ROLE (Marketplace Allowed)
  console.log('--- 1. Testing CUSTOMER Role UI Visibility ---');
  assert(isMarketplaceNavVisible('customer') === true, 'CUSTOMER role -> Marketplace nav "Cari Laundry": VISIBLE');
  assert(isCustomerOrderCtaVisible('customer') === true, 'CUSTOMER role -> "Pesan Laundry" CTA: VISIBLE');
  assert(isCustomerDashboardVisible('customer') === true, 'CUSTOMER role -> "Dashboard Pelanggan" link: VISIBLE');
  assert(getRouteRedirectTarget('customer', '/customer/laundries') === null, 'CUSTOMER role -> route /customer/laundries: NO REDIRECT');
  assert(getRouteRedirectTarget('customer', '/customer/checkout') === null, 'CUSTOMER role -> route /customer/checkout: NO REDIRECT');

  // 2. COURIER ROLE (Marketplace Hidden & Redirected)
  console.log('\n--- 2. Testing COURIER Role UI Hiding ---');
  assert(isMarketplaceNavVisible('courier') === false, 'COURIER role -> Marketplace nav "Cari Laundry": HIDDEN');
  assert(isCustomerOrderCtaVisible('courier') === false, 'COURIER role -> "Pesan Laundry" CTA: HIDDEN');
  assert(isCustomerDashboardVisible('courier') === false, 'COURIER role -> "Dashboard Pelanggan" link: HIDDEN');
  assert(getRouteRedirectTarget('courier', '/customer/laundries') === '/courier', 'COURIER role -> route /customer/laundries: REDIRECT /courier');
  assert(getRouteRedirectTarget('courier', '/customer/checkout') === '/courier', 'COURIER role -> route /customer/checkout: REDIRECT /courier');
  assert(getRouteRedirectTarget('courier', '/') === '/courier', 'COURIER role -> route /: REDIRECT /courier');

  // 3. LAUNDRY_OWNER ROLE (Marketplace Hidden & Redirected)
  console.log('\n--- 3. Testing LAUNDRY_OWNER Role UI Hiding ---');
  assert(isMarketplaceNavVisible('laundry_owner') === false, 'LAUNDRY_OWNER role -> Marketplace nav "Cari Laundry": HIDDEN');
  assert(isCustomerOrderCtaVisible('laundry_owner') === false, 'LAUNDRY_OWNER role -> "Pesan Laundry" CTA: HIDDEN');
  assert(isCustomerDashboardVisible('laundry_owner') === false, 'LAUNDRY_OWNER role -> "Dashboard Pelanggan" link: HIDDEN');
  assert(getRouteRedirectTarget('laundry_owner', '/customer/laundries') === '/owner', 'LAUNDRY_OWNER role -> route /customer/laundries: REDIRECT /owner');
  assert(getRouteRedirectTarget('laundry_owner', '/customer/checkout') === '/owner', 'LAUNDRY_OWNER role -> route /customer/checkout: REDIRECT /owner');
  assert(getRouteRedirectTarget('laundry_owner', '/') === '/owner', 'LAUNDRY_OWNER role -> route /: REDIRECT /owner');

  // 4. LAUNDRY_STAFF ROLE (Marketplace Hidden & Redirected)
  console.log('\n--- 4. Testing LAUNDRY_STAFF Role UI Hiding ---');
  assert(isMarketplaceNavVisible('laundry_staff') === false, 'LAUNDRY_STAFF role -> Marketplace nav "Cari Laundry": HIDDEN');
  assert(isCustomerOrderCtaVisible('laundry_staff') === false, 'LAUNDRY_STAFF role -> "Pesan Laundry" CTA: HIDDEN');
  assert(isCustomerDashboardVisible('laundry_staff') === false, 'LAUNDRY_STAFF role -> "Dashboard Pelanggan" link: HIDDEN');
  assert(getRouteRedirectTarget('laundry_staff', '/customer/laundries') === '/owner', 'LAUNDRY_STAFF role -> route /customer/laundries: REDIRECT /owner');
  assert(getRouteRedirectTarget('laundry_staff', '/customer/checkout') === '/owner', 'LAUNDRY_STAFF role -> route /customer/checkout: REDIRECT /owner');
  assert(getRouteRedirectTarget('laundry_staff', '/') === '/owner', 'LAUNDRY_STAFF role -> route /: REDIRECT /owner');

  // 5. PLATFORM_ADMIN ROLE (Marketplace Hidden & Redirected)
  console.log('\n--- 5. Testing PLATFORM_ADMIN Role UI Hiding ---');
  assert(isMarketplaceNavVisible('platform_admin') === false, 'PLATFORM_ADMIN role -> Marketplace nav "Cari Laundry": HIDDEN');
  assert(isCustomerOrderCtaVisible('platform_admin') === false, 'PLATFORM_ADMIN role -> "Pesan Laundry" CTA: HIDDEN');
  assert(isCustomerDashboardVisible('platform_admin') === false, 'PLATFORM_ADMIN role -> "Dashboard Pelanggan" link: HIDDEN');
  assert(getRouteRedirectTarget('platform_admin', '/customer/laundries') === '/admin', 'PLATFORM_ADMIN role -> route /customer/laundries: REDIRECT /admin');
  assert(getRouteRedirectTarget('platform_admin', '/customer/checkout') === '/admin', 'PLATFORM_ADMIN role -> route /customer/checkout: REDIRECT /admin');
  assert(getRouteRedirectTarget('platform_admin', '/') === '/admin', 'PLATFORM_ADMIN role -> route /: REDIRECT /admin');

  console.log('\n===========================================================');
  console.log(`UI ROLE SEPARATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runOperationalRoleMarketplaceAccessTests();
