import { shouldShowMobileNav } from '../components/layout/MobileNav';

console.log('==================================================');
console.log('RUNNING MOBILE NAV VISIBILITY TEST SUITE');
console.log('==================================================');

const routesToTest = [
  { route: '/', expected: false, label: 'Public Landing Page' },
  { route: '/register/partner', expected: false, label: 'Partner Registration Page' },
  { route: '/register/partner/status', expected: false, label: 'Partner Registration Status Page' },
  { route: '/login', expected: true, label: 'Login Page' },
  { route: '/register', expected: true, label: 'Register Customer Page' },
  { route: '/customer', expected: true, label: 'Customer Dashboard' },
  { route: '/customer/orders', expected: true, label: 'Customer Orders Page' },
  { route: '/customer/account', expected: true, label: 'Customer Account Page' },
  { route: '/courier', expected: true, label: 'Courier Portal' },
  { route: '/courier/account', expected: true, label: 'Courier Account Page' },
  { route: '/courier/job-pool', expected: true, label: 'Courier Job Pool' },
  { route: '/owner', expected: true, label: 'Laundry Owner Dashboard' },
  { route: '/admin', expected: true, label: 'Admin Monitoring' },
];

let passed = 0;
let failed = 0;

for (const testCase of routesToTest) {
  const actual = shouldShowMobileNav(testCase.route);
  if (actual === testCase.expected) {
    console.log(
      `[PASS] Route "${testCase.route}" (${testCase.label}) => MobileNav is ${actual ? 'VISIBLE' : 'HIDDEN'}`
    );
    passed++;
  } else {
    console.error(
      `[FAIL] Route "${testCase.route}" (${testCase.label}) => Expected ${testCase.expected ? 'VISIBLE' : 'HIDDEN'}, but got ${actual ? 'VISIBLE' : 'HIDDEN'}`
    );
    failed++;
  }
}

console.log('==================================================');
console.log(`MOBILE NAV VISIBILITY RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('==================================================');

if (failed > 0) {
  process.exit(1);
}
