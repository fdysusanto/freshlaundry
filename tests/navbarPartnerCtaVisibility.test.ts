export function shouldShowPartnerCta(pathname: string): boolean {
  return pathname === '/';
}

export function shouldShowLoginCta(pathname: string): boolean {
  const isPublicLandingPage = pathname === '/';
  const isPartnerRegistrationPage =
    pathname === '/register/partner' ||
    pathname.startsWith('/register/partner/') ||
    pathname === '/owner/laundry/register' ||
    pathname.startsWith('/owner/laundry/register/');
  return !isPublicLandingPage && !isPartnerRegistrationPage;
}

console.log('==================================================');
console.log('RUNNING NAVBAR CTA VISIBILITY TEST SUITE');
console.log('==================================================');

const routesToTest = [
  { route: '/', expectedLogin: false, expectedPartner: true, label: 'Public Landing Page' },
  { route: '/login', expectedLogin: true, expectedPartner: false, label: 'Login Page' },
  { route: '/register', expectedLogin: true, expectedPartner: false, label: 'Register Page' },
  { route: '/register/partner', expectedLogin: false, expectedPartner: false, label: 'Partner Registration Page' },
  { route: '/register/partner/status', expectedLogin: false, expectedPartner: false, label: 'Partner Registration Status Page' },
  { route: '/owner/laundry/register', expectedLogin: false, expectedPartner: false, label: 'Laundry Owner Registration Page' },
  { route: '/customer', expectedLogin: true, expectedPartner: false, label: 'Customer Dashboard' },
  { route: '/customer/orders', expectedLogin: true, expectedPartner: false, label: 'Customer Orders Page' },
  { route: '/customer/account', expectedLogin: true, expectedPartner: false, label: 'Customer Account Page' },
  { route: '/courier', expectedLogin: true, expectedPartner: false, label: 'Courier Portal' },
  { route: '/courier/account', expectedLogin: true, expectedPartner: false, label: 'Courier Account Page' },
  { route: '/courier/job-pool', expectedLogin: true, expectedPartner: false, label: 'Courier Job Pool' },
  { route: '/owner', expectedLogin: true, expectedPartner: false, label: 'Laundry Owner Dashboard' },
  { route: '/admin', expectedLogin: true, expectedPartner: false, label: 'Admin Monitoring' },
  { route: '/admin/partner-applications', expectedLogin: true, expectedPartner: false, label: 'Admin Applications' },
];

let passed = 0;
let failed = 0;

for (const testCase of routesToTest) {
  const actualPartner = shouldShowPartnerCta(testCase.route);
  const actualLogin = shouldShowLoginCta(testCase.route);

  const partnerOk = actualPartner === testCase.expectedPartner;
  const loginOk = actualLogin === testCase.expectedLogin;

  if (partnerOk && loginOk) {
    console.log(
      `[PASS] Route "${testCase.route}" (${testCase.label}) => Login CTA: ${actualLogin ? 'VISIBLE' : 'HIDDEN'}, Partner CTA: ${actualPartner ? 'VISIBLE' : 'HIDDEN'}`
    );
    passed++;
  } else {
    console.error(
      `[FAIL] Route "${testCase.route}" (${testCase.label}) => Expected Login=${testCase.expectedLogin ? 'VISIBLE' : 'HIDDEN'}, Partner=${testCase.expectedPartner ? 'VISIBLE' : 'HIDDEN'}, but got Login=${actualLogin ? 'VISIBLE' : 'HIDDEN'}, Partner=${actualPartner ? 'VISIBLE' : 'HIDDEN'}`
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


