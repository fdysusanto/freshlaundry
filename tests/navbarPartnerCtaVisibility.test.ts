export function shouldShowPartnerCta(pathname: string): boolean {
  return pathname === '/';
}

export function shouldShowAccountCta(pathname: string): boolean {
  return pathname !== '/';
}

console.log('==================================================');
console.log('RUNNING NAVBAR CTA VISIBILITY TEST SUITE');
console.log('==================================================');

const routesToTest = [
  { route: '/', expectedAccount: false, expectedPartner: true, label: 'Public Landing Page' },
  { route: '/login', expectedAccount: true, expectedPartner: false, label: 'Login Page' },
  { route: '/register', expectedAccount: true, expectedPartner: false, label: 'Register Page' },
  { route: '/register/partner', expectedAccount: true, expectedPartner: false, label: 'Partner Registration Page' },
  { route: '/customer', expectedAccount: true, expectedPartner: false, label: 'Customer Dashboard' },
  { route: '/customer/orders', expectedAccount: true, expectedPartner: false, label: 'Customer Orders Page' },
  { route: '/customer/account', expectedAccount: true, expectedPartner: false, label: 'Customer Account Page' },
  { route: '/courier', expectedAccount: true, expectedPartner: false, label: 'Courier Portal' },
  { route: '/courier/account', expectedAccount: true, expectedPartner: false, label: 'Courier Account Page' },
  { route: '/courier/job-pool', expectedAccount: true, expectedPartner: false, label: 'Courier Job Pool' },
  { route: '/owner', expectedAccount: true, expectedPartner: false, label: 'Laundry Owner Dashboard' },
  { route: '/admin', expectedAccount: true, expectedPartner: false, label: 'Admin Monitoring' },
  { route: '/admin/partner-applications', expectedAccount: true, expectedPartner: false, label: 'Admin Applications' },
];

let passed = 0;
let failed = 0;

for (const testCase of routesToTest) {
  const actualPartner = shouldShowPartnerCta(testCase.route);
  const actualAccount = shouldShowAccountCta(testCase.route);

  const partnerOk = actualPartner === testCase.expectedPartner;
  const accountOk = actualAccount === testCase.expectedAccount;

  if (partnerOk && accountOk) {
    console.log(
      `[PASS] Route "${testCase.route}" (${testCase.label}) => Account CTA: ${actualAccount ? 'VISIBLE' : 'HIDDEN'}, Partner CTA: ${actualPartner ? 'VISIBLE' : 'HIDDEN'}`
    );
    passed++;
  } else {
    console.error(
      `[FAIL] Route "${testCase.route}" (${testCase.label}) => Expected Account=${testCase.expectedAccount ? 'VISIBLE' : 'HIDDEN'}, Partner=${testCase.expectedPartner ? 'VISIBLE' : 'HIDDEN'}, but got Account=${actualAccount ? 'VISIBLE' : 'HIDDEN'}, Partner=${actualPartner ? 'VISIBLE' : 'HIDDEN'}`
    );
    failed++;
  }
}

console.log('==================================================');
console.log(`NAVBAR CTA VISIBILITY RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('==================================================');

if (failed > 0) {
  process.exit(1);
}

