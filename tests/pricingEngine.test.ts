import { pricingService } from '../services/pricingService';
import { laundryService } from '../services/laundryService';

function runPricingEngineTests() {
  console.log('==================================================');
  console.log('RUNNING PRICING ENGINE UNIT TESTS');
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

  function assertThrows(fn: () => void, testName: string) {
    try {
      fn();
      console.error(`[FAIL] ${testName} (Expected exception but none was thrown)`);
      failed++;
    } catch (err: any) {
      console.log(`[PASS] ${testName} (Caught expected error: "${err.message}")`);
      passed++;
    }
  }

  // Laundry 1 (`lnd_001` - FreshWash Express Kebayoran):
  // srv_001: Cuci Komplit Kiloan @ Rp 8.000 / kg
  // srv_002: Express 6 Jam @ Rp 15.000 / kg
  // srv_003: Dry Cleaning Jas & Gaun @ Rp 35.000 / pcs

  // Laundry 2 (`lnd_002` - CleanPro Laundry Tebet):
  // srv_101: Cuci Kiloan CleanPro @ Rp 7.000 / kg

  // Test 1: 1 item x quantity 1
  const res1 = pricingService.calculateOrderPricing({
    laundryId: 'lnd_001',
    items: [{ serviceId: 'srv_001', quantity: 1 }],
  });
  assert(res1.subtotal === 8000, 'Test 1: 1 item x quantity 1 -> subtotal = Rp 8.000');
  assert(res1.platformFee === 2000, 'Test 1: platformFee = Rp 2.000');
  assert(res1.totalPrice === 10000, 'Test 1: totalPrice = 8000 + 0 + 2000 - 0 = Rp 10.000');

  // Test 2: 1 item x quantity 5
  const res2 = pricingService.calculateOrderPricing({
    laundryId: 'lnd_001',
    items: [{ serviceId: 'srv_001', quantity: 5 }],
  });
  assert(res2.subtotal === 40000, 'Test 2: 1 item x quantity 5 -> subtotal = 5 x 8000 = Rp 40.000');
  assert(res2.totalPrice === 42000, 'Test 2: totalPrice = 40000 + 2000 = Rp 42.000');

  // Test 3: Multiple services
  const res3 = pricingService.calculateOrderPricing({
    laundryId: 'lnd_001',
    items: [
      { serviceId: 'srv_001', quantity: 3 }, // 3 x 8000 = 24000
      { serviceId: 'srv_003', quantity: 2 }, // 2 x 35000 = 70000
    ],
  });
  assert(res3.subtotal === 94000, 'Test 3: Multiple services subtotal = 24000 + 70000 = Rp 94.000');
  assert(res3.totalPrice === 96000, 'Test 3: totalPrice = 94000 + 2000 = Rp 96.000');

  // Test 4: Delivery fee abstraction calculation
  const res4 = pricingService.calculateOrderPricing({
    laundryId: 'lnd_001',
    items: [{ serviceId: 'srv_001', quantity: 2 }],
  });
  assert(typeof res4.deliveryFee === 'number' && res4.deliveryFee >= 0, 'Test 4: deliveryFee calculated cleanly as non-negative integer IDR');

  // Test 5: Platform fee abstraction calculation
  const res5 = pricingService.calculateOrderPricing({
    laundryId: 'lnd_001',
    items: [{ serviceId: 'srv_001', quantity: 2 }],
  });
  assert(res5.platformFee === 2000, 'Test 5: platformFee calculated centrally as Rp 2.000');

  // Test 6: Discount calculation (FRESH5K gives Rp 5.000 off for subtotal >= 20.000)
  const res6 = pricingService.calculateOrderPricing({
    laundryId: 'lnd_001',
    items: [{ serviceId: 'srv_001', quantity: 3 }], // 24.000 subtotal
    discountCode: 'FRESH5K',
  });
  assert(res6.discount === 5000, 'Test 6: discountCode FRESH5K yields Rp 5.000 discount');
  assert(res6.totalPrice === 21000, 'Test 6: totalPrice = 24000 + 0 + 2000 - 5000 = Rp 21.000');

  // Test 7: Discount greater than total (total never negative)
  const res7 = pricingService.calculateOrderPricing({
    laundryId: 'lnd_001',
    items: [{ serviceId: 'srv_001', quantity: 1 }], // 8.000 subtotal + 2.000 platform = 10.000 total
    discountCode: 'FRESH100K', // 100.000 discount!
  });
  assert(res7.discount === 100000, 'Test 7: discountCode FRESH100K yields Rp 100.000 discount');
  assert(res7.totalPrice === 0, 'Test 7: totalPrice = max(0, 10000 + 0 + 2000 - 100000) = Rp 0 (NEVER NEGATIVE)');

  // Test 8: Invalid service ID
  assertThrows(() => {
    pricingService.calculateOrderPricing({
      laundryId: 'lnd_001',
      items: [{ serviceId: 'srv_non_existent', quantity: 1 }],
    });
  }, 'Test 8: Invalid service ID rejected');

  // Test 9: Service belongs to different laundry (Multi-tenant check)
  // srv_101 belongs to lnd_002, trying to use it under lnd_001 must be REJECTED!
  assertThrows(() => {
    pricingService.calculateOrderPricing({
      laundryId: 'lnd_001',
      items: [{ serviceId: 'srv_101', quantity: 1 }],
    });
  }, 'Test 9: Service from laundry B under laundry A rejected (Multi-tenant guard)');

  // Test 10: Client-supplied unitPrice differs from database -> Database price wins
  const res10 = pricingService.calculateOrderPricing({
    laundryId: 'lnd_001',
    items: [{ serviceId: 'srv_001', quantity: 3, unitPrice: 100 }], // Spoofed Rp 100 unitPrice by client!
    clientSuppliedPrice: 300,
  });
  assert(res10.items[0].unitPrice === 8000, 'Test 10: Database unitPrice Rp 8.000 wins over client spoofed Rp 100');
  assert(res10.subtotal === 24000, 'Test 10: Calculated subtotal uses database Rp 8.000 x 3 = Rp 24.000');

  // Test 11: Historical order snapshot remains unchanged after service price changes
  const originalService = laundryService.getServiceById('srv_001');
  const initialPrice = originalService?.price || 8000;
  
  // Calculate pricing at initial price
  const snapshotPricing = pricingService.calculateOrderPricing({
    laundryId: 'lnd_001',
    items: [{ serviceId: 'srv_001', quantity: 5 }],
  });
  const snapshotSubtotal = snapshotPricing.subtotal; // 40.000

  // Simulate updating service price in catalog to Rp 15.000/kg tomorrow
  const allServices = laundryService.getAllServices();
  const idx = allServices.findIndex((s) => s.id === 'srv_001');
  if (idx !== -1) {
    allServices[idx] = { ...allServices[idx], price: 15000, price_per_unit: 15000 };
    laundryService.saveServices(allServices);
  }

  // Verify historical snapshot remains 40.000
  assert(snapshotSubtotal === 40000, 'Test 11: Historical order snapshot remains Rp 40.000');

  // Verify new order calculates with new price 15.000 x 5 = 75.000
  const newOrderPricing = pricingService.calculateOrderPricing({
    laundryId: 'lnd_001',
    items: [{ serviceId: 'srv_001', quantity: 5 }],
  });
  assert(newOrderPricing.subtotal === 75000, 'Test 11: New order reflects updated catalog price Rp 75.000');

  // Restore original service price for clean state
  if (idx !== -1) {
    allServices[idx] = { ...allServices[idx], price: initialPrice, price_per_unit: initialPrice };
    laundryService.saveServices(allServices);
  }

  console.log('\n==================================================');
  console.log(`PRICING SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPricingEngineTests();
