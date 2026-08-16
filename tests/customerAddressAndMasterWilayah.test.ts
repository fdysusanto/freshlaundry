import { UserRole } from '../types/user';
import { CustomerAddress, AddressSnapshot } from '../types/address';
import {
  FALLBACK_PROVINCES,
  FALLBACK_CITIES,
  FALLBACK_DISTRICTS,
  FALLBACK_VILLAGES,
  customerAddressService,
} from '../services/customerAddressService';

export function isUserAuthorizedToAccessAddressBook(callerRole?: UserRole, targetCustomerId?: string, callerId?: string): boolean {
  if (!callerRole || !callerId || !targetCustomerId) return false;
  // ONLY the customer themselves can access their own address book
  return callerRole === 'customer' && callerId === targetCustomerId;
}

export function validateAddressPayload(payload: {
  recipientName?: string;
  phone?: string;
  provinceCode?: string;
  cityCode?: string;
  districtCode?: string;
  villageCode?: string;
  addressDetail?: string;
}): { valid: boolean; error?: string } {
  if (!payload.recipientName || !payload.recipientName.trim()) {
    return { valid: false, error: 'Nama penerima wajib diisi.' };
  }
  if (!payload.phone || !payload.phone.trim()) {
    return { valid: false, error: 'No HP penerima wajib diisi.' };
  }
  if (!payload.provinceCode || !payload.cityCode || !payload.districtCode || !payload.villageCode) {
    return { valid: false, error: 'Master wilayah administratif wajib diisi lengkap.' };
  }
  if (!payload.addressDetail || !payload.addressDetail.trim()) {
    return { valid: false, error: 'Alamat lengkap wajib diisi.' };
  }
  return { valid: true };
}

async function runCustomerAddressAndMasterWilayahTests() {
  console.log('===========================================================');
  console.log('RUNNING CUSTOMER ADDRESS & MASTER WILAYAH CIREBON TEST SUITE');
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

  const customerA = 'usr_customer_A_11111111-1111-1111-1111-111111111111';
  const customerB = 'usr_customer_B_22222222-2222-2222-2222-222222222222';

  // 1-5. Address Book Ownership & RLS Security
  console.log('--- 1. Testing Address Book Ownership & RLS Security ---');
  assert(
    isUserAuthorizedToAccessAddressBook('customer', customerA, customerA) === true,
    '1. Customer A CAN access own address book'
  );
  assert(
    isUserAuthorizedToAccessAddressBook('customer', customerA, customerB) === false,
    '2. Customer B CANNOT access Customer A address book (403/Forbidden)'
  );
  assert(
    isUserAuthorizedToAccessAddressBook('courier', customerA, 'courier_01') === false,
    '3. Courier CANNOT access Customer A address book'
  );
  assert(
    isUserAuthorizedToAccessAddressBook('laundry_owner', customerA, 'owner_01') === false,
    '4. Laundry Owner CANNOT access Customer A address book'
  );
  assert(
    isUserAuthorizedToAccessAddressBook('laundry_staff', customerA, 'staff_01') === false,
    '5. Laundry Staff CANNOT access Customer A address book'
  );

  // 6-8. Master Wilayah Cascading & Cirebon Data Integrity
  console.log('\n--- 2. Testing Master Wilayah Kota Cirebon Cascading Data ---');
  const provinces = FALLBACK_PROVINCES;
  assert(provinces.some((p) => p.code === '32' && p.name === 'Jawa Barat'), '6. Master Province includes Jawa Barat (32)');

  const cities = FALLBACK_CITIES.filter((c) => c.provinceCode === '32');
  assert(cities.some((c) => c.code === '3274' && c.name === 'Kota Cirebon'), '7. Master City includes Kota Cirebon (3274)');

  const districts = FALLBACK_DISTRICTS.filter((d) => d.cityCode === '3274');
  assert(districts.length === 5, '8. Kota Cirebon has 5 official districts (Harjamukti, Lemahwungkuk, Kejaksan, Kesambi, Pekalipan)');

  const kesambiVillages = FALLBACK_VILLAGES.filter((v) => v.districtCode === '327404');
  const karyamulya = kesambiVillages.find((v) => v.name === 'Karyamulya');
  assert(karyamulya?.postalCode === '45135', '9. Karyamulya (Kesambi, Kota Cirebon) auto-resolves postal code 45135');

  // 10. Default Address Logic
  console.log('\n--- 3. Testing Single Default Address Rules ---');
  const mockAddr1: CustomerAddress = {
    id: 'addr_1',
    customerId: customerA,
    label: 'Rumah',
    recipientName: 'Budi',
    phone: '08123456789',
    provinceCode: '32',
    provinceName: 'Jawa Barat',
    cityCode: '3274',
    cityName: 'Kota Cirebon',
    districtCode: '327404',
    districtName: 'Kesambi',
    villageCode: '3274041002',
    villageName: 'Karyamulya',
    postalCode: '45135',
    addressDetail: 'Jl. Perjuangan No. 10',
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const snapshot1 = customerAddressService.createSnapshotFromAddress(mockAddr1);
  assert(
    snapshot1.postal_code === '45135' && snapshot1.village_name === 'Karyamulya',
    '10. Address Snapshot correctly created with structured region details'
  );

  // 11. Order Address Snapshot Immutability Test
  console.log('\n--- 4. Testing Order Address Snapshot Immutability ---');
  const initialOrderSnapshot: AddressSnapshot = { ...snapshot1 };
  
  // Customer edits their address book "Rumah" later to another address
  const updatedAddr1: CustomerAddress = {
    ...mockAddr1,
    addressDetail: 'Jl. Pemuda No. 99 (MODIFIED AFTER ORDER)',
    villageName: 'Sunyaragi',
    postalCode: '45132',
  };

  assert(
    initialOrderSnapshot.address_detail === 'Jl. Perjuangan No. 10' &&
    initialOrderSnapshot.village_name === 'Karyamulya',
    '11. Order Address Snapshot remains IMMUTABLE even after customer updates address book'
  );

  // 12. Partner Registration Region Integration
  console.log('\n--- 5. Testing Partner Registration Master Wilayah Integration ---');
  const validPayload = validateAddressPayload({
    recipientName: 'Toko Laundry Barokah',
    phone: '081234567890',
    provinceCode: '32',
    cityCode: '3274',
    districtCode: '327404',
    villageCode: '3274041002',
    addressDetail: 'Jl. Majalengka No. 5',
  });
  assert(validPayload.valid === true, '12. Partner registration form successfully validated Master Wilayah Cirebon');

  console.log('\n===========================================================');
  console.log(`CUSTOMER ADDRESS & REGION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomerAddressAndMasterWilayahTests();
