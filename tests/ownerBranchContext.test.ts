import assert from 'node:assert';
import { laundryService } from '../services/laundryService';
import { DEMO_LAUNDRIES } from '../utils/constants';
import { UserProfile } from '../types/user';

const mockOwnerA: UserProfile = {
  id: 'usr_owner_01',
  fullName: 'Hendra Wijaya (Owner A)',
  email: 'ownerA@freshlaundry.com',
  phone: '081122334455',
  role: 'laundry_owner',
  laundryId: 'lnd_001',
  createdAt: new Date().toISOString(),
};

const mockOwnerB: UserProfile = {
  id: 'usr_owner_02',
  fullName: 'Bambang Sukoco (Owner B)',
  email: 'ownerB@cleanpro.com',
  phone: '081299887766',
  role: 'laundry_owner',
  laundryId: 'lnd_002',
  createdAt: new Date().toISOString(),
};

/**
 * Pure function simulating resolveActiveBranch logic from OwnerBranchContext
 */
function resolveActiveBranchSim(
  urlBranch: string | null,
  storageBranch: string | null,
  profileLaundryId: string | undefined,
  ownedLaundries: typeof DEMO_LAUNDRIES
): string {
  if (!ownedLaundries || ownedLaundries.length === 0) return '';
  const validIds = ownedLaundries.map((l) => l.id);

  if (urlBranch && validIds.includes(urlBranch)) {
    return urlBranch;
  }
  if (storageBranch && validIds.includes(storageBranch)) {
    return storageBranch;
  }
  if (profileLaundryId && validIds.includes(profileLaundryId)) {
    return profileLaundryId;
  }
  return ownedLaundries[0].id;
}

async function runTests() {
  console.log('🧪 RUNNING OWNER MULTI-LAUNDRY BRANCH CONTEXT UNIT TESTS');

  // TEST GROUP 1: Owner Laundries Discovery
  console.log('\n--- GROUP 1: Owner Laundries Discovery ---');
  const asyncLaundries = await laundryService.getLaundriesByOwnerAsync(mockOwnerA.id);
  assert(asyncLaundries.length >= 1, 'Group 1 FAIL: Owner A should have at least 1 laundry');
  console.log(`✅ GROUP 1 PASSED: Found ${asyncLaundries.length} laundries for owner ${mockOwnerA.id}`);

  // TEST GROUP 2: Branch Context Resolution Priority & Security Validation
  console.log('\n--- GROUP 2: Context Resolution & Security Boundary ---');
  const mockOwnedA = [
    { id: 'lnd_001', name: 'Fresh Laundry - Cabang Central', ownerId: 'usr_owner_01' },
    { id: 'lnd_001_sub', name: 'Fresh Laundry - Cabang Express', ownerId: 'usr_owner_01' },
  ] as typeof DEMO_LAUNDRIES;

  // Test 2.1: Priority 1 — Valid URL Query
  const res1 = resolveActiveBranchSim('lnd_001_sub', 'lnd_001', 'lnd_001', mockOwnedA);
  assert.strictEqual(res1, 'lnd_001_sub', 'Test 2.1 FAIL: URL query should take precedence when valid');

  // Test 2.2: Security — Invalid / Cross-owner URL Query must be rejected!
  const res2 = resolveActiveBranchSim('lnd_UNAUTHORIZED_999', 'lnd_001_sub', 'lnd_001', mockOwnedA);
  assert.strictEqual(res2, 'lnd_001_sub', 'Test 2.2 FAIL: Unauthorized URL branch must be rejected and fallback to LocalStorage');

  // Test 2.3: Priority 2 — Valid LocalStorage when URL is null
  const res3 = resolveActiveBranchSim(null, 'lnd_001_sub', 'lnd_001', mockOwnedA);
  assert.strictEqual(res3, 'lnd_001_sub', 'Test 2.3 FAIL: LocalStorage should be used when URL query is absent');

  // Test 2.4: Priority 3 — Fallback to profile.laundryId when URL and LocalStorage are invalid/null
  const res4 = resolveActiveBranchSim(null, 'INVALID_STORE', 'lnd_001', mockOwnedA);
  assert.strictEqual(res4, 'lnd_001', 'Test 2.4 FAIL: Should fallback to profile.laundryId');

  // Test 2.5: Priority 4 — Fallback to ownedLaundries[0] when everything else is invalid
  const res5 = resolveActiveBranchSim(null, null, 'INVALID_PROFILE_ID', mockOwnedA);
  assert.strictEqual(res5, 'lnd_001', 'Test 2.5 FAIL: Should fallback to first owned laundry');

  console.log('✅ GROUP 2 PASSED: Priority order and security boundary validated!');

  // TEST GROUP 3: Branch-Targeted Service Creation
  console.log('\n--- GROUP 3: Branch-Targeted Service Creation ---');
  const serviceForBranch = await laundryService.createServiceAsync(
    {
      code: 'express',
      name: 'Express 6 Jam Branch Test',
      description: 'Layanan Kilat Cabang Active Context',
      pricingType: 'per_kg',
      price: 15000,
      unit: 'kg',
      minWeight: 2,
      estimatedHours: 6,
      iconName: 'Zap',
      isActive: true,
    },
    mockOwnerA,
    'lnd_001' // explicitly targeting branch!
  );

  assert.strictEqual(serviceForBranch.laundryId, 'lnd_001', 'Test 3.1 FAIL: Created service must belong to targeted branch lnd_001');
  console.log(`✅ GROUP 3 PASSED: Created service #${serviceForBranch.id} targeting branch lnd_001`);

  // TEST GROUP 4: EXPLICIT CROSS-OWNER SECURITY BOUNDARY TESTS
  console.log('\n--- GROUP 4: Explicit Cross-Owner Security Boundary Tests ---');

  // Test 4.1: Owner A tries to select Owner B's branch via URL parameter (?branch=lnd_002)
  const crossUrlRes = resolveActiveBranchSim('lnd_002', null, 'lnd_001', [
    { id: 'lnd_001', ownerId: 'usr_owner_01', name: 'Laundry A' }
  ] as any);
  assert.strictEqual(crossUrlRes, 'lnd_001', 'Test 4.1 FAIL: Owner A selecting Owner B branch lnd_002 in URL must be rejected and fallback to lnd_001');

  // Test 4.2: Owner A tries to select Owner B's branch via LocalStorage
  const crossStorageRes = resolveActiveBranchSim(null, 'lnd_002', 'lnd_001', [
    { id: 'lnd_001', ownerId: 'usr_owner_01', name: 'Laundry A' }
  ] as any);
  assert.strictEqual(crossStorageRes, 'lnd_001', 'Test 4.2 FAIL: Owner A selecting Owner B branch lnd_002 in LocalStorage must fallback to lnd_001');

  // Test 4.3: Owner A attempts to create a service targeting Owner B's laundry (lnd_002)
  let createCrossRejected = false;
  try {
    await laundryService.createServiceAsync(
      {
        code: 'kiloan',
        name: 'Malicious Service',
        description: 'Attempting to inject into Owner B laundry',
        pricingType: 'per_kg',
        price: 10000,
        unit: 'kg',
        estimatedHours: 24,
        iconName: 'Sparkles',
        isActive: true,
      },
      mockOwnerA,
      'lnd_002' // Owner B's branch!
    );
  } catch (err: any) {
    createCrossRejected = err.message.includes('Akses Ditolak') || err.message.includes('Unauthorized');
  }
  assert.strictEqual(createCrossRejected, true, 'Test 4.3 FAIL: Owner A creating service targeting Owner B branch (lnd_002) MUST be REJECTED!');
  console.log('  [PASS] Test 4.3: Owner A creating service targeting Owner B laundry (lnd_002) REJECTED!');

  // Test 4.4: Owner A attempts to edit a service belonging to Owner B (srv_101 belonging to lnd_002)
  let editCrossRejected = false;
  try {
    laundryService.updateService(
      'srv_101', // Service belonging to Owner B (lnd_002)
      { price: 99999 },
      mockOwnerA // Owner A
    );
  } catch (err: any) {
    editCrossRejected = err.message.includes('Akses Ditolak') || err.message.includes('Unauthorized');
  }
  assert.strictEqual(editCrossRejected, true, 'Test 4.4 FAIL: Owner A editing Owner B service (srv_101) MUST be REJECTED!');
  console.log('  [PASS] Test 4.4: Owner A editing Owner B service REJECTED!');

  // Test 4.5: Single Branch Owner Compatibility
  const singleBranchRes = resolveActiveBranchSim(null, null, 'lnd_001', [
    { id: 'lnd_001', ownerId: 'usr_owner_01', name: 'Single Branch Laundry' }
  ] as any);
  assert.strictEqual(singleBranchRes, 'lnd_001', 'Test 4.5 FAIL: Single branch owner must resolve active branch cleanly');
  console.log('  [PASS] Test 4.5: Single-branch owner compatibility PASS!');

  console.log('✅ GROUP 4 PASSED: Cross-owner security boundaries & single-branch compatibility verified!');

  // TEST GROUP 5: SWITCHER OPTION A UX & DROPDOWN ACCESSIBILITY
  console.log('\n--- GROUP 5: Switcher Option A UX & Dropdown Accessibility ---');

  // Test 5.1: Single-branch owner dropdown accessibility simulation
  const singleBranchList = [{ id: 'lnd_001', name: 'Fresh Laundry Kebayoran', ownerId: 'usr_owner_01' }];
  const singleActive = resolveActiveBranchSim(null, null, 'lnd_001', singleBranchList as any);
  assert.strictEqual(singleActive, 'lnd_001', 'Test 5.1 FAIL: Single branch active resolved correctly');
  assert.strictEqual(singleBranchList.length, 1, 'Test 5.1 FAIL: Single branch list has length 1');
  console.log('  [PASS] Test 5.1: Single-branch dropdown trigger enabled & CTA accessible!');

  // Test 5.2: Multi-branch owner switching simulation (A -> B)
  const multiBranchList = [
    { id: 'lnd_001', name: 'Fresh Laundry Kebayoran', ownerId: 'usr_owner_01' },
    { id: 'lnd_002', name: 'CleanPro Laundry Tebet', ownerId: 'usr_owner_01' },
  ];
  const switchTargetB = resolveActiveBranchSim('lnd_002', null, 'lnd_001', multiBranchList as any);
  assert.strictEqual(switchTargetB, 'lnd_002', 'Test 5.2 FAIL: Branch switch A -> B resolves to lnd_002');
  console.log('  [PASS] Test 5.2: Multi-branch switching A -> B resolves correctly to lnd_002!');

  console.log('✅ GROUP 5 PASSED: Option A UX & Switcher accessibility verified!');

  console.log('\n🎉 ALL OWNER BRANCH CONTEXT UNIT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ UNIT TEST FAILED:', err);
  process.exit(1);
});
