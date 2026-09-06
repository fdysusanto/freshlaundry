import { locationService } from '../services/locationService';
import { MarketplaceLocation } from '../types/address';

async function runLocationStateTests() {
  console.log('==================================================');
  console.log('RUNNING GPS-FIRST MARKETPLACE LOCATION TESTS');
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

  // TEST 1: Coordinate Validation
  assert(locationService.isValidCoordinate(-6.732, 108.5523) === true, 'Test 1: Valid lat/lng returns true');
  assert(locationService.isValidCoordinate(0, 0) === true, 'Test 1b: Coordinate (0, 0) is valid');
  assert(locationService.isValidCoordinate(95, 108) === false, 'Test 1c: Out of bounds latitude returns false');
  assert(locationService.isValidCoordinate(null, 108) === false, 'Test 1d: Null latitude returns false');

  // TEST 2: Manual Pin Storage in SessionStorage / Memory
  locationService.clearManualPinLocation();
  assert(locationService.getManualPinLocation() === null, 'Test 2: Initial manual pin is null');

  const pin = locationService.setManualPinLocation(-6.2, 106.8, 'Kebayoran, Jakarta Selatan');
  assert(pin.latitude === -6.2 && pin.longitude === 106.8, 'Test 2b: Manual pin correctly saved');
  assert(locationService.getManualPinLocation()?.displayAddress === 'Kebayoran, Jakarta Selatan', 'Test 2c: Manual pin displayAddress correctly returned');

  locationService.clearManualPinLocation();
  assert(locationService.getManualPinLocation() === null, 'Test 2d: Manual pin cleared successfully');

  // TEST 3: Header Format Label
  const gpsLoc: MarketplaceLocation = {
    latitude: -6.732,
    longitude: 108.5523,
    source: 'current_gps',
    status: 'success',
  };
  assert(locationService.formatMarketplaceLocationLabel(gpsLoc) === '📍 Lokasi Saat Ini', 'Test 3: GPS location formats as 📍 Lokasi Saat Ini');

  const manualLoc: MarketplaceLocation = {
    latitude: -6.2,
    longitude: 106.8,
    source: 'manual_pin',
    status: 'success',
    displayAddress: 'Kebayoran, Jakarta',
  };
  assert(locationService.formatMarketplaceLocationLabel(manualLoc) === '📍 Kebayoran, Jakarta', 'Test 3b: Manual pin formats with displayAddress');

  const deniedLoc: MarketplaceLocation = {
    latitude: null,
    longitude: null,
    source: null,
    status: 'denied',
  };
  assert(locationService.formatMarketplaceLocationLabel(deniedLoc) === '📍 Lokasi belum dipilih', 'Test 3c: Denied location formats as 📍 Lokasi belum dipilih');

  // TEST 4: Progressive Radius & Location Required Blocking
  const { marketplaceService } = require('../services/marketplaceService');

  // Test 4a: Null location returns empty array immediately
  const nullResult = await marketplaceService.getNearbyLaundryPartnersAsync(null, null);
  assert(nullResult.length === 0, 'Test 4a: Null coordinates return empty array (Location Required Blocking)');
  assert((nullResult as any).hasLocation === false, 'Test 4a-2: Null coordinates have hasLocation === false');

  // Test 4b: Coordinates fetch with Progressive Radius
  // Cirebon center coordinates (-6.732, 108.5523)
  const discoveryResult = await marketplaceService.getProgressiveDiscoveryResultAsync(-6.732, 108.5523);
  assert(discoveryResult.hasLocation === true, 'Test 4b: Discovery result hasLocation === true');
  assert([3, 5, 7, 10].includes(discoveryResult.activeRadiusKm), 'Test 4b-2: activeRadiusKm is a valid stage [3, 5, 7, 10]');
  assert(
    discoveryResult.items.every((item: any) => item.distanceKm !== undefined && item.distanceKm <= discoveryResult.activeRadiusKm),
    'Test 4b-3: All returned items are within activeRadiusKm'
  );
  assert(
    discoveryResult.items.every((item: any) => item.distanceKm <= 10),
    'Test 4b-4: Hard max cutoff 10km strictly enforced (0 items > 10km)'
  );

  // Test 4c: Far location (>100km away, e.g. Papua lat: -2.5, lng: 140.7)
  const farResult = await marketplaceService.getProgressiveDiscoveryResultAsync(-2.5, 140.7);
  assert(farResult.items.length === 0, 'Test 4c: Far location >10km returns 0 items (Radius Empty State)');
  assert(farResult.activeRadiusKm === 10, 'Test 4c-2: Empty state defaults activeRadiusKm to 10');

  console.log('\n==================================================');
  console.log(`GPS-FIRST MARKETPLACE LOCATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runLocationStateTests();

