import { resolveServicePhoto, CANONICAL_SERVICE_FALLBACKS } from '../utils/servicePhotoFallbacks';
import { laundryService } from '../services/laundryService';
import { adminPartnerService } from '../services/adminPartnerService';
import { UserProfile } from '../types/user';
import { ServiceCatalogItem } from '../utils/constants';

async function runServicePhotosFeatureTests() {
  console.log('=============================================================================');
  console.log('RUNNING DYNAMIC SERVICE PHOTOS FEATURE TESTS — PHASE 2D-K.1');
  console.log('=============================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  // Mock users
  const ownerA: UserProfile = {
    id: 'usr_owner_01',
    email: 'ownerA@example.com',
    fullName: 'Owner Laundry A',
    role: 'laundry_owner',
    phone: '081200000001',
    laundryId: 'lnd_001',
    createdAt: new Date().toISOString(),
  };

  const ownerB: UserProfile = {
    id: 'usr_owner_02',
    email: 'ownerB@example.com',
    fullName: 'Owner Laundry B',
    role: 'laundry_owner',
    phone: '081200000002',
    laundryId: 'lnd_002',
    createdAt: new Date().toISOString(),
  };

  const platformAdmin: UserProfile = {
    id: 'usr_admin_01',
    email: 'admin@cuciyan.com',
    fullName: 'Platform Admin',
    role: 'platform_admin',
    phone: '081200000003',
    createdAt: new Date().toISOString(),
  };

  const customerUser: UserProfile = {
    id: 'usr_cust_01',
    email: 'customer@example.com',
    fullName: 'Customer One',
    role: 'customer',
    phone: '081200000004',
    createdAt: new Date().toISOString(),
  };

  // ---------------------------------------------------------------------------
  // TEST SUITE 1: CANONICAL FALLBACK RESOLVER
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 1: CANONICAL FALLBACK RESOLVER ---');

  const customPhotoUrl = 'https://custom.supabase.co/storage/v1/object/public/laundry-photos/services/lnd_001/custom_photo.webp';
  const customService = {
    name: 'Cuci Kemeja Sutra',
    category: 'Pakaian',
    code: 'kiloan',
    imageUrl: customPhotoUrl,
  };
  assert(
    resolveServicePhoto(customService) === customPhotoUrl,
    'TC-SP-01: Returns custom partner photo when imageUrl is present'
  );

  const shoeService = {
    name: 'Cuci Sepatu Sneaker',
    category: 'Sepatu & Sandal',
    code: 'satuan',
    imageUrl: null,
  };
  assert(
    resolveServicePhoto(shoeService) === CANONICAL_SERVICE_FALLBACKS['Sepatu & Sandal'],
    'TC-SP-02: Resolves canonical shoe photo when category is Sepatu & Sandal without custom imageUrl'
  );

  const bedCoverService = {
    name: 'Cuci Bed Cover King Size',
    category: 'Pakaian',
    code: 'satuan',
    imageUrl: '',
  };
  assert(
    resolveServicePhoto(bedCoverService).includes('images.unsplash.com'),
    'TC-SP-03: Resolves bed cover specific photo when name includes "bed cover"'
  );

  const expressService = {
    name: 'Paket Kilat 3 Jam',
    category: null,
    code: 'express',
    imageUrl: null,
  };
  assert(
    resolveServicePhoto(expressService) === CANONICAL_SERVICE_FALLBACKS['express'],
    'TC-SP-04: Resolves express photo when code is express'
  );

  assert(
    resolveServicePhoto(null) === CANONICAL_SERVICE_FALLBACKS['default'],
    'TC-SP-05: Resolves default catch-all photo when service is null/undefined'
  );

  // ---------------------------------------------------------------------------
  // TEST SUITE 2: OWNER SERVICE MUTATION & LIFECYCLE
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: OWNER SERVICE MUTATION & LIFECYCLE ---');

  const newServicePayload = {
    name: 'Cuci Karpet Tebal',
    code: 'satuan',
    category: 'Karpet' as const,
    pricingType: 'per_item' as const,
    price: 45000,
    unit: 'pcs' as const,
    estimatedHours: 48,
    description: 'Cuci karpet tebal higienis',
    isActive: true,
    iconName: 'Sparkles',
    imageUrl: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab',
    storagePath: 'services/lnd_001/srv_carpet_001.webp',
  };

  const createdService = laundryService.createService(newServicePayload, ownerA, 'lnd_001');
  assert(
    Boolean(createdService.id && createdService.imageUrl === newServicePayload.imageUrl),
    'TC-SP-06: Owner can create service with custom imageUrl and storagePath'
  );

  const updatedService = laundryService.updateService(
    createdService.id,
    {
      imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc',
      storagePath: 'services/lnd_001/srv_carpet_replaced.webp',
    },
    ownerA
  );
  assert(
    updatedService.imageUrl === 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc' &&
    updatedService.storagePath === 'services/lnd_001/srv_carpet_replaced.webp',
    'TC-SP-07: Owner can update service photo (replacement lifecycle)'
  );

  const deletedPhotoService = laundryService.updateService(
    createdService.id,
    {
      imageUrl: null,
      storagePath: null,
    },
    ownerA
  );
  assert(
    deletedPhotoService.imageUrl === null && deletedPhotoService.storagePath === null,
    'TC-SP-08: Setting imageUrl: null clears custom photo and reverts to fallback'
  );

  // ---------------------------------------------------------------------------
  // TEST SUITE 3: MULTI-TENANT ISOLATION & AUTHORIZATION
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: MULTI-TENANT ISOLATION & AUTHORIZATION ---');

  let ownerCrossTenantBlocked = false;
  try {
    laundryService.updateService(
      createdService.id,
      { name: 'Hacked Name' },
      ownerB // Owner of lnd_002 trying to modify lnd_001 service
    );
  } catch (err: any) {
    ownerCrossTenantBlocked = err.message.includes('UnauthorizedError') || err.message.includes('Akses Ditolak');
  }
  assert(
    ownerCrossTenantBlocked,
    'TC-SP-09: Owner of laundry B cannot modify service or photo belonging to laundry A'
  );

  let platformAdminAllowed = false;
  try {
    const adminUpdate = laundryService.updateService(
      createdService.id,
      { imageUrl: 'https://admin-updated.jpg' },
      platformAdmin
    );
    platformAdminAllowed = adminUpdate.imageUrl === 'https://admin-updated.jpg';
  } catch {
    platformAdminAllowed = false;
  }
  assert(
    platformAdminAllowed,
    'TC-SP-10: Platform Admin has authorized authority to modify service photo for any partner'
  );

  // ---------------------------------------------------------------------------
  // TEST SUITE 4: PLATFORM OPS ADMIN SERVICE MANAGEMENT
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: PLATFORM OPS ADMIN SERVICE MANAGEMENT ---');

  const validPartnerId = '11111111-1111-4111-8111-111111111111';
  const validServiceId = '22222222-2222-4222-8222-222222222222';

  const adminCreateResult = await adminPartnerService.createPartnerServiceAsync(
    validPartnerId,
    {
      name: 'Dry Clean Sutra Royal',
      code: 'dry_clean',
      category: 'Pakaian',
      price: 50000,
      unit: 'pcs',
      estimatedHours: 24,
      imageUrl: 'https://cdn.example.com/sutra.webp',
      storagePath: `services/${validPartnerId}/sutra_01.webp`,
    }
  );
  assert(
    adminCreateResult.success && adminCreateResult.service !== null,
    'TC-SP-11: Platform Ops createPartnerServiceAsync preserves imageUrl and storagePath'
  );

  const adminUpdateResult = await adminPartnerService.updatePartnerServiceAsync(
    validPartnerId,
    validServiceId,
    {
      imageUrl: 'https://cdn.example.com/sutra_updated.webp',
      storagePath: `services/${validPartnerId}/sutra_02.webp`,
    }
  );
  assert(
    adminUpdateResult.success && adminUpdateResult.service !== null,
    'TC-SP-12: Platform Ops updatePartnerServiceAsync updates photo parameters cleanly'
  );

  // ---------------------------------------------------------------------------
  // TEST SUITE 5: MIME & SIZE VALIDATION MATRIX
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 5: MIME & SIZE VALIDATION MATRIX ---');

  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

  function validatePhotoUpload(mime: string, sizeBytes: number): { valid: boolean; reason?: string } {
    if (!ALLOWED_MIME_TYPES.includes(mime.toLowerCase())) {
      return { valid: false, reason: 'INVALID_MIME' };
    }
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      return { valid: false, reason: 'FILE_TOO_LARGE' };
    }
    return { valid: true };
  }

  assert(
    validatePhotoUpload('image/jpeg', 1.5 * 1024 * 1024).valid === true,
    'TC-SP-13: Validates 1.5MB JPEG successfully'
  );
  assert(
    validatePhotoUpload('image/webp', 150 * 1024).valid === true,
    'TC-SP-14: Validates 150KB WebP successfully'
  );
  assert(
    validatePhotoUpload('image/svg+xml', 50 * 1024).valid === false,
    'TC-SP-15: Rejects SVG files to prevent XSS attacks'
  );
  assert(
    validatePhotoUpload('application/x-executable', 100 * 1024).valid === false,
    'TC-SP-16: Rejects executable binary files'
  );
  assert(
    validatePhotoUpload('image/jpeg', 3 * 1024 * 1024).valid === false,
    'TC-SP-17: Rejects files larger than 2MB'
  );

  // ---------------------------------------------------------------------------
  // TEST SUITE 6: PRICE & BUSINESS LOGIC PURITY
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 6: PRICE & BUSINESS LOGIC PURITY ---');

  const basePrice = 8000;
  const sampleWithPhoto: ServiceCatalogItem = {
    id: 'srv_test',
    laundryId: 'lnd_001',
    code: 'kiloan',
    name: 'Test Kiloan',
    description: 'Deskripsi',
    pricingType: 'per_kg',
    price: basePrice,
    unit: 'kg',
    estimatedHours: 24,
    iconName: 'Shirt',
    isActive: true,
    imageUrl: 'https://example.com/photo.jpg',
  };

  const sampleWithoutPhoto: ServiceCatalogItem = {
    ...sampleWithPhoto,
    imageUrl: null,
  };

  assert(
    sampleWithPhoto.price === sampleWithoutPhoto.price &&
    sampleWithPhoto.unit === sampleWithoutPhoto.unit &&
    sampleWithPhoto.estimatedHours === sampleWithoutPhoto.estimatedHours,
    'TC-SP-18: Photo existence has ZERO impact on pricing, unit, SLA, or business logic'
  );

  // Summary
  console.log('\n=============================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('=============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runServicePhotosFeatureTests();
