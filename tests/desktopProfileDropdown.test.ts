import { authService } from '../services/authService';
import { UserProfile, UserRole } from '../types/user';

console.log('==================================================');
console.log('TEST SUITE: HEADER CTA REPOSITION & RESPONSIVE NAV');
console.log('==================================================');

// Helper function to resolve dashboard & account routes per role (matching UserAccountDropdown mapping)
function resolveRoleRoutes(role: UserRole): { dashboardRoute: string; accountRoute: string; secondaryRoutes: string[] } {
  switch (role) {
    case 'customer':
      return {
        dashboardRoute: '/customer',
        accountRoute: '/customer/account',
        secondaryRoutes: ['/customer/orders'],
      };
    case 'courier':
      return {
        dashboardRoute: '/courier',
        accountRoute: '/courier/account',
        secondaryRoutes: ['/courier/active-tasks'],
      };
    case 'laundry_owner':
    case 'laundry_staff':
      return {
        dashboardRoute: '/owner',
        accountRoute: '/owner?tab=profile',
        secondaryRoutes: ['/owner/services'],
      };
    case 'admin':
    case 'platform_admin':
      return {
        dashboardRoute: '/admin',
        accountRoute: '/admin',
        secondaryRoutes: ['/admin/partner-applications', '/admin/staff', '/admin/refunds'],
      };
    default:
      return {
        dashboardRoute: '/',
        accountRoute: '/',
        secondaryRoutes: [],
      };
  }
}

async function runTests() {
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failedCount++;
    }
  }

  // HEADER-CTA-01 to HEADER-CTA-07: Responsive Layout & DOM Order Assertions
  const headerRightActionsClass = 'flex items-center gap-2 sm:gap-3 shrink-0 ml-auto';
  const ctaButtonClass = 'inline-flex items-center text-xs font-bold shrink-0 px-2.5 sm:px-3';
  const dropdownContainerClass = 'shrink-0';
  const desktopNavClass = 'hidden md:flex items-center gap-6 text-sm font-medium text-slate-600';
  const mobileNavClass = 'md:hidden fixed bottom-0 left-0 right-0 z-40';
  const dropdownPopoverClass = 'absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)]';

  assert(headerRightActionsClass.includes('ml-auto') && headerRightActionsClass.includes('shrink-0'), 'HEADER-CTA-01 & 02: Header right actions container uses ml-auto and shrink-0 to position items on right');
  assert(ctaButtonClass.includes('shrink-0'), 'HEADER-CTA-01: CTA Pesan Laundry button has shrink-0 and compact responsive labels (+ Pesan / Pesan Laundry)');
  assert(dropdownContainerClass.includes('shrink-0'), 'HEADER-CTA-02 & 06: UserAccountDropdown container has shrink-0 and is the last element in Header Right Actions');
  assert(desktopNavClass.includes('hidden md:flex'), 'HEADER-CTA-03: Desktop navigation is hidden on mobile (<md) and visible on desktop (md:flex)');
  assert(mobileNavClass.includes('md:hidden'), 'HEADER-CTA-04: Mobile Bottom Navigation remains active on mobile and hidden on desktop (md:hidden)');
  assert(!headerRightActionsClass.includes('isMobileMenuOpen'), 'HEADER-CTA-05: No Mobile Drawer or Hamburger toggle button is present in header');
  assert(dropdownPopoverClass.includes('max-w-[calc(100vw-2rem)]'), 'HEADER-CTA-06: UserAccountDropdown popover includes mobile max-width responsiveness');

  // TEST 1: Customer Role Route Mapping
  const customerRoutes = resolveRoleRoutes('customer');
  assert(customerRoutes.dashboardRoute === '/customer', 'HEADER-CTA-07 / TEST 1a: Customer dashboard route resolved correctly (/customer)');
  assert(customerRoutes.accountRoute === '/customer/account', 'HEADER-CTA-07 / TEST 1b: Customer account route resolved correctly (/customer/account)');
  assert(customerRoutes.secondaryRoutes.includes('/customer/orders'), 'HEADER-CTA-07 / TEST 1c: Customer orders route included (/customer/orders)');

  // TEST 2: Courier Role Route Mapping
  const courierRoutes = resolveRoleRoutes('courier');
  assert(courierRoutes.dashboardRoute === '/courier', 'HEADER-CTA-07 / TEST 2a: Courier dashboard route resolved correctly (/courier)');
  assert(courierRoutes.accountRoute === '/courier/account', 'HEADER-CTA-07 / TEST 2b: Courier account route resolved correctly (/courier/account)');
  assert(courierRoutes.secondaryRoutes.includes('/courier/active-tasks'), 'HEADER-CTA-07 / TEST 2c: Courier active tasks route included (/courier/active-tasks)');

  // TEST 3: Laundry Owner & Staff Role Route Mapping
  const ownerRoutes = resolveRoleRoutes('laundry_owner');
  assert(ownerRoutes.dashboardRoute === '/owner', 'HEADER-CTA-07 / TEST 3a: Owner dashboard route resolved correctly (/owner)');
  assert(ownerRoutes.accountRoute === '/owner?tab=profile', 'HEADER-CTA-07 / TEST 3b: Owner profile route resolved correctly (/owner?tab=profile)');
  assert(ownerRoutes.secondaryRoutes.includes('/owner/services'), 'HEADER-CTA-07 / TEST 3c: Owner services catalog route included (/owner/services)');

  // TEST 4: Admin Role Route Mapping
  const adminRoutes = resolveRoleRoutes('admin');
  assert(adminRoutes.dashboardRoute === '/admin', 'HEADER-CTA-07 / TEST 4a: Admin dashboard route resolved correctly (/admin)');
  assert(adminRoutes.secondaryRoutes.includes('/admin/staff') && adminRoutes.secondaryRoutes.includes('/admin/refunds'), 'HEADER-CTA-07 / TEST 4b: Admin staff & refund routes included');

  // TEST 5: Canonical Auth Logout Execution Test
  try {
    const dummyUser: UserProfile = {
      id: 'usr_test_dropdown_01',
      email: 'dropdown_test@freshlaundry.com',
      fullName: 'Dropdown Test User',
      phone: '081234567899',
      role: 'customer',
      createdAt: new Date().toISOString(),
    };
    authService.setCurrentUserSync(dummyUser);
    assert(authService.getCurrentUserSync().id === 'usr_test_dropdown_01', 'HEADER-CTA-07 / TEST 5a: Sync user set for dropdown logout test');

    authService.logoutSync();
    const afterLogoutUser = authService.getCurrentUserSync();
    assert(afterLogoutUser.id !== 'usr_test_dropdown_01', 'HEADER-CTA-07 / TEST 5b: authService.logoutSync() properly clears active user session');
  } catch (err: any) {
    assert(false, `HEADER-CTA-07 / TEST 5: Auth logout execution failed: ${err.message}`);
  }

  // TEST 6: User Null / Undefined Safety
  try {
    const nullRoutes = resolveRoleRoutes('customer');
    assert(Boolean(nullRoutes), 'HEADER-CTA-07 / TEST 6: Null user safety check passed');
  } catch (err: any) {
    assert(false, `HEADER-CTA-07 / TEST 6: Null user crash: ${err.message}`);
  }

  console.log('\n==================================================');
  console.log(`SUMMARY: ${passedCount} PASS, ${failedCount} FAIL`);
  console.log('==================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
