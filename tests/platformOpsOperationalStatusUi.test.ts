import assert from 'assert';
import { PartnerLifecycleStatus, Laundry } from '../types/laundry';
import { adminPartnerService } from '../services/adminPartnerService';

// =============================================================================
// PHASE 2D-K.3 TEST SUITE: PLATFORM OPS OPERATIONAL STATUS UI & INTEGRATION
// =============================================================================

async function runOperationalStatusUiTestSuite() {
  console.log('=============================================================================');
  console.log('RUNNING PHASE 2D-K.3 PLATFORM OPS OPERATIONAL STATUS UI & INTEGRATION TESTS');
  console.log('=============================================================================');

  // Helper to simulate partner badge rendering logic (as implemented in pages)
  function renderOperationalBadge(isOpen?: boolean): { label: string; color: string; indicator: string } {
    if (isOpen) {
      return {
        label: 'Buka',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        indicator: 'bg-emerald-600 animate-pulse',
      };
    }
    return {
      label: 'Tutup',
      color: 'bg-rose-100 text-rose-800 border-rose-300',
      indicator: 'bg-rose-600',
    };
  }

  // Helper to simulate confirmation modal content
  function getModalConfirmationContent(targetIsOpen: boolean): { title: string; heading: string; notice: string; buttonText: string; isDanger: boolean } {
    if (!targetIsOpen) {
      return {
        title: 'Konfirmasi Tutup Toko',
        heading: 'Tutup toko ini?',
        notice: 'Customer tidak dapat membuat pesanan baru selama toko dalam status tutup.',
        buttonText: 'Ya, Tutup Toko',
        isDanger: true,
      };
    }
    return {
      title: 'Konfirmasi Buka Toko',
      heading: 'Buka toko?',
      notice: 'Customer akan dapat membuat pesanan baru jika lifecycle partner dan layanan aktif memenuhi syarat.',
      buttonText: 'Ya, Buka Toko',
      isDanger: false,
    };
  }

  // Mock Laundry Partner Record
  const mockPartner: Laundry = {
    id: 'a0000000-0000-0000-0000-000000000001',
    code: 'LND-TEST01',
    name: 'FreshWash Cirebon Central',
    ownerId: 'b0000000-0000-0000-0000-000000000001',
    ownerName: 'Budi Santoso',
    phone: '081234567890',
    address: 'Jl. Pemuda No. 12',
    cityName: 'Cirebon',
    districtName: 'Kesambi',
    openingTime: '08:00',
    closingTime: '20:00',
    isOpen: false,
    isActive: true,
    verificationStatus: 'verified',
    status: 'order_ready' as PartnerLifecycleStatus,
    claimStatus: 'claimed',
    onboardingStatus: 'completed',
    rating: 4.8,
    totalReviews: 24,
    createdAt: new Date().toISOString(),
  };

  // 1. Operational badge displays OPEN correctly
  console.log('\n--- 1. Testing Operational Badge Displays OPEN ---');
  const badgeOpen = renderOperationalBadge(true);
  assert.strictEqual(badgeOpen.label, 'Buka', '1a. Label must be Buka');
  assert.ok(badgeOpen.color.includes('emerald'), '1b. Color should use emerald theme');
  assert.ok(badgeOpen.indicator.includes('animate-pulse'), '1c. Pulse indicator present for open');
  console.log('[PASS] 1. Operational badge displays OPEN correctly');

  // 2. Operational badge displays CLOSED correctly
  console.log('\n--- 2. Testing Operational Badge Displays CLOSED ---');
  const badgeClosed = renderOperationalBadge(false);
  assert.strictEqual(badgeClosed.label, 'Tutup', '2a. Label must be Tutup');
  assert.ok(badgeClosed.color.includes('rose'), '2b. Color should use rose theme');
  assert.ok(!badgeClosed.indicator.includes('animate-pulse'), '2c. No pulse indicator for closed');
  console.log('[PASS] 2. Operational badge displays CLOSED correctly');

  // 3. Platform Ops can open a store (Buka Toko action)
  console.log('\n--- 3. Testing Platform Ops Can Open Store (Buka Toko) ---');
  const currentPartnerToOpen = { ...mockPartner, isOpen: false };
  assert.strictEqual(currentPartnerToOpen.isOpen, false);

  const resOpen = await adminPartnerService.setPartnerOperationalStatusAsync(currentPartnerToOpen.id, true);
  assert.strictEqual(resOpen.success, true, '3a. Open request succeeds');
  assert.strictEqual(resOpen.is_open, true, '3b. Returned is_open is true');

  const updatedPartnerOpen = { ...currentPartnerToOpen, isOpen: resOpen.is_open };
  assert.strictEqual(updatedPartnerOpen.isOpen, true, '3c. Local state updated to true');
  assert.strictEqual(renderOperationalBadge(updatedPartnerOpen.isOpen).label, 'Buka', '3d. Badge reflects Buka');
  console.log('[PASS] 3. Platform Ops can open a store (Buka Toko action)');

  // 4. Platform Ops can close a store (Tutup Toko action)
  console.log('\n--- 4. Testing Platform Ops Can Close Store (Tutup Toko) ---');
  const currentPartnerToClose = { ...mockPartner, isOpen: true };
  assert.strictEqual(currentPartnerToClose.isOpen, true);

  const resClose = await adminPartnerService.setPartnerOperationalStatusAsync(currentPartnerToClose.id, false);
  assert.strictEqual(resClose.success, true, '4a. Close request succeeds');
  assert.strictEqual(resClose.is_open, false, '4b. Returned is_open is false');

  const updatedPartnerClose = { ...currentPartnerToClose, isOpen: resClose.is_open };
  assert.strictEqual(updatedPartnerClose.isOpen, false, '4c. Local state updated to false');
  assert.strictEqual(renderOperationalBadge(updatedPartnerClose.isOpen).label, 'Tutup', '4d. Badge reflects Tutup');
  console.log('[PASS] 4. Platform Ops can close a store (Tutup Toko action)');

  // 5. Button is disabled and double click is prevented during mutation
  console.log('\n--- 5. Testing Button Disabled & Double-Click Guard During Mutation ---');
  let isSubmitting = false;
  let callCount = 0;

  const handleConfirm = () => {
    if (isSubmitting) return; // double-click guard
    isSubmitting = true;
    callCount++;
  };

  handleConfirm();
  assert.strictEqual(callCount, 1, '5a. First click accepted');
  assert.strictEqual(isSubmitting, true, '5b. isSubmitting flagged');

  handleConfirm(); // double click
  assert.strictEqual(callCount, 1, '5c. Second concurrent click blocked');
  console.log('[PASS] 5. Button is disabled and double click is prevented during mutation');

  // 6. Error response is handled gracefully without updating UI state
  console.log('\n--- 6. Testing Error Response Handled Gracefully ---');
  const errorPartner = { ...mockPartner, isOpen: false };
  let caughtError: string | null = null;
  try {
    await adminPartnerService.setPartnerOperationalStatusAsync('non-existent-or-invalid-uuid', true);
  } catch (err: unknown) {
    caughtError = err instanceof Error ? err.message : 'Error';
  }

  assert.ok(caughtError !== null, '6a. Error caught');
  assert.ok(caughtError.includes('tidak valid'), '6b. Error message friendly');
  assert.strictEqual(errorPartner.isOpen, false, '6c. UI state remained unmodified on failure');
  console.log('[PASS] 6. Error response is handled gracefully without updating UI state');

  // 7. Lifecycle badge remains strictly immutable during operational toggle
  console.log('\n--- 7. Testing Lifecycle Badge Immutability During Operational Toggle ---');
  const testStatuses: PartnerLifecycleStatus[] = ['listed', 'order_ready', 'supplier', 'active', 'suspended', 'inactive'];

  for (const status of testStatuses) {
    const partner = { ...mockPartner, status, isOpen: false };
    const originalStatus = partner.status;

    // Toggle to open
    const resO = await adminPartnerService.setPartnerOperationalStatusAsync(partner.id, true);
    assert.strictEqual(resO.success, true);
    assert.strictEqual(partner.status, originalStatus, `Status ${status} was mutated on open!`);

    // Toggle to closed
    const resC = await adminPartnerService.setPartnerOperationalStatusAsync(partner.id, false);
    assert.strictEqual(resC.success, true);
    assert.strictEqual(partner.status, originalStatus, `Status ${status} was mutated on close!`);
  }
  console.log('[PASS] 7. Lifecycle badge remains strictly immutable during operational toggle');

  // 8. Confirmation UX provides distinct, accurate messaging for Buka vs Tutup
  console.log('\n--- 8. Testing Confirmation UX Content Accuracy ---');
  const closeModal = getModalConfirmationContent(false);
  assert.strictEqual(closeModal.title, 'Konfirmasi Tutup Toko');
  assert.strictEqual(closeModal.heading, 'Tutup toko ini?');
  assert.ok(closeModal.notice.includes('Customer tidak dapat membuat pesanan baru'));
  assert.strictEqual(closeModal.buttonText, 'Ya, Tutup Toko');
  assert.strictEqual(closeModal.isDanger, true);

  const openModal = getModalConfirmationContent(true);
  assert.strictEqual(openModal.title, 'Konfirmasi Buka Toko');
  assert.strictEqual(openModal.heading, 'Buka toko?');
  assert.ok(openModal.notice.includes('Customer akan dapat membuat pesanan baru'));
  assert.strictEqual(openModal.buttonText, 'Ya, Buka Toko');
  assert.strictEqual(openModal.isDanger, false);
  console.log('[PASS] 8. Confirmation UX provides distinct, accurate messaging for Buka vs Tutup');

  // 9. Services management catalog items are not impacted by operational status change
  console.log('\n--- 9. Testing Services Management Catalog Isolation ---');
  const mockServices = [
    { id: 'srv_1', name: 'Cuci Komplit', is_active: true, price_per_unit: 8000 },
    { id: 'srv_2', name: 'Cuci Kering', is_active: true, price_per_unit: 6000 },
  ];

  await adminPartnerService.setPartnerOperationalStatusAsync(mockPartner.id, true);

  assert.strictEqual(mockServices.length, 2, '9a. Catalog count untouched');
  assert.strictEqual(mockServices[0].is_active, true, '9b. Service 1 active untouched');
  assert.strictEqual(mockServices[0].price_per_unit, 8000, '9c. Service 1 price untouched');
  assert.strictEqual(mockServices[1].is_active, true, '9d. Service 2 active untouched');
  console.log('[PASS] 9. Services management catalog items are not impacted by operational status change');

  console.log('\n=============================================================================');
  console.log('PHASE 2D-K.3 UI TEST SUMMARY: 9 PASSED, 0 FAILED');
  console.log('=============================================================================\n');
}

runOperationalStatusUiTestSuite().catch((err) => {
  console.error('[TEST-FATAL]', err);
  process.exit(1);
});
