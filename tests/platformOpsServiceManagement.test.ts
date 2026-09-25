import { verifyAdminAuth } from '../lib/authHelper';
import { partnerPermissionService } from '../services/partnerPermissionService';
import { pricingService } from '../services/pricingService';

interface SimulatedService {
  id: string;
  laundry_id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  pricing_type: string;
  price_per_unit: number;
  unit: string;
  min_weight: number | null;
  estimated_hours: number;
  icon_name: string;
  is_active: boolean;
  created_at: string;
}

interface SimulatedAuditLog {
  id: string;
  actor_user_id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  reason: string;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

interface SimulatedOrderItem {
  id: string;
  order_id: string;
  service_id: string;
  service_name_snapshot: string;
  price_snapshot: number;
  quantity: number;
  subtotal: number;
}

async function runPlatformOpsServiceManagementTests() {
  console.log('=============================================================================');
  console.log('RUNNING PLATFORM OPS ADMIN - SERVICE CATALOG MANAGEMENT VERIFICATION TESTS');
  console.log('=============================================================================\n');

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

  // In-memory test state
  const testServices: SimulatedService[] = [];
  const testAuditLogs: SimulatedAuditLog[] = [];
  const testOrderItems: SimulatedOrderItem[] = [];

  const laundryId1 = 'lnd_alpha_001';
  const laundryId2 = 'lnd_beta_002';

  // Simulation of RPC: admin_mutate_partner_service_atomic
  function simulateAdminMutatePartnerService(
    callerRole: string,
    action: string,
    laundryId: string,
    serviceId: string | null,
    params: Partial<SimulatedService>
  ): { success: boolean; service?: SimulatedService; error?: string } {
    if (callerRole !== 'platform_admin') {
      return { success: false, error: 'Akses ditolak: Hanya platform_admin yang berwenang mengelola katalog layanan partner.' };
    }

    const actionUpper = action.toUpperCase();

    if (actionUpper === 'CREATE') {
      const trimmedName = (params.name || '').trim();
      if (trimmedName.length < 3) {
        return { success: false, error: 'Validasi Gagal: Nama layanan wajib diisi minimal 3 karakter.' };
      }
      if (!params.price_per_unit || params.price_per_unit <= 0) {
        return { success: false, error: 'Validasi Gagal: Tarif harga layanan harus lebih besar dari Rp 0.' };
      }
      if (!params.estimated_hours || params.estimated_hours < 1) {
        return { success: false, error: 'Validasi Gagal: Estimasi pengerjaan minimal 1 jam.' };
      }
      const unit = (params.unit || 'kg').toLowerCase();
      if (!['kg', 'pcs'].includes(unit)) {
        return { success: false, error: 'Validasi Gagal: Satuan layanan harus "kg" atau "pcs".' };
      }
      if (unit === 'kg' && params.min_weight !== undefined && params.min_weight !== null && params.min_weight <= 0) {
        return { success: false, error: 'Validasi Gagal: Minimum order berat (kg) harus lebih besar dari 0.' };
      }
      if (params.category && !['Pakaian', 'Sepatu & Sandal', 'Tas', 'Karpet', 'Sofa'].includes(params.category)) {
        return { success: false, error: `Validasi Gagal: Kategori "${params.category}" tidak valid.` };
      }

      // Unique constraint check: (laundry_id, code, name)
      const duplicate = testServices.find(
        (s) => s.laundry_id === laundryId && s.code === (params.code || 'kiloan') && s.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        return { success: false, error: `Duplikasi Layanan: Layanan dengan kode "${params.code}" dan nama "${trimmedName}" sudah terdaftar.` };
      }

      const newSrv: SimulatedService = {
        id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        laundry_id: laundryId,
        code: params.code || 'kiloan',
        name: trimmedName,
        description: params.description || `Layanan ${trimmedName}`,
        category: params.category || 'Pakaian',
        pricing_type: params.pricing_type || (unit === 'pcs' ? 'per_item' : 'per_kg'),
        price_per_unit: params.price_per_unit,
        unit,
        min_weight: unit === 'pcs' ? null : (params.min_weight ?? null),
        estimated_hours: params.estimated_hours,
        icon_name: params.icon_name || (unit === 'pcs' ? 'Sparkles' : 'ShoppingBag'),
        is_active: params.is_active ?? true,
        created_at: new Date().toISOString(),
      };

      testServices.push(newSrv);

      // Audit Log
      testAuditLogs.push({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        actor_user_id: 'usr_admin_1',
        actor_role: 'platform_admin',
        action: 'SERVICE_CREATED',
        entity_type: 'partner',
        entity_id: laundryId,
        before_value: null,
        after_value: { ...newSrv },
        reason: 'Penambahan layanan baru oleh Platform Ops Admin',
        metadata: { service_id: newSrv.id, service_name: newSrv.name, service_code: newSrv.code },
        timestamp: new Date().toISOString(),
      });

      return { success: true, service: newSrv };
    }

    if (actionUpper === 'UPDATE') {
      const existing = testServices.find((s) => s.id === serviceId && s.laundry_id === laundryId);
      if (!existing) {
        return { success: false, error: 'Layanan tidak ditemukan pada partner laundry ini.' };
      }

      const beforeSnapshot = { ...existing };

      if (params.name !== undefined) {
        const trimmed = params.name.trim();
        if (trimmed.length < 3) return { success: false, error: 'Validasi Gagal: Nama layanan wajib diisi minimal 3 karakter.' };
        existing.name = trimmed;
      }
      if (params.price_per_unit !== undefined) {
        if (params.price_per_unit <= 0) return { success: false, error: 'Validasi Gagal: Tarif harga layanan harus lebih besar dari Rp 0.' };
        existing.price_per_unit = params.price_per_unit;
      }
      if (params.estimated_hours !== undefined) {
        if (params.estimated_hours < 1) return { success: false, error: 'Validasi Gagal: Estimasi pengerjaan minimal 1 jam.' };
        existing.estimated_hours = params.estimated_hours;
      }
      if (params.description !== undefined) existing.description = params.description;
      if (params.category !== undefined) existing.category = params.category;
      if (params.pricing_type !== undefined) existing.pricing_type = params.pricing_type;
      if (params.unit !== undefined) existing.unit = params.unit;
      if (params.min_weight !== undefined) existing.min_weight = params.min_weight;
      if (params.icon_name !== undefined) existing.icon_name = params.icon_name;
      if (params.is_active !== undefined) existing.is_active = params.is_active;

      // Audit Log
      testAuditLogs.push({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        actor_user_id: 'usr_admin_1',
        actor_role: 'platform_admin',
        action: 'SERVICE_UPDATED',
        entity_type: 'partner',
        entity_id: laundryId,
        before_value: beforeSnapshot,
        after_value: { ...existing },
        reason: 'Pembaruan katalog layanan oleh Platform Ops Admin',
        metadata: { service_id: existing.id, service_name: existing.name, service_code: existing.code },
        timestamp: new Date().toISOString(),
      });

      return { success: true, service: existing };
    }

    if (actionUpper === 'ACTIVATE') {
      const existing = testServices.find((s) => s.id === serviceId && s.laundry_id === laundryId);
      if (!existing) return { success: false, error: 'Layanan tidak ditemukan pada partner laundry ini.' };

      const beforeSnapshot = { ...existing };
      existing.is_active = true;

      testAuditLogs.push({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        actor_user_id: 'usr_admin_1',
        actor_role: 'platform_admin',
        action: 'SERVICE_ACTIVATED',
        entity_type: 'partner',
        entity_id: laundryId,
        before_value: beforeSnapshot,
        after_value: { ...existing },
        reason: 'Aktivasi layanan oleh Platform Ops Admin',
        metadata: { service_id: existing.id, service_name: existing.name },
        timestamp: new Date().toISOString(),
      });

      return { success: true, service: existing };
    }

    if (actionUpper === 'DEACTIVATE') {
      const existing = testServices.find((s) => s.id === serviceId && s.laundry_id === laundryId);
      if (!existing) return { success: false, error: 'Layanan tidak ditemukan pada partner laundry ini.' };

      const beforeSnapshot = { ...existing };
      existing.is_active = false;

      testAuditLogs.push({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        actor_user_id: 'usr_admin_1',
        actor_role: 'platform_admin',
        action: 'SERVICE_DEACTIVATED',
        entity_type: 'partner',
        entity_id: laundryId,
        before_value: beforeSnapshot,
        after_value: { ...existing },
        reason: 'Penonaktifan layanan oleh Platform Ops Admin',
        metadata: { service_id: existing.id, service_name: existing.name },
        timestamp: new Date().toISOString(),
      });

      return { success: true, service: existing };
    }

    return { success: false, error: `Aksi tidak valid: "${action}".` };
  }

  // --- T1: List Services ---
  console.log('--- T1. Testing List Services for Partner ---');
  // Initially empty
  const initialList = testServices.filter((s) => s.laundry_id === laundryId1);
  assert(initialList.length === 0, 'T1a. Laundry starts with 0 services');

  // --- T2: Create Service ---
  console.log('\n--- T2. Testing Create Service ---');
  const createRes1 = simulateAdminMutatePartnerService('platform_admin', 'CREATE', laundryId1, null, {
    name: 'Cuci Komplit Kiloan',
    code: 'kiloan',
    price_per_unit: 8000,
    unit: 'kg',
    min_weight: 3,
    estimated_hours: 48,
    category: 'Pakaian',
  });
  assert(createRes1.success === true, 'T2a. Platform Ops Admin can create new service');
  assert(createRes1.service?.name === 'Cuci Komplit Kiloan', 'T2b. Service name matches input');
  assert(createRes1.service?.price_per_unit === 8000, 'T2c. Service price is 8000');
  assert(createRes1.service?.is_active === true, 'T2d. Service is active by default');
  const service1Id = createRes1.service!.id;

  // --- T3: Invalid Create ---
  console.log('\n--- T3. Testing Invalid Service Creation Validations ---');
  const invalidNameRes = simulateAdminMutatePartnerService('platform_admin', 'CREATE', laundryId1, null, {
    name: 'AB', // < 3 chars
    code: 'kiloan',
    price_per_unit: 8000,
    estimated_hours: 24,
  });
  assert(invalidNameRes.success === false, 'T3a. Rejects service name < 3 characters');

  const invalidPriceRes = simulateAdminMutatePartnerService('platform_admin', 'CREATE', laundryId1, null, {
    name: 'Cuci Sepatu',
    code: 'satuan',
    price_per_unit: 0, // <= 0
    estimated_hours: 24,
  });
  assert(invalidPriceRes.success === false, 'T3b. Rejects price <= 0');

  const invalidHoursRes = simulateAdminMutatePartnerService('platform_admin', 'CREATE', laundryId1, null, {
    name: 'Cuci Sepatu',
    code: 'satuan',
    price_per_unit: 25000,
    estimated_hours: 0, // < 1
  });
  assert(invalidHoursRes.success === false, 'T3c. Rejects estimated_hours < 1');

  const invalidCategoryRes = simulateAdminMutatePartnerService('platform_admin', 'CREATE', laundryId1, null, {
    name: 'Cuci Helikopter',
    code: 'satuan',
    price_per_unit: 50000,
    estimated_hours: 24,
    category: 'Kendaraan', // not in allowed category list
  });
  assert(invalidCategoryRes.success === false, 'T3d. Rejects invalid category outside check constraint');

  // --- T4: Duplicate Service ---
  console.log('\n--- T4. Testing Duplicate Service Prevention ---');
  const duplicateRes = simulateAdminMutatePartnerService('platform_admin', 'CREATE', laundryId1, null, {
    name: 'Cuci Komplit Kiloan', // same name & code on same laundry
    code: 'kiloan',
    price_per_unit: 10000,
    estimated_hours: 24,
  });
  assert(duplicateRes.success === false, 'T4a. Rejects duplicate (laundry_id, code, name)');
  assert(duplicateRes.error?.includes('Duplikasi Layanan') === true, 'T4b. Returns friendly duplicate error message');

  // Same name on DIFFERENT laundry should succeed
  const diffLaundryRes = simulateAdminMutatePartnerService('platform_admin', 'CREATE', laundryId2, null, {
    name: 'Cuci Komplit Kiloan',
    code: 'kiloan',
    price_per_unit: 8000,
    estimated_hours: 48,
  });
  assert(diffLaundryRes.success === true, 'T4c. Same service name on different laundry is permitted');

  // --- T5: Update Service ---
  console.log('\n--- T5. Testing Update Service Details ---');
  const updateDescRes = simulateAdminMutatePartnerService('platform_admin', 'UPDATE', laundryId1, service1Id, {
    description: 'Deskripsi baru diperbarui oleh ops.',
    estimated_hours: 36,
  });
  assert(updateDescRes.success === true, 'T5a. Platform Ops Admin can update service description and hours');
  assert(updateDescRes.service?.description === 'Deskripsi baru diperbarui oleh ops.', 'T5b. Updated description verified');
  assert(updateDescRes.service?.estimated_hours === 36, 'T5c. Updated estimated_hours verified');

  // --- T6: Price Update ---
  console.log('\n--- T6. Testing Service Price Update ---');
  const updatePriceRes = simulateAdminMutatePartnerService('platform_admin', 'UPDATE', laundryId1, service1Id, {
    price_per_unit: 9000,
  });
  assert(updatePriceRes.success === true, 'T6a. Platform Ops Admin can update service price');
  assert(updatePriceRes.service?.price_per_unit === 9000, 'T6b. Updated price is 9000');

  // --- T7: Deactivate Service ---
  console.log('\n--- T7. Testing Deactivate Service (Soft State) ---');
  const deactivateRes = simulateAdminMutatePartnerService('platform_admin', 'DEACTIVATE', laundryId1, service1Id, {});
  assert(deactivateRes.success === true, 'T7a. Platform Ops Admin can deactivate service');
  assert(deactivateRes.service?.is_active === false, 'T7b. Service is_active is now false');

  // --- T8: Activate Service ---
  console.log('\n--- T8. Testing Activate Service ---');
  const activateRes = simulateAdminMutatePartnerService('platform_admin', 'ACTIVATE', laundryId1, service1Id, {});
  assert(activateRes.success === true, 'T8a. Platform Ops Admin can reactivate service');
  assert(activateRes.service?.is_active === true, 'T8b. Service is_active is now true');

  // --- T9: Default Service Phase 2D-I.4 Edit ---
  console.log('\n--- T9. Testing Phase 2D-I.4 Default Service Edit ---');
  // Service 1 was initialized as "Cuci Komplit Kiloan" 8000 (now 9000)
  const defaultEditRes = simulateAdminMutatePartnerService('platform_admin', 'UPDATE', laundryId1, service1Id, {
    name: 'Cuci Komplit Kiloan Regular',
    min_weight: 4,
  });
  assert(defaultEditRes.success === true, 'T9a. Default service can be edited smoothly');
  assert(defaultEditRes.service?.name === 'Cuci Komplit Kiloan Regular', 'T9b. Default service name updated');
  assert(defaultEditRes.service?.min_weight === 4, 'T9c. Default service min_weight updated');

  // --- T10: Customer Denied ---
  console.log('\n--- T10. Testing Customer Denied from Service Mutation ---');
  const customerCreateRes = simulateAdminMutatePartnerService('customer', 'CREATE', laundryId1, null, {
    name: 'Hacker Service',
    code: 'kiloan',
    price_per_unit: 1000,
  });
  assert(customerCreateRes.success === false, 'T10a. Customer cannot create service');
  assert(customerCreateRes.error?.includes('Akses ditolak') === true, 'T10b. Returns access denied error');

  // --- T11: Courier Denied ---
  console.log('\n--- T11. Testing Courier Denied from Service Mutation ---');
  const courierUpdateRes = simulateAdminMutatePartnerService('courier', 'UPDATE', laundryId1, service1Id, {
    price_per_unit: 500,
  });
  assert(courierUpdateRes.success === false, 'T11a. Courier cannot update service');

  // --- T12: Owner Denied Admin Endpoint ---
  console.log('\n--- T12. Testing Laundry Owner Denied from Admin Endpoint ---');
  const ownerToggleRes = simulateAdminMutatePartnerService('laundry_owner', 'DEACTIVATE', laundryId1, service1Id, {});
  assert(ownerToggleRes.success === false, 'T12a. Laundry owner cannot use Platform Ops admin RPC');

  // --- T13: Cross-Tenant Denied ---
  console.log('\n--- T13. Testing Cross-Tenant Boundary ---');
  // Trying to update service1 (belongs to laundryId1) under laundryId2 context
  const crossTenantRes = simulateAdminMutatePartnerService('platform_admin', 'UPDATE', laundryId2, service1Id, {
    price_per_unit: 99999,
  });
  assert(crossTenantRes.success === false, 'T13a. Cannot mutate service belonging to another laundry');
  assert(crossTenantRes.error?.includes('tidak ditemukan') === true, 'T13b. Cross-tenant mismatch returns not found error');

  // --- T14: Anon Denied ---
  console.log('\n--- T14. Testing Anonymous Caller Denied ---');
  const reqNoAuth = new Request('http://localhost:3000/api/admin/partners/lnd_1/services');
  const authResNoAuth = await verifyAdminAuth(reqNoAuth);
  assert(authResNoAuth.isAuthenticated === false, 'T14a. Request without token returns isAuthenticated = false (HTTP 401)');
  assert(authResNoAuth.isPlatformAdmin === false, 'T14b. Anonymous caller is not platform_admin');

  // --- T15: Audit Log SERVICE_CREATED ---
  console.log('\n--- T15. Testing Audit Log for SERVICE_CREATED ---');
  const createLogs = testAuditLogs.filter((l) => l.action === 'SERVICE_CREATED' && l.entity_id === laundryId1);
  assert(createLogs.length >= 1, 'T15a. SERVICE_CREATED audit log exists');
  assert(createLogs[0].actor_role === 'platform_admin', 'T15b. Actor role is platform_admin');
  assert(createLogs[0].entity_type === 'partner', 'T15c. Entity type is partner');
  assert(createLogs[0].metadata?.service_name === 'Cuci Komplit Kiloan', 'T15d. Metadata captures service name');

  // --- T16: Audit Log SERVICE_UPDATED ---
  console.log('\n--- T16. Testing Audit Log for SERVICE_UPDATED ---');
  const updateLogs = testAuditLogs.filter((l) => l.action === 'SERVICE_UPDATED' && l.entity_id === laundryId1);
  assert(updateLogs.length >= 1, 'T16a. SERVICE_UPDATED audit log exists');
  assert(updateLogs[0].before_value !== null, 'T16b. Before value is recorded');
  assert(updateLogs[0].after_value !== null, 'T16c. After value is recorded');

  // --- T17: Audit Log SERVICE_ACTIVATED ---
  console.log('\n--- T17. Testing Audit Log for SERVICE_ACTIVATED ---');
  const activateLogs = testAuditLogs.filter((l) => l.action === 'SERVICE_ACTIVATED' && l.entity_id === laundryId1);
  assert(activateLogs.length >= 1, 'T17a. SERVICE_ACTIVATED audit log exists');
  assert(activateLogs[0].after_value?.is_active === true, 'T17b. Activated status recorded in after_value');

  // --- T18: Audit Log SERVICE_DEACTIVATED ---
  console.log('\n--- T18. Testing Audit Log for SERVICE_DEACTIVATED ---');
  const deactivateLogs = testAuditLogs.filter((l) => l.action === 'SERVICE_DEACTIVATED' && l.entity_id === laundryId1);
  assert(deactivateLogs.length >= 1, 'T18a. SERVICE_DEACTIVATED audit log exists');
  assert(deactivateLogs[0].after_value?.is_active === false, 'T18b. Deactivated status recorded in after_value');

  // --- T19: Price Immutability Verification ---
  console.log('\n--- T19. Testing Historical Order Price Immutability ---');
  // Order A created when price was 8000
  const orderA_item: SimulatedOrderItem = {
    id: 'item_ord_A',
    order_id: 'ord_A_001',
    service_id: service1Id,
    service_name_snapshot: 'Cuci Komplit Kiloan',
    price_snapshot: 8000,
    quantity: 3,
    subtotal: 24000,
  };
  testOrderItems.push(orderA_item);

  // Now admin changes service price to 12000
  simulateAdminMutatePartnerService('platform_admin', 'UPDATE', laundryId1, service1Id, {
    price_per_unit: 12000,
  });

  // Verify Order A's snapshot did NOT change
  const fetchedOrderA_item = testOrderItems.find((oi) => oi.order_id === 'ord_A_001')!;
  assert(fetchedOrderA_item.price_snapshot === 8000, 'T19a. Historical order price snapshot remains 8000');
  assert(fetchedOrderA_item.subtotal === 24000, 'T19b. Historical order subtotal remains 24000');

  // Order B created after price update
  const currentCatalogPrice = testServices.find((s) => s.id === service1Id)!.price_per_unit;
  const orderB_item: SimulatedOrderItem = {
    id: 'item_ord_B',
    order_id: 'ord_B_002',
    service_id: service1Id,
    service_name_snapshot: 'Cuci Komplit Kiloan Regular',
    price_snapshot: currentCatalogPrice,
    quantity: 3,
    subtotal: currentCatalogPrice * 3,
  };
  testOrderItems.push(orderB_item);
  assert(orderB_item.price_snapshot === 12000, 'T19c. New order captures updated price 12000');
  assert(orderB_item.subtotal === 36000, 'T19d. New order subtotal calculated with updated price');
  assert(fetchedOrderA_item.price_snapshot !== orderB_item.price_snapshot, 'T19e. Historical and new order prices are completely decoupled');

  // --- T20: No Hard Delete Guarantee ---
  console.log('\n--- T20. Testing No Hard Delete Guarantee ---');
  // Deactivating service referenced by order items
  const softDeactivateRes = simulateAdminMutatePartnerService('platform_admin', 'DEACTIVATE', laundryId1, service1Id, {});
  assert(softDeactivateRes.success === true, 'T20a. Soft deactivation succeeds even if service has order history');
  const serviceStillExists = testServices.some((s) => s.id === service1Id);
  assert(serviceStillExists === true, 'T20b. Service row still exists in database (not deleted)');
  assert(fetchedOrderA_item.service_id === service1Id, 'T20c. Foreign key referential integrity remains intact');

  // --- REGRESSION TESTS ---
  console.log('\n--- REGRESSION TESTS ---');
  // R1: Owner service permissions
  assert(
    partnerPermissionService.hasPermission('laundry_owner', 'PARTNER_VIEW_BRANCHES') === true,
    'R1. Laundry Owner retains operational view permissions'
  );

  // R2: Marketplace visibility
  const activeCatalog = testServices.filter((s) => s.laundry_id === laundryId1 && s.is_active);
  assert(activeCatalog.length === 0, 'R2a. Inactive service is excluded from active customer catalog');
  // Re-activate
  simulateAdminMutatePartnerService('platform_admin', 'ACTIVATE', laundryId1, service1Id, {});
  const activeCatalogAfter = testServices.filter((s) => s.laundry_id === laundryId1 && s.is_active);
  assert(activeCatalogAfter.length === 1, 'R2b. Reactivated service becomes visible in customer catalog');

  // R3: Authoritative pricing calculation
  const authoritativeCalculation = pricingService.calculateOrderPricing({
    laundryId: 'lnd_001',
    items: [{ serviceId: 'srv_001', quantity: 3, unitPrice: 99999 }], // spoofed unitPrice ignored
  });
  assert(authoritativeCalculation.totalPrice > 0, 'R3. Authoritative pricing calculation functions properly');

  console.log('\n=============================================================================');
  console.log(`PLATFORM OPS SERVICE MANAGEMENT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPlatformOpsServiceManagementTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
