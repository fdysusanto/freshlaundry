import { buildGoogleMapsDirectionUrl, isValidLatitude, isValidLongitude } from '../components/courier/CourierOrderCard';
import { parseDefensiveCoordinate, parseDefensiveAddress } from '../services/orderService';
import { Order } from '../types/order';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

console.log('=== RUNNING COURIER NAVIGATION & DIRECTION URL TESTS ===\n');

// ---------------------------------------------------------
// GROUP A: COORDINATE NAVIGATION & COORDINATE 0 PRESERVATION
// ---------------------------------------------------------
console.log('GROUP A: Coordinate Navigation');

// 1. Valid Customer Coordinates
const url1 = buildGoogleMapsDirectionUrl(-6.2088, 106.8456, 'Jakarta');
assert(
  url1 === 'https://www.google.com/maps/dir/?api=1&destination=-6.2088,106.8456',
  `Expected valid lat/lng URL, got: ${url1}`
);
console.log('  [PASS] Test 1: Valid customer coordinates');

// 2. Valid Laundry Coordinates
const url2 = buildGoogleMapsDirectionUrl(-6.7211, 108.5583, 'Jl. Cirebon No. 10');
assert(
  url2 === 'https://www.google.com/maps/dir/?api=1&destination=-6.7211,108.5583',
  `Expected valid laundry URL, got: ${url2}`
);
console.log('  [PASS] Test 2: Valid laundry coordinates');

// 3. Coordinate 0 Preserved (Equator / Prime Meridian)
const url3 = buildGoogleMapsDirectionUrl(0, 0, 'Zero Island');
assert(
  url3 === 'https://www.google.com/maps/dir/?api=1&destination=0,0',
  `Expected coordinate 0 to produce valid URL, got: ${url3}`
);
assert(isValidLatitude(0) === true, 'Latitude 0 must be valid');
assert(isValidLongitude(0) === true, 'Longitude 0 must be valid');
assert(parseDefensiveCoordinate(0, -90, 90) === 0, 'parseDefensiveCoordinate(0) must return 0');
console.log('  [PASS] Test 3: Coordinate 0 preserved correctly');


// ---------------------------------------------------------
// GROUP B: ADDRESS FALLBACK
// ---------------------------------------------------------
console.log('\nGROUP B: Address Fallback');

// 4. Null coordinates + valid address
const url4 = buildGoogleMapsDirectionUrl(null, null, 'Jl. Jendral Sudirman No. 1, Jakarta');
assert(
  url4 === 'https://www.google.com/maps/dir/?api=1&destination=Jl.%20Jendral%20Sudirman%20No.%201%2C%20Jakarta',
  `Expected encoded address URL, got: ${url4}`
);
console.log('  [PASS] Test 4: Null coordinates with valid address fallback');

// 5. Invalid coordinates + valid address
const url5 = buildGoogleMapsDirectionUrl(999, 999, 'Jl. Gatot Subroto');
assert(
  url5 === 'https://www.google.com/maps/dir/?api=1&destination=Jl.%20Gatot%20Subroto',
  `Expected address fallback on out-of-bounds coordinates, got: ${url5}`
);
console.log('  [PASS] Test 5: Invalid coordinates fall back to address');


// ---------------------------------------------------------
// GROUP C: INVALID DATA & EDGE CASES
// ---------------------------------------------------------
console.log('\nGROUP C: Invalid Data & Boundary Checks');

// 6. Null coordinates + no address
const url6 = buildGoogleMapsDirectionUrl(null, null, '   ');
assert(url6 === null, `Expected null for missing coordinates & empty address, got: ${url6}`);
console.log('  [PASS] Test 6: Null coordinates and empty address returns null');

// 7. NaN coordinates
const url7 = buildGoogleMapsDirectionUrl(NaN, 106.8456, 'Jakarta');
assert(
  url7 === 'https://www.google.com/maps/dir/?api=1&destination=Jakarta',
  `Expected NaN latitude to trigger address fallback, got: ${url7}`
);
assert(parseDefensiveCoordinate(NaN, -90, 90) === null, 'parseDefensiveCoordinate(NaN) must be null');
console.log('  [PASS] Test 7: NaN coordinates safely rejected');

// 8. Infinity coordinates
assert(isValidLatitude(Infinity) === false, 'Infinity latitude must be invalid');
assert(isValidLongitude(-Infinity) === false, '-Infinity longitude must be invalid');
assert(parseDefensiveCoordinate(Infinity, -90, 90) === null, 'Infinity coordinate must return null');
console.log('  [PASS] Test 8: Infinity coordinates safely rejected');

// 9. Out-of-range latitude
assert(isValidLatitude(91) === false, 'Latitude > 90 must be invalid');
assert(isValidLatitude(-90.1) === false, 'Latitude < -90 must be invalid');
assert(parseDefensiveCoordinate(95, -90, 90) === null, 'Latitude 95 must return null');
console.log('  [PASS] Test 9: Out-of-range latitude rejected');

// 10. Out-of-range longitude
assert(isValidLongitude(180.5) === false, 'Longitude > 180 must be invalid');
assert(isValidLongitude(-181) === false, 'Longitude < -180 must be invalid');
assert(parseDefensiveCoordinate(190, -180, 180) === null, 'Longitude 190 must return null');
console.log('  [PASS] Test 10: Out-of-range longitude rejected');

// Coercion safety tests for parseDefensiveCoordinate / parseDefensiveAddress
assert(parseDefensiveCoordinate('', -90, 90) === null, 'Empty string must return null');
assert(parseDefensiveCoordinate(false, -90, 90) === null, 'Boolean false must return null');
assert(parseDefensiveCoordinate(true, -90, 90) === null, 'Boolean true must return null');
assert(parseDefensiveAddress('  ') === null, 'Whitespace address must return null');
assert(parseDefensiveAddress('Jl. Merdeka') === 'Jl. Merdeka', 'Valid address trimmed correctly');


// ---------------------------------------------------------
// GROUP D: DESTINATION CORRECTNESS
// ---------------------------------------------------------
console.log('\nGROUP D: Destination Correctness');

const mockPickupOrder: Partial<Order> = {
  status: 'assigned',
  assignmentType: 'pickup',
  pickupAddress: 'Alamat Pickup Customer',
  deliveryAddress: 'Alamat Delivery Customer',
  pickupAddressSnapshot: {
    recipient_name: 'Customer A',
    phone: '08123456789',
    province_code: '32',
    province_name: 'Jawa Barat',
    city_code: '3274',
    city_name: 'Kota Cirebon',
    district_code: '327401',
    district_name: 'Harjamukti',
    village_code: '3274011001',
    village_name: 'Katiasa',
    postal_code: '45144',
    address_detail: 'Jl. Katiasa No. 12',
    latitude: -6.1,
    longitude: 106.8,
  },
  deliveryAddressSnapshot: {
    recipient_name: 'Customer A',
    phone: '08123456789',
    province_code: '32',
    province_name: 'Jawa Barat',
    city_code: '3274',
    city_name: 'Kota Cirebon',
    district_code: '327401',
    district_name: 'Harjamukti',
    village_code: '3274011001',
    village_name: 'Katiasa',
    postal_code: '45144',
    address_detail: 'Jl. Katiasa No. 12',
    latitude: -6.2,
    longitude: 106.9,
  },
  laundryLatitude: -6.7,
  laundryLongitude: 108.5,
  laundryAddress: 'Outlet Laundry Cirebon',
};

const mockDeliveryOrder: Partial<Order> = {
  status: 'out_for_delivery',
  assignmentType: 'delivery',
  pickupAddress: 'Alamat Pickup Customer',
  deliveryAddress: 'Alamat Delivery Customer',
  pickupAddressSnapshot: {
    recipient_name: 'Customer A',
    phone: '08123456789',
    province_code: '32',
    province_name: 'Jawa Barat',
    city_code: '3274',
    city_name: 'Kota Cirebon',
    district_code: '327401',
    district_name: 'Harjamukti',
    village_code: '3274011001',
    village_name: 'Katiasa',
    postal_code: '45144',
    address_detail: 'Jl. Katiasa No. 12',
    latitude: -6.1,
    longitude: 106.8,
  },
  deliveryAddressSnapshot: {
    recipient_name: 'Customer A',
    phone: '08123456789',
    province_code: '32',
    province_name: 'Jawa Barat',
    city_code: '3274',
    city_name: 'Kota Cirebon',
    district_code: '327401',
    district_name: 'Harjamukti',
    village_code: '3274011001',
    village_name: 'Katiasa',
    postal_code: '45144',
    address_detail: 'Jl. Katiasa No. 12',
    latitude: -6.2,
    longitude: 106.9,
  },
  laundryLatitude: -6.7,
  laundryLongitude: 108.5,
  laundryAddress: 'Outlet Laundry Cirebon',
};

// 11. Pickup task customer navigation must target pickup address snapshot
const pickupCustomerUrl = buildGoogleMapsDirectionUrl(
  mockPickupOrder.pickupAddressSnapshot?.latitude,
  mockPickupOrder.pickupAddressSnapshot?.longitude,
  mockPickupOrder.pickupAddress
);
assert(
  pickupCustomerUrl === 'https://www.google.com/maps/dir/?api=1&destination=-6.1,106.8',
  `Pickup task customer navigation targeted wrong coords: ${pickupCustomerUrl}`
);
console.log('  [PASS] Test 11: Pickup task customer navigation targets pickup coordinates');

// 12. Delivery task customer navigation must target delivery address snapshot
const deliveryCustomerUrl = buildGoogleMapsDirectionUrl(
  mockDeliveryOrder.deliveryAddressSnapshot?.latitude,
  mockDeliveryOrder.deliveryAddressSnapshot?.longitude,
  mockDeliveryOrder.deliveryAddress
);
assert(
  deliveryCustomerUrl === 'https://www.google.com/maps/dir/?api=1&destination=-6.2,106.9',
  `Delivery task customer navigation targeted wrong coords: ${deliveryCustomerUrl}`
);
console.log('  [PASS] Test 12: Delivery task customer navigation targets delivery coordinates');

// 13. Laundry navigation must target laundry coordinates
const laundryUrl = buildGoogleMapsDirectionUrl(
  mockPickupOrder.laundryLatitude,
  mockPickupOrder.laundryLongitude,
  mockPickupOrder.laundryAddress
);
assert(
  laundryUrl === 'https://www.google.com/maps/dir/?api=1&destination=-6.7,108.5',
  `Laundry navigation targeted wrong coords: ${laundryUrl}`
);
console.log('  [PASS] Test 13: Laundry navigation targets laundry outlet coordinates');

console.log('\n=== ALL COURIER NAVIGATION TESTS PASSED SUCCESSFULLY! ===');
