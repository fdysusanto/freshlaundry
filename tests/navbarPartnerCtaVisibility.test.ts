export function shouldShowPartnerCta(pathname: string): boolean {
  return pathname === '/';
}

console.log('==================================================');
console.log('RUNNING NAVBAR PARTNER CTA VISIBILITY TEST SUITE');
console.log('==================================================');

const routesToTest = [
  { route: '/', expected: true, label: 'Public Landing Page' },
  { route: '/login', expected: false, label: 'Login Page' },
  { route: '/register', expected: false, label: 'Register Page' },
  { route: '/register/partner', expected: false, label: 'Partner Registration Page' },
  { route: '/customer', expected: false, label: 'Customer Dashboard' },
  { route: '/customer/orders', expected: false, label: 'Customer Orders Page' },
  { route: '/customer/account', expected: false, label: 'Customer Account Page' },
  { route: '/courier', expected: false, label: 'Courier Portal' },
  { route: '/courier/job-pool', expected: false, label: 'Courier Job Pool' },
  { route: '/owner', expected: false, label: 'Laundry Owner Dashboard' },
  { route: '/admin', expected: false, label: 'Admin Monitoring' },
  { route: '/admin/partner-applications', expected: false, label: 'Admin Applications' },
];

let passed = 0;
let failed = 0;

for (const testCase of routesToTest) {
  const actual = shouldShowPartnerCta(testCase.route);
  if (actual === testCase.expected) {
    console.log(`[PASS] Route "${testCase.route}" (${testCase.label}) => Partner CTA is ${actual ? 'VISIBLE' : 'HIDDEN'}`);
    passed++;
  } else {
    console.error(`[FAIL] Route "${testCase.route}" (${testCase.label}) => Expected ${testCase.expected ? 'VISIBLE' : 'HIDDEN'}, but got ${actual ? 'VISIBLE' : 'HIDDEN'}`);
    failed++;
  }
}

console.log('==================================================');
console.log(`NAVBAR PARTNER CTA VISIBILITY RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('==================================================');

if (failed > 0) {
  process.exit(1);
}
