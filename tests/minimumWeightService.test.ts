import assert from 'node:assert';
import { laundryService } from '../services/laundryService';
import { pricingService } from '../services/pricingService';
import { UserProfile } from '../types/user';
import { LaundryService } from '../types/laundry';

const mockOwner: UserProfile = {
  id: 'usr_owner_test',
  fullName: 'Test Owner',
  email: 'owner@test.com',
  phone: '08123456789',
  role: 'laundry_owner',
  laundryId: 'lnd_test_001',
  createdAt: new Date().toISOString(),
};

const basePayload: Omit<LaundryService, 'id' | 'laundryId' | 'createdAt'> = {
  code: 'kiloan',
  name: 'Test Service',
  description: 'Test Description',
  pricingType: 'per_kg',
  price: 7000,
  unit: 'kg',
  minWeight: 3,
  estimatedHours: 24,
  iconName: 'Sparkles',
  isActive: true,
};

async function runTests() {
  console.log('🧪 RUNNING PHASE 7 — OPTIONAL MINIMUM WEIGHT UNIT TESTS');

  // TEST GROUP A: Service Creation & Optional Min Weight Mapping
  console.log('\n--- GROUP A: Service Data Mapping ---');

  // Test A1: Kiloan service with minWeight = 3
  const srvWithMin = laundryService.createService(
    {
      ...basePayload,
      name: 'Cuci Reguler Min 3KG',
      price: 7000,
      unit: 'kg',
      minWeight: 3,
      estimatedHours: 24,
    },
    mockOwner
  );
  assert.strictEqual(srvWithMin.unit, 'kg');
  assert.strictEqual(srvWithMin.minWeight, 3, 'A1 FAIL: minWeight should be 3');

  // Test A2: Kiloan service with minWeight = null / 0 / undefined (No Minimum Order)
  const srvNoMin = laundryService.createService(
    {
      ...basePayload,
      name: 'Cuci Reguler No Min',
      price: 7000,
      unit: 'kg',
      minWeight: null,
      estimatedHours: 24,
    },
    mockOwner
  );
  assert.strictEqual(srvNoMin.unit, 'kg');
  assert.strictEqual(srvNoMin.minWeight, null, 'A2 FAIL: minWeight should be null when optional');

  // Test A3: Satuan service with minWeight = 5 (Should be forced to null!)
  const srvSatuan = laundryService.createService(
    {
      ...basePayload,
      name: 'Cuci Bedcover Satuan',
      price: 35000,
      unit: 'pcs',
      minWeight: 5,
      estimatedHours: 48,
    },
    mockOwner
  );
  assert.strictEqual(srvSatuan.unit, 'pcs');
  assert.strictEqual(srvSatuan.minWeight, null, 'A3 FAIL: pcs service must have minWeight = null');

  console.log('✅ GROUP A PASSED!');

  // TEST GROUP B: Pricing Engine Calculation
  console.log('\n--- GROUP B: Pricing Engine Calculations ---');

  // Test B1: Service with minWeight = 3, customer orders 1 KG -> billable = 3 KG (subtotal = 3 * 7000 = 21000)
  const calcB1 = pricingService.calculateOrderPricing({
    laundryId: 'lnd_test_001',
    items: [{ serviceId: srvWithMin.id, quantity: 1 }],
  });
  assert.strictEqual(calcB1.items[0].minWeight, 3);
  assert.strictEqual(calcB1.items[0].subtotal, 21000, 'B1 FAIL: Subtotal should enforce 3 KG min weight (21,000)');

  // Test B2: Service with minWeight = 3, customer orders 5 KG -> billable = 5 KG (subtotal = 5 * 7000 = 35000)
  const calcB2 = pricingService.calculateOrderPricing({
    laundryId: 'lnd_test_001',
    items: [{ serviceId: srvWithMin.id, quantity: 5 }],
  });
  assert.strictEqual(calcB2.items[0].subtotal, 35000, 'B2 FAIL: Subtotal for 5 KG should be 35,000');

  // Test B3: Service with minWeight = null, customer orders 1 KG -> billable = 1 KG (subtotal = 1 * 7000 = 7000)
  const calcB3 = pricingService.calculateOrderPricing({
    laundryId: 'lnd_test_001',
    items: [{ serviceId: srvNoMin.id, quantity: 1 }],
  });
  assert.strictEqual(calcB3.items[0].minWeight, undefined, 'B3 FAIL: minWeight breakdown should be undefined/null');
  assert.strictEqual(calcB3.items[0].subtotal, 7000, 'B3 FAIL: Subtotal for 1 KG without min weight should be 7,000');

  // Test B4: Satuan service (pcs) -> customer orders 1 pcs -> subtotal = 35,000
  const calcB4 = pricingService.calculateOrderPricing({
    laundryId: 'lnd_test_001',
    items: [{ serviceId: srvSatuan.id, quantity: 1 }],
  });
  assert.strictEqual(calcB4.items[0].minWeight, undefined);
  assert.strictEqual(calcB4.items[0].subtotal, 35000, 'B4 FAIL: Satuan subtotal for 1 pcs should be 35,000');

  console.log('✅ GROUP B PASSED!');

  console.log('\n🎉 ALL PHASE 7 UNIT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ UNIT TEST FAILED:', err);
  process.exit(1);
});
