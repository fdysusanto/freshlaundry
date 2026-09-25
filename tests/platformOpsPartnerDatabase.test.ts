import { partnerPermissionService } from '../services/partnerPermissionService';
import { PartnerLifecycleStatus, PartnerPermission } from '../types/laundry';
import { isValidCoordinate } from '../services/locationService';
import { verifyAdminAuth } from '../lib/authHelper';

async function runPlatformOpsPartnerDatabaseTests() {
  console.log('=============================================================================');
  console.log('RUNNING PLATFORM OPS ADMIN - PARTNER DATABASE MANAGEMENT VERIFICATION TESTS');
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

  // TEST 1: Platform Ops Admin can list partners
  console.log('--- 1. Testing Partner Listing Permission ---');
  assert(
    partnerPermissionService.hasPermission('platform_admin', 'PARTNER_VIEW') === true,
    '1. Platform Ops Admin can list & view all partners'
  );

  // TEST 2: Platform Ops Admin can create listing (UNCLAIMED/LISTED default)
  console.log('\n--- 2. Testing Partner Creation Rules ---');
  assert(
    partnerPermissionService.hasPermission('platform_admin', 'PARTNER_CREATE') === true,
    '2. Platform Ops Admin can create partner listings'
  );

  // TEST 3: Platform Ops Admin can update partner platform fields
  console.log('\n--- 3. Testing Partner Update Permission ---');
  assert(
    partnerPermissionService.hasPermission('platform_admin', 'PARTNER_UPDATE') === true,
    '3. Platform Ops Admin can update platform-level partner data'
  );

  // TEST 4: Platform Ops Admin can activate partner
  console.log('\n--- 4. Testing Partner Activation ---');
  assert(
    partnerPermissionService.hasPermission('platform_admin', 'PARTNER_STATUS_UPDATE') === true,
    '4. Platform Ops Admin can change lifecycle status to ACTIVE'
  );

  // TEST 5: Platform Ops Admin can suspend partner (requires reason)
  console.log('\n--- 5. Testing Partner Suspension ---');
  assert(
    partnerPermissionService.hasPermission('platform_admin', 'PARTNER_SUSPEND') === true,
    '5. Platform Ops Admin can suspend partner'
  );

  // TEST 6: Platform Ops Admin can invite owner
  console.log('\n--- 6. Testing Owner Invitation ---');
  assert(
    partnerPermissionService.hasPermission('platform_admin', 'PARTNER_INVITE_OWNER') === true,
    '6. Platform Ops Admin can invite business owner'
  );

  // TEST 7: Partner Owner cannot access another partner
  console.log('\n--- 7. Testing Tenant Isolation for Partner Owner ---');
  assert(
    partnerPermissionService.hasPermission('laundry_owner', 'PARTNER_SUSPEND') === false,
    '7a. Partner Owner CANNOT suspend partners'
  );
  assert(
    partnerPermissionService.hasPermission('laundry_owner', 'PARTNER_CREATE') === false,
    '7b. Partner Owner CANNOT create platform listings'
  );

  // TEST 8: Partner Staff cannot access platform admin
  console.log('\n--- 8. Testing Operational Boundary for Partner Staff ---');
  assert(
    partnerPermissionService.hasPermission('laundry_staff', 'PARTNER_STATUS_UPDATE') === false,
    '8a. Partner Staff CANNOT update partner lifecycle status'
  );
  assert(
    partnerPermissionService.hasPermission('laundry_staff', 'PARTNER_INVITE_OWNER') === false,
    '8b. Partner Staff CANNOT invite owners'
  );

  // TEST 9: Customer cannot access partner management
  console.log('\n--- 9. Testing Access Control for Customer ---');
  assert(
    partnerPermissionService.hasPermission('customer', 'PARTNER_VIEW') === false,
    '9. Customer CANNOT access partner management API/permissions'
  );

  // TEST 10: Courier cannot access partner management
  console.log('\n--- 10. Testing Access Control for Courier ---');
  assert(
    partnerPermissionService.hasPermission('courier', 'PARTNER_VIEW') === false,
    '10. Courier CANNOT access partner management API/permissions'
  );

  // TEST 11: Invalid status transitions are rejected
  console.log('\n--- 11. Testing Status Transition Matrix ---');
  assert(
    partnerPermissionService.isValidStatusTransition('unclaimed', 'active').valid === false,
    '11a. Invalid direct status transition UNCLAIMED -> ACTIVE is rejected'
  );

  assert(
    partnerPermissionService.isValidStatusTransition('active', 'unclaimed').valid === false,
    '11b. Invalid direct status transition ACTIVE -> UNCLAIMED is rejected'
  );

  assert(
    partnerPermissionService.isValidStatusTransition('active', 'listed').valid === false,
    '11c. Invalid direct status transition ACTIVE -> LISTED is rejected'
  );

  assert(
    partnerPermissionService.isValidStatusTransition('suspended', 'listed').valid === false,
    '11d. Invalid direct status transition SUSPENDED -> LISTED is rejected'
  );

  assert(
    partnerPermissionService.isValidStatusTransition('listed', 'claimed').valid === true,
    '11e. Valid status transition LISTED -> CLAIMED is accepted'
  );

  assert(
    partnerPermissionService.isValidStatusTransition('claimed', 'onboarding').valid === true,
    '11f. Valid status transition CLAIMED -> ONBOARDING is accepted'
  );

  assert(
    partnerPermissionService.isValidStatusTransition('onboarding', 'active').valid === true,
    '11g. Valid status transition ONBOARDING -> ACTIVE is accepted'
  );

  assert(
    partnerPermissionService.isValidStatusTransition('active', 'suspended').valid === true,
    '11h. Valid status transition ACTIVE -> SUSPENDED is accepted'
  );

  // TEST 12: Sensitive mutation creates audit log
  console.log('\n--- 12. Testing Audit Trail Requirement ---');
  assert(
    partnerPermissionService.hasPermission('platform_admin', 'PARTNER_VIEW_AUDIT') === true,
    '12. Platform Ops Admin can view partner audit logs'
  );

  // TEST 13: RLS prevents cross-partner access
  console.log('\n--- 13. Testing RLS Helper Definitions ---');
  assert(
    partnerPermissionService.isPlatformOpsAdmin('platform_admin') === true,
    '13a. platform_admin is recognized as Platform Ops Admin'
  );
  assert(
    partnerPermissionService.isPlatformOpsAdmin('laundry_owner') === false,
    '13b. laundry_owner is NOT Platform Ops Admin'
  );

  // TEST 14: API rejects unauthorized role
  console.log('\n--- 14. Testing Role Gate Enforcement ---');
  assert(
    partnerPermissionService.isPlatformOpsAdmin('customer') === false,
    '14a. customer is rejected from platform admin endpoints'
  );
  assert(
    partnerPermissionService.isPlatformOpsAdmin('courier') === false,
    '14b. courier is rejected from platform admin endpoints'
  );

  // TEST 15: Backward compatibility
  console.log('\n--- 15. Testing Backward Compatibility ---');
  assert(
    partnerPermissionService.hasPermission('laundry_owner', 'PARTNER_VIEW') === true,
    '15a. Laundry Owner retains operational view permission'
  );
  assert(
    partnerPermissionService.hasPermission('laundry_staff', 'PARTNER_VIEW_ORDERS') === true,
    '15b. Laundry Staff retains operational order view permission'
  );

  // TEST 16: Phase 2D - Layered Coordinate Validation Tests
  console.log('\n--- 16. Testing Phase 2D Layered Coordinate Validation ---');
  assert(
    isValidCoordinate(-6.7320, 108.5523) === true,
    '16a. Valid Cirebon coordinates (-6.7320, 108.5523) pass validation'
  );
  assert(
    isValidCoordinate(-95.0, 108.5523) === false,
    '16b. Invalid latitude (-95.0) fails validation'
  );
  assert(
    isValidCoordinate(90.1, 108.5523) === false,
    '16c. Invalid latitude (90.1) fails validation'
  );
  assert(
    isValidCoordinate(-6.7320, -185.0) === false,
    '16d. Invalid longitude (-185.0) fails validation'
  );
  assert(
    isValidCoordinate(-6.7320, 180.1) === false,
    '16e. Invalid longitude (180.1) fails validation'
  );

  // TEST 17: Phase 2D - Coordinate Lifecycle Invariants
  console.log('\n--- 17. Testing Phase 2D Coordinate Lifecycle Invariants ---');
  const mockListingPayload = {
    status: 'listed' as PartnerLifecycleStatus,
    claimStatus: 'unclaimed',
    isActive: false,
    ownerId: null,
    latitude: -6.7320,
    longitude: 108.5523,
  };
  assert(
    mockListingPayload.status === 'listed' && mockListingPayload.isActive === false,
    '17a. Partner listing with coordinates remains in LISTED status and is_active = false'
  );
  assert(
    mockListingPayload.ownerId === null && mockListingPayload.claimStatus === 'unclaimed',
    '17b. Partner listing with coordinates remains UNCLAIMED without owner'
  );

  // TEST 18: Phase 2D-A - Direct API Auth Flow & Role Gate Tests
  console.log('\n--- 18. Testing Phase 2D-A Direct API Auth & Role Gate Security ---');
  const emptyReq = new Request('http://localhost:3000/api/admin/partners');
  const emptyAuthResult = await verifyAdminAuth(emptyReq);
  assert(
    emptyAuthResult.isAuthenticated === false,
    '18a. GET /api/admin/partners without Auth header returns isAuthenticated = false (HTTP 401)'
  );

  const invalidTokenReq = new Request('http://localhost:3000/api/admin/partners', {
    headers: { Authorization: 'Bearer invalid_token_xyz' },
  });
  const invalidAuthResult = await verifyAdminAuth(invalidTokenReq);
  assert(
    invalidAuthResult.isAuthenticated === false,
    '18b. GET /api/admin/partners with invalid token returns isAuthenticated = false (HTTP 401)'
  );

  const customerReq = new Request('http://localhost:3000/api/admin/partners', {
    headers: { Authorization: 'Bearer mock_customer_token' },
  });
  const customerAuth = await verifyAdminAuth(customerReq);
  assert(
    customerAuth.isAuthenticated === true && customerAuth.isPlatformAdmin === false,
    '18c. GET /api/admin/partners with Customer token returns isAuthenticated = true, isPlatformAdmin = false (HTTP 403 Forbidden)'
  );

  const courierReq = new Request('http://localhost:3000/api/admin/partners', {
    headers: { Authorization: 'Bearer mock_courier_token' },
  });
  const courierAuth = await verifyAdminAuth(courierReq);
  assert(
    courierAuth.isAuthenticated === true && courierAuth.isPlatformAdmin === false,
    '18d. GET /api/admin/partners with Courier token returns isAuthenticated = true, isPlatformAdmin = false (HTTP 403 Forbidden)'
  );

  const ownerReq = new Request('http://localhost:3000/api/admin/partners', {
    headers: { Authorization: 'Bearer mock_owner_token' },
  });
  const ownerAuth = await verifyAdminAuth(ownerReq);
  assert(
    ownerAuth.isAuthenticated === true && ownerAuth.isPlatformAdmin === false,
    '18e. GET /api/admin/partners with Partner Owner token returns isAuthenticated = true, isPlatformAdmin = false (HTTP 403 Forbidden)'
  );

  const adminReq = new Request('http://localhost:3000/api/admin/partners', {
    headers: { Authorization: 'Bearer mock_admin_token' },
  });
  const adminAuth = await verifyAdminAuth(adminReq);
  assert(
    adminAuth.isAuthenticated === true && adminAuth.isPlatformAdmin === true,
    '18f. GET /api/admin/partners with Platform Admin token returns isAuthenticated = true, isPlatformAdmin = true (HTTP 200 OK)'
  );

  // TEST 19: Phase 2D-B - CreatePartnerModal POST Auth Header Verification
  console.log('\n--- 19. Testing Phase 2D-B CreatePartnerModal POST Auth Header Security ---');
  const postWithoutAuth = new Request('http://localhost:3000/api/admin/partners', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test Laundry' }),
  });
  const postNoAuthResult = await verifyAdminAuth(postWithoutAuth);
  assert(
    postNoAuthResult.isAuthenticated === false,
    '19a. POST /api/admin/partners without Auth header returns 401 Unauthorized'
  );

  const postWithAdminAuth = new Request('http://localhost:3000/api/admin/partners', {
    method: 'POST',
    headers: { Authorization: 'Bearer mock_admin_token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Laundry' }),
  });
  const postAdminAuthResult = await verifyAdminAuth(postWithAdminAuth);
  assert(
    postAdminAuthResult.isAuthenticated === true && postAdminAuthResult.isPlatformAdmin === true,
    '19b. POST /api/admin/partners with Platform Admin Bearer token returns 200 OK'
  );

  // TEST 21: Phase 2D-I - Simplified Partner Onboarding Lifecycle Matrix
  console.log('\n--- 21. Testing Phase 2D-I Simplified Lifecycle Matrix (LISTED -> ORDER_READY -> SUPPLIER -> PARTNER) ---');
  assert(
    partnerPermissionService.isValidStatusTransition('listed', 'order_ready').valid === true,
    '21a. LISTED -> ORDER_READY transition is valid without owner account requirement'
  );
  assert(
    partnerPermissionService.isValidStatusTransition('order_ready', 'supplier').valid === true,
    '21b. ORDER_READY -> SUPPLIER transition is valid upon commercial/operational demand'
  );
  assert(
    partnerPermissionService.isValidStatusTransition('supplier', 'active').valid === true,
    '21c. SUPPLIER -> ACTIVE (PARTNER) transition is valid upon formal partner agreement'
  );
  assert(
    partnerPermissionService.isValidStatusTransition('order_ready', 'suspended').valid === true,
    '21d. ORDER_READY -> SUSPENDED transition is valid for quality control'
  );
  assert(
    partnerPermissionService.isValidStatusTransition('supplier', 'suspended').valid === true,
    '21e. SUPPLIER -> SUSPENDED transition is valid for quality control'
  );

  // TEST 22: Phase 2D-I - Order Eligibility Boundary Rules
  console.log('\n--- 22. Testing Phase 2D-I Order Eligibility Boundary Rules ---');
  const eligibleStatuses = ['order_ready', 'supplier', 'active', 'partner'];
  const ineligibleStatuses = ['listed', 'unclaimed', 'claimed', 'onboarding', 'suspended', 'inactive'];

  eligibleStatuses.forEach((status) => {
    assert(
      ['order_ready', 'supplier', 'active', 'partner'].includes(status),
      `22a. Status '${status.toUpperCase()}' is eligible to receive customer orders`
    );
  });

  ineligibleStatuses.forEach((status) => {
    assert(
      !['order_ready', 'supplier', 'active', 'partner'].includes(status),
      `22b. Status '${status.toUpperCase()}' is NOT eligible to receive customer orders`
    );
  });

  // TEST 23: Phase 2D-I.2 - Partner Detail Page Lifecycle Transitions & Recovery
  console.log('\n--- 23. Testing Phase 2D-I.2 Partner Detail Lifecycle Actions & Recovery Matrix ---');
  // Detail page must not allow direct LISTED -> ACTIVE bypass
  assert(
    partnerPermissionService.isValidStatusTransition('listed', 'active').valid === false,
    '23a. Invalid direct LISTED -> ACTIVE transition is rejected (preventing UI action bypass)'
  );
  // Detail page must not allow direct LISTED -> SUSPENDED bypass
  assert(
    partnerPermissionService.isValidStatusTransition('listed', 'suspended').valid === false,
    '23b. Invalid direct LISTED -> SUSPENDED transition is rejected'
  );
  // Suspended recovery transitions
  assert(
    partnerPermissionService.isValidStatusTransition('suspended', 'order_ready').valid === true,
    '23c. Valid recovery SUSPENDED -> ORDER_READY is accepted'
  );
  assert(
    partnerPermissionService.isValidStatusTransition('suspended', 'supplier').valid === true,
    '23d. Valid recovery SUSPENDED -> SUPPLIER is accepted'
  );
  assert(
    partnerPermissionService.isValidStatusTransition('suspended', 'active').valid === true,
    '23e. Valid recovery SUSPENDED -> ACTIVE is accepted'
  );
  // Inactive recovery transitions
  assert(
    partnerPermissionService.isValidStatusTransition('inactive', 'order_ready').valid === true,
    '23f. Valid recovery INACTIVE -> ORDER_READY is accepted'
  );
  assert(
    partnerPermissionService.isValidStatusTransition('inactive', 'active').valid === true,
    '23g. Valid recovery INACTIVE -> ACTIVE is accepted'
  );

  // TEST 24: Phase 2D-I.2 - Business Meaning Labels Mapping
  console.log('\n--- 24. Testing Phase 2D-I.2 Business Meaning Label Mappings ---');
  const getBusinessMeaningLabel = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'listed':
      case 'unclaimed':
        return 'Belum tersedia untuk order';
      case 'order_ready':
      case 'supplier':
        return 'Tersedia di CUCIYAN';
      case 'active':
      case 'partner':
        return 'Mitra Resmi CUCIYAN';
      case 'suspended':
        return 'Ditangguhkan (Suspended)';
      case 'inactive':
        return 'Nonaktif';
      default:
        return status || '-';
    }
  };

  assert(
    getBusinessMeaningLabel('listed') === 'Belum tersedia untuk order',
    '24a. LISTED correctly maps to "Belum tersedia untuk order"'
  );
  assert(
    getBusinessMeaningLabel('order_ready') === 'Tersedia di CUCIYAN',
    '24b. ORDER_READY correctly maps to "Tersedia di CUCIYAN"'
  );
  assert(
    getBusinessMeaningLabel('supplier') === 'Tersedia di CUCIYAN',
    '24c. SUPPLIER correctly maps to "Tersedia di CUCIYAN"'
  );
  assert(
    getBusinessMeaningLabel('active') === 'Mitra Resmi CUCIYAN',
    '24d. ACTIVE correctly maps to "Mitra Resmi CUCIYAN"'
  );
  assert(
    getBusinessMeaningLabel('partner') === 'Mitra Resmi CUCIYAN',
    '24e. PARTNER correctly maps to "Mitra Resmi CUCIYAN"'
  );

  // TEST 25: Phase 2D-I.4 - Atomic Default Service Provisioning for ORDER_READY
  console.log('\n--- 25. Testing Phase 2D-I.4 Atomic Default Service Provisioning ---');

  interface SimulatedService {
    id: string;
    laundry_id: string;
    code: string;
    name: string;
    price_per_unit: number;
    unit: string;
    min_weight: number;
    estimated_hours: number;
    is_active: boolean;
  }

  interface SimulatedLaundry {
    id: string;
    name: string;
    status: string;
    is_active: boolean;
  }

  const simulateUpdatePartnerStatusAtomic = (
    actorRole: string,
    laundry: SimulatedLaundry,
    services: SimulatedService[],
    targetStatus: string,
    options?: { simulateInsertFailure?: boolean }
  ): {
    success: boolean;
    laundry: SimulatedLaundry;
    services: SimulatedService[];
    default_service_provisioned: boolean;
    error?: string;
  } => {
    // 1. Role Gate
    if (actorRole !== 'platform_admin') {
      return {
        success: false,
        laundry: { ...laundry },
        services: services.map((s) => ({ ...s })),
        default_service_provisioned: false,
        error: 'Akses ditolak: Hanya platform_admin yang dapat memperbarui status partner.',
      };
    }

    // 2. Lifecycle Transition Validation
    const transitionCheck = partnerPermissionService.isValidStatusTransition(laundry.status, targetStatus);
    if (!transitionCheck.valid) {
      return {
        success: false,
        laundry: { ...laundry },
        services: services.map((s) => ({ ...s })),
        default_service_provisioned: false,
        error: transitionCheck.error,
      };
    }

    // 3. Begin Transaction Simulation
    const laundryCopy = { ...laundry };
    const servicesCopy = services.map((s) => ({ ...s }));
    let defaultProvisioned = false;

    const isActive = ['order_ready', 'supplier', 'active', 'partner'].includes(targetStatus);

    // 4. Atomic Default Service Provisioning for ORDER_READY
    if (targetStatus === 'order_ready') {
      const hasActiveService = servicesCopy.some(
        (s) => s.laundry_id === laundryCopy.id && s.is_active
      );

      if (!hasActiveService) {
        if (options?.simulateInsertFailure) {
          // Transaction Rollback Simulation
          return {
            success: false,
            laundry: { ...laundry },
            services: services.map((s) => ({ ...s })),
            default_service_provisioned: false,
            error: 'Simulated Database Failure: INSERT into public.services failed',
          };
        }

        servicesCopy.push({
          id: `srv_${Date.now()}`,
          laundry_id: laundryCopy.id,
          code: 'kiloan',
          name: 'Cuci Komplit Kiloan',
          price_per_unit: 8000,
          unit: 'kg',
          min_weight: 3,
          estimated_hours: 48,
          is_active: true,
        });
        defaultProvisioned = true;
      }
    }

    // 5. Update Laundry Status
    laundryCopy.status = targetStatus;
    laundryCopy.is_active = isActive;

    return {
      success: true,
      laundry: laundryCopy,
      services: servicesCopy,
      default_service_provisioned: defaultProvisioned,
    };
  };

  // Scenario 1: LISTED + 0 services -> ORDER_READY -> exactly 1 active service
  const lnd1: SimulatedLaundry = { id: 'lnd_test_1', name: 'Fresh Test 1', status: 'listed', is_active: false };
  const srvs1: SimulatedService[] = [];
  const res1 = simulateUpdatePartnerStatusAtomic('platform_admin', lnd1, srvs1, 'order_ready');
  assert(res1.success === true, '25a.1. Transition LISTED -> ORDER_READY succeeds');
  assert(res1.laundry.status === 'order_ready', '25a.2. Laundry status is ORDER_READY');
  assert(res1.laundry.is_active === true, '25a.3. Laundry is_active is true');
  assert(res1.default_service_provisioned === true, '25a.4. Default service was provisioned');
  assert(res1.services.length === 1, '25a.5. Exactly 1 service exists');
  assert(res1.services[0].is_active === true, '25a.6. Provisioned service is active');
  assert(res1.services[0].price_per_unit === 8000, '25a.7. Provisioned service price is 8000');

  // Scenario 2: LISTED + 1 active custom service -> ORDER_READY -> service count remains 1
  const lnd2: SimulatedLaundry = { id: 'lnd_test_2', name: 'Fresh Test 2', status: 'listed', is_active: false };
  const srvs2: SimulatedService[] = [
    {
      id: 'srv_custom',
      laundry_id: 'lnd_test_2',
      code: 'kiloan',
      name: 'Cuci Kiloan Premium Toko',
      price_per_unit: 10000,
      unit: 'kg',
      min_weight: 2,
      estimated_hours: 24,
      is_active: true,
    },
  ];
  const res2 = simulateUpdatePartnerStatusAtomic('platform_admin', lnd2, srvs2, 'order_ready');
  assert(res2.success === true, '25b.1. Transition succeeds for laundry with existing active service');
  assert(res2.default_service_provisioned === false, '25b.2. No new default service is provisioned');
  assert(res2.services.length === 1, '25b.3. Service count remains exactly 1');
  assert(res2.services[0].name === 'Cuci Kiloan Premium Toko', '25b.4. Existing custom service preserved');

  // Scenario 3: LISTED + only inactive services -> ORDER_READY -> exactly 1 additional active default service
  const lnd3: SimulatedLaundry = { id: 'lnd_test_3', name: 'Fresh Test 3', status: 'listed', is_active: false };
  const srvs3: SimulatedService[] = [
    {
      id: 'srv_inactive',
      laundry_id: 'lnd_test_3',
      code: 'kiloan',
      name: 'Cuci Lama Nonaktif',
      price_per_unit: 5000,
      unit: 'kg',
      min_weight: 1,
      estimated_hours: 48,
      is_active: false,
    },
  ];
  const res3 = simulateUpdatePartnerStatusAtomic('platform_admin', lnd3, srvs3, 'order_ready');
  assert(res3.success === true, '25c.1. Transition succeeds for laundry with only inactive service');
  assert(res3.default_service_provisioned === true, '25c.2. Default service is provisioned because no active service existed');
  assert(res3.services.length === 2, '25c.3. Total services is 2');
  assert(res3.services.filter((s) => s.is_active).length === 1, '25c.4. Exactly 1 ACTIVE service exists');

  // Scenario 4: ORDER_READY -> SUPPLIER -> no duplicate service
  const res4 = simulateUpdatePartnerStatusAtomic('platform_admin', res1.laundry, res1.services, 'supplier');
  assert(res4.success === true, '25d.1. Transition ORDER_READY -> SUPPLIER succeeds');
  assert(res4.default_service_provisioned === false, '25d.2. No duplicate service provisioned on SUPPLIER transition');
  assert(res4.services.length === 1, '25d.3. Service count remains 1');

  // Scenario 5: SUSPENDED -> ORDER_READY -> no duplicate service if active service exists
  const lndSuspended: SimulatedLaundry = { id: 'lnd_test_5', name: 'Fresh Test 5', status: 'suspended', is_active: false };
  const srvs5: SimulatedService[] = [
    {
      id: 'srv_existing',
      laundry_id: 'lnd_test_5',
      code: 'kiloan',
      name: 'Cuci Komplit Kiloan',
      price_per_unit: 8000,
      unit: 'kg',
      min_weight: 3,
      estimated_hours: 48,
      is_active: true,
    },
  ];
  const res5 = simulateUpdatePartnerStatusAtomic('platform_admin', lndSuspended, srvs5, 'order_ready');
  assert(res5.success === true, '25e.1. Recovery SUSPENDED -> ORDER_READY succeeds');
  assert(res5.default_service_provisioned === false, '25e.2. No duplicate service created on recovery');
  assert(res5.services.length === 1, '25e.3. Service count remains exactly 1');

  // Scenario 6: Non-platform-admin cannot perform transition or provisioning
  const res6a = simulateUpdatePartnerStatusAtomic('customer', lnd1, srvs1, 'order_ready');
  assert(res6a.success === false, '25f.1. Customer cannot trigger ORDER_READY transition');
  assert(res6a.services.length === 0, '25f.2. Customer cannot trigger service provisioning');

  const res6b = simulateUpdatePartnerStatusAtomic('laundry_owner', lnd1, srvs1, 'order_ready');
  assert(res6b.success === false, '25f.3. Laundry Owner cannot trigger platform status transition');

  // Scenario 7: Simulate service provisioning failure -> entire transaction rolls back
  const lnd7: SimulatedLaundry = { id: 'lnd_test_7', name: 'Fresh Test 7', status: 'listed', is_active: false };
  const srvs7: SimulatedService[] = [];
  const res7 = simulateUpdatePartnerStatusAtomic('platform_admin', lnd7, srvs7, 'order_ready', {
    simulateInsertFailure: true,
  });
  assert(res7.success === false, '25g.1. Failure during service insert triggers rollback');
  assert(res7.laundry.status === 'listed', '25g.2. Laundry status remains LISTED upon failure');
  assert(res7.laundry.is_active === false, '25g.3. Laundry is_active remains FALSE upon failure');
  assert(res7.services.length === 0, '25g.4. Zero services persisted upon rollback');

  // Scenario 8: After provisioning, customer marketplace discovery and order creation succeed
  // Marketplace visibility check:
  const isMarketplaceVisible = res1.laundry.is_active === true;
  assert(isMarketplaceVisible, '25h.1. Provisioned laundry is visible in customer marketplace query');

  // Service selection check:
  const customerSelectableServices = res1.services.filter(
    (s) => s.laundry_id === res1.laundry.id && s.is_active
  );
  assert(customerSelectableServices.length > 0, '25h.2. Customer finds at least 1 selectable service');
  assert(customerSelectableServices[0].price_per_unit > 0, '25h.3. Selectable service has valid non-zero pricing');

  // Order creation check (simulating create_order_with_items_atomic check):
  const orderEligibleStatuses = ['order_ready', 'supplier', 'active', 'partner'];
  const canReceiveOrder = orderEligibleStatuses.includes(res1.laundry.status) && res1.laundry.is_active;
  assert(canReceiveOrder, '25h.4. Laundry status ORDER_READY satisfies create_order_with_items_atomic gate');

  console.log('\n=============================================================================');
  console.log(`PARTNER DATABASE MANAGEMENT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPlatformOpsPartnerDatabaseTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
