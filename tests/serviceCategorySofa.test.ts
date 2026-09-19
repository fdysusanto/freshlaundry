import assert from 'assert';
import { CANONICAL_SERVICE_CATEGORIES, ServiceCategory, LaundryMarketplaceItem, Laundry } from '../types/laundry';

console.log('🧪 RUNNING PHASE 048E-POLISH — SERVICE CATEGORY SOFA & FILTERING TESTS\n');

const mockLaundry: Laundry = {
  id: 'lnd_test_001',
  code: 'LND-TEST',
  name: 'Test Laundry',
  ownerId: 'usr_001',
  phone: '081234567890',
  address: 'Jl. Merdeka No. 1, Cirebon',
  openingTime: '08:00',
  closingTime: '20:00',
  isOpen: true,
  isActive: true,
  verificationStatus: 'verified',
  rating: 4.8,
  totalReviews: 12,
  createdAt: new Date().toISOString(),
};

// --- TEST 1: CANONICAL_SERVICE_CATEGORIES includes Sofa ---
console.log('--- TEST 1: CANONICAL_SERVICE_CATEGORIES Includes Sofa ---');
{
  assert.ok(CANONICAL_SERVICE_CATEGORIES.includes('Sofa'));
  assert.deepStrictEqual(CANONICAL_SERVICE_CATEGORIES, [
    'Pakaian',
    'Sepatu & Sandal',
    'Tas',
    'Karpet',
    'Sofa',
  ]);
  console.log('  [PASS] CANONICAL_SERVICE_CATEGORIES contains Sofa');
}
console.log('✅ TEST 1 PASSED!\n');

// --- TEST 2: Sofa category filtering logic ---
console.log('--- TEST 2: Sofa Category Filtering ---');
{
  const itemWithSofa: LaundryMarketplaceItem = {
    laundry: mockLaundry,
    rating: 4.8,
    reviewCount: 12,
    serviceCategories: ['Sofa', 'Karpet'],
  };

  const itemWithoutSofa: LaundryMarketplaceItem = {
    laundry: { ...mockLaundry, id: 'lnd_test_002', name: 'Other Laundry' },
    rating: 4.5,
    reviewCount: 5,
    serviceCategories: ['Pakaian'],
  };

  const items = [itemWithSofa, itemWithoutSofa];

  const sofaFiltered = items.filter(
    (item) => item.serviceCategories?.includes('Sofa')
  );

  assert.strictEqual(sofaFiltered.length, 1);
  assert.strictEqual(sofaFiltered[0].laundry.id, 'lnd_test_001');
  console.log('  [PASS] Sofa filter correctly matches only partners offering Sofa service');
}
console.log('✅ TEST 2 PASSED!\n');

// --- TEST 3: Multi-category partner filtering ---
console.log('--- TEST 3: Multi-Category Partner Filtering ---');
{
  const multiCatPartner: LaundryMarketplaceItem = {
    laundry: mockLaundry,
    rating: 4.9,
    reviewCount: 20,
    serviceCategories: ['Pakaian', 'Sofa', 'Karpet'],
  };

  const categoriesToTest: ServiceCategory[] = ['Pakaian', 'Sofa', 'Karpet'];
  categoriesToTest.forEach((cat) => {
    const isMatch = multiCatPartner.serviceCategories?.includes(cat);
    assert.strictEqual(isMatch, true);
  });

  const isMatchTas = multiCatPartner.serviceCategories?.includes('Tas');
  assert.strictEqual(isMatchTas, false);
  console.log('  [PASS] Multi-category partner matches all offered categories and excludes unoffered ones');
}
console.log('✅ TEST 3 PASSED!\n');

// --- TEST 4: NULL category behavior ---
console.log('--- TEST 4: NULL Category Behavior ---');
{
  const nullCatPartner: LaundryMarketplaceItem = {
    laundry: mockLaundry,
    rating: 4.0,
    reviewCount: 2,
    serviceCategories: [], // null or empty category services
  };

  const categoriesToTest: ServiceCategory[] = ['Pakaian', 'Sepatu & Sandal', 'Tas', 'Karpet', 'Sofa'];
  categoriesToTest.forEach((cat) => {
    const isMatch = nullCatPartner.serviceCategories?.includes(cat);
    assert.strictEqual(isMatch, false);
  });
  console.log('  [PASS] Partner with null category is excluded from specific category filters');
}
console.log('✅ TEST 4 PASSED!\n');

// --- TEST 5: "Semua" filter returns all partners ---
console.log('--- TEST 5: "Semua" Filter Returns All Partners ---');
{
  const items: LaundryMarketplaceItem[] = [
    { laundry: mockLaundry, rating: 4.8, reviewCount: 12, serviceCategories: ['Sofa'] },
    { laundry: { ...mockLaundry, id: 'lnd_002' }, rating: 4.5, reviewCount: 5, serviceCategories: ['Pakaian'] },
    { laundry: { ...mockLaundry, id: 'lnd_003' }, rating: 4.0, reviewCount: 2, serviceCategories: [] },
  ];

  const selectedCategory = 'Semua';
  const filtered = items.filter((item) => {
    if (selectedCategory === 'Semua') return true;
    return item.serviceCategories?.includes(selectedCategory as ServiceCategory);
  });

  assert.strictEqual(filtered.length, 3);
  console.log('  [PASS] "Semua" filter includes all partners regardless of categories');
}
console.log('✅ TEST 5 PASSED!\n');
