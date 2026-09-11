import { shouldShowFooterOnMobile } from '../components/layout/Footer';

console.log('==================================================');
console.log('RUNNING FOOTER MOBILE VISIBILITY TEST SUITE');
console.log('==================================================');

const routesToTest = [
  { route: '/', expected: true, label: 'Public Landing Page' },
  { route: '/register', expected: true, label: 'Register Customer Page' },
  { route: '/register/partner', expected: true, label: 'Partner Registration Page' },
  { route: '/register/partner/status', expected: true, label: 'Partner Registration Status Page' },
  { route: '/owner/laundry/register', expected: true, label: 'Laundry Owner Registration Page' },
  { route: '/customer', expected: false, label: 'Customer Dashboard' },
  { route: '/customer/orders', expected: false, label: 'Customer Orders Page' },
  { route: '/customer/account', expected: false, label: 'Customer Account Page' },
  { route: '/courier', expected: false, label: 'Courier Portal' },
  { route: '/courier/account', expected: false, label: 'Courier Account Page' },
  { route: '/courier/job-pool', expected: false, label: 'Courier Job Pool' },
  { route: '/owner', expected: false, label: 'Laundry Owner Dashboard' },
  { route: '/admin', expected: false, label: 'Admin Monitoring' },
];

let passed = 0;
let failed = 0;

for (const testCase of routesToTest) {
  const actual = shouldShowFooterOnMobile(testCase.route);
  if (actual === testCase.expected) {
    console.log(
      `[PASS] Route "${testCase.route}" (${testCase.label}) => Mobile Footer is ${actual ? 'VISIBLE (SHOW)' : 'HIDDEN (HIDE)'}`
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
console.log(`FOOTER MOBILE VISIBILITY RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('==================================================');

if (failed > 0) {
  process.exit(1);
}
