import { locationService, DEFAULT_SEARCH_LOCATION } from '../services/locationService';
import { UserProfile } from '../types/user';

async function runLocationStateTests() {
  console.log('==================================================');
  console.log('RUNNING LOCATION STATE & UX CORRECTION TESTS');
  console.log('==================================================\n');

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

  // Clear any existing localStorage mock state before starting
  locationService.clearGuestSearchLocation();

  // TEST 1: Guest + no location chosen
  const state1 = locationService.computeLocationState(false, null);
  assert(state1.stateType === 'GUEST_DEFAULT', 'Test 1: Guest without location resolves to GUEST_DEFAULT');
  assert(state1.headerLabel === 'LOKASI PENCARIAN:', 'Test 1: Guest header label is "LOKASI PENCARIAN:" (NOT "LOKASI PENJEMPUTAN ANDA")');
  assert(state1.displayLocation === DEFAULT_SEARCH_LOCATION, 'Test 1: Default search area display text');
  assert(state1.ctaText === 'Pilih Lokasi', 'Test 1: Guest CTA text is "Pilih Lokasi"');
  assert(state1.isCustomerPickupAddress === false, 'Test 1: Default location is NOT marked as customer pickup address');

  // TEST 2: Guest + custom search location chosen
  locationService.setGuestSearchLocation('Tebet, Jakarta Selatan');
  const state2 = locationService.computeLocationState(false, null);
  assert(state2.stateType === 'GUEST_CUSTOM', 'Test 2: Guest with custom location resolves to GUEST_CUSTOM');
  assert(state2.headerLabel === 'LOKASI PENCARIAN:', 'Test 2: Header label remains "LOKASI PENCARIAN:"');
  assert(state2.displayLocation === 'Tebet, Jakarta Selatan', 'Test 2: Display location shows chosen search area');
  assert(state2.ctaText === 'Ubah', 'Test 2: CTA text is "Ubah"');
  assert(state2.isCustomerPickupAddress === false, 'Test 2: Guest custom search location is NOT a customer pickup address');
  locationService.clearGuestSearchLocation();

  // TEST 3: Authenticated customer + no saved pickup address
  const unaddressedCustomer: UserProfile = {
    id: 'usr_cust_no_addr',
    email: 'new@customer.com',
    fullName: 'Pelanggan Baru',
    phone: '0811111111',
    role: 'customer',
    address: '',
    createdAt: new Date().toISOString(),
  };
  const state3 = locationService.computeLocationState(false, unaddressedCustomer);
  assert(state3.stateType === 'CUSTOMER_NO_ADDRESS', 'Test 3: Customer without address resolves to CUSTOMER_NO_ADDRESS');
  assert(state3.headerLabel === 'LOKASI PENJEMPUTAN:', 'Test 3: Header label is "LOKASI PENJEMPUTAN:"');
  assert(state3.displayLocation === 'Tambahkan alamat pickup', 'Test 3: Placeholder displays "Tambahkan alamat pickup"');
  assert(state3.ctaText === 'Tambah Alamat', 'Test 3: CTA text is "Tambah Alamat"');
  assert(state3.isCustomerPickupAddress === false, 'Test 3: Unaddressed customer has no pickup address');

  // TEST 4: Authenticated customer + saved pickup address
  const addressedCustomer: UserProfile = {
    id: 'usr_cust_with_addr',
    email: 'budi@customer.com',
    fullName: 'Budi Santoso',
    phone: '081234567890',
    role: 'customer',
    address: 'Jl. Sudirman No. 10, Jakarta Pusat',
    createdAt: new Date().toISOString(),
  };
  const state4 = locationService.computeLocationState(false, addressedCustomer);
  assert(state4.stateType === 'CUSTOMER_HAS_ADDRESS', 'Test 4: Customer with address resolves to CUSTOMER_HAS_ADDRESS');
  assert(state4.headerLabel === 'LOKASI PENJEMPUTAN ANDA:', 'Test 4: Header label is "LOKASI PENJEMPUTAN ANDA:"');
  assert(state4.displayLocation === 'Jl. Sudirman No. 10, Jakarta Pusat', 'Test 4: Displays real saved customer address');
  assert(state4.ctaText === 'Ubah', 'Test 4: CTA text is "Ubah"');
  assert(state4.isCustomerPickupAddress === true, 'Test 4: Marked as valid customer pickup address');

  // TEST 5: Default search location protection
  assert(state1.pickupAddress === '', 'Test 5: Default search location is never copied into pickupAddress');

  // TEST 6: Checkout Safety
  assert(state3.pickupAddress === '', 'Test 6: Unaddressed customer pickupAddress is empty, preventing accidental checkout with fake address');

  // TEST 7: Auth Loading
  const state7 = locationService.computeLocationState(true, null);
  assert(state7.stateType === 'AUTH_LOADING', 'Test 7: Auth loading state resolves to AUTH_LOADING');
  assert(state7.isCustomerPickupAddress === false, 'Test 7: Auth loading does not display customer address prematurely');

  console.log('\n==================================================');
  console.log(`LOCATION STATE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runLocationStateTests();
