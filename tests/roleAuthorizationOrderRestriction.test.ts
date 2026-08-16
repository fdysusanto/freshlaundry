import { checkoutService } from '../services/checkoutService';
import { orderService } from '../services/orderService';
import { UserProfile } from '../types/user';

async function runRoleAuthorizationOrderRestrictionTests() {
  console.log('===========================================================');
  console.log('RUNNING ROLE AUTHORIZATION ORDER CREATION RESTRICTION TESTS');
  console.log('===========================================================\n');

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

  async function assertThrowsAsync(fn: () => Promise<any>, testName: string) {
    try {
      await fn();
      console.error(`[FAIL] ${testName} (Expected authorization error but request succeeded)`);
      failed++;
    } catch (err: any) {
      const isAuthError = err.message.includes('Akses Ditolak') || err.message.includes('Hanya akun dengan peran Customer');
      if (isAuthError) {
        console.log(`[PASS] ${testName} (BLOCKED as expected: "${err.message}")`);
        passed++;
      } else {
        console.error(`[FAIL] ${testName} (Unexpected error thrown: "${err.message}")`);
        failed++;
      }
    }
  }

  // Define test profiles for all 5 roles
  const customerUser: UserProfile = {
    id: 'usr_cust_001',
    email: 'customer@freshwash.id',
    fullName: 'Customer Test',
    phone: '081234567890',
    role: 'customer',
    createdAt: new Date().toISOString(),
  };

  const courierUser: UserProfile = {
    id: 'usr_cour_001',
    email: 'courier@freshwash.id',
    fullName: 'Courier Driver Test',
    phone: '081234567891',
    role: 'courier',
    createdAt: new Date().toISOString(),
  };

  const ownerUser: UserProfile = {
    id: 'usr_owner_001',
    email: 'owner@freshwash.id',
    fullName: 'Laundry Owner Test',
    phone: '081234567892',
    role: 'laundry_owner',
    createdAt: new Date().toISOString(),
  };

  const staffUser: UserProfile = {
    id: 'usr_staff_001',
    email: 'staff@freshwash.id',
    fullName: 'Laundry Staff Test',
    phone: '081234567893',
    role: 'laundry_staff',
    createdAt: new Date().toISOString(),
  };

  const adminUser: UserProfile = {
    id: 'usr_admin_001',
    email: 'admin@freshwash.id',
    fullName: 'Platform Admin Test',
    phone: '081234567894',
    role: 'platform_admin',
    createdAt: new Date().toISOString(),
  };

  const baseCheckoutPayload = {
    laundryId: 'lnd_001',
    items: [{ serviceId: 'srv_001', quantity: 5 }],
    pickupAddress: 'Jl. Melati No. 10, Kebayoran',
    deliveryAddress: 'Jl. Melati No. 10, Kebayoran',
    pickupDate: '2026-08-20',
    pickupTimeSlot: '08:00 - 10:00 WIB',
  };

  // 1. CUSTOMER ROLE TEST -> ALLOWED
  console.log('--- 1. Testing CUSTOMER Role ---');
  const custRes = await checkoutService.processCheckoutAsync(
    { ...baseCheckoutPayload, idempotencyKey: `IDEMP-CUST-${Date.now()}` },
    customerUser
  );
  assert(custRes.success === true, 'CUSTOMER role -> create customer order: ALLOWED (SUCCESS)');

  // 2. COURIER ROLE TEST -> DENIED
  console.log('\n--- 2. Testing COURIER Role ---');
  await assertThrowsAsync(async () => {
    await checkoutService.processCheckoutAsync(
      { ...baseCheckoutPayload, idempotencyKey: `IDEMP-COUR-${Date.now()}` },
      courierUser
    );
  }, 'COURIER role -> create customer order: DENIED (BLOCKED)');

  await assertThrowsAsync(async () => {
    orderService.createOrder(
      {
        laundryId: 'lnd_001',
        serviceType: 'kiloan',
        pickupAddress: 'Jl. Melati No. 10',
        deliveryAddress: 'Jl. Melati No. 10',
        pickupDate: '2026-08-20',
        pickupTimeSlot: '08:00',
      },
      courierUser
    );
  }, 'COURIER role -> direct orderService.createOrder: DENIED (BLOCKED)');

  // 3. LAUNDRY_OWNER ROLE TEST -> DENIED
  console.log('\n--- 3. Testing LAUNDRY_OWNER Role ---');
  await assertThrowsAsync(async () => {
    await checkoutService.processCheckoutAsync(
      { ...baseCheckoutPayload, idempotencyKey: `IDEMP-OWNER-${Date.now()}` },
      ownerUser
    );
  }, 'LAUNDRY_OWNER role -> create customer order: DENIED (BLOCKED)');

  await assertThrowsAsync(async () => {
    orderService.createOrder(
      {
        laundryId: 'lnd_001',
        serviceType: 'kiloan',
        pickupAddress: 'Jl. Melati No. 10',
        deliveryAddress: 'Jl. Melati No. 10',
        pickupDate: '2026-08-20',
        pickupTimeSlot: '08:00',
      },
      ownerUser
    );
  }, 'LAUNDRY_OWNER role -> direct orderService.createOrder: DENIED (BLOCKED)');

  // 4. LAUNDRY_STAFF ROLE TEST -> DENIED
  console.log('\n--- 4. Testing LAUNDRY_STAFF Role ---');
  await assertThrowsAsync(async () => {
    await checkoutService.processCheckoutAsync(
      { ...baseCheckoutPayload, idempotencyKey: `IDEMP-STAFF-${Date.now()}` },
      staffUser
    );
  }, 'LAUNDRY_STAFF role -> create customer order: DENIED (BLOCKED)');

  await assertThrowsAsync(async () => {
    orderService.createOrder(
      {
        laundryId: 'lnd_001',
        serviceType: 'kiloan',
        pickupAddress: 'Jl. Melati No. 10',
        deliveryAddress: 'Jl. Melati No. 10',
        pickupDate: '2026-08-20',
        pickupTimeSlot: '08:00',
      },
      staffUser
    );
  }, 'LAUNDRY_STAFF role -> direct orderService.createOrder: DENIED (BLOCKED)');

  // 5. PLATFORM_ADMIN ROLE TEST -> DENIED
  console.log('\n--- 5. Testing PLATFORM_ADMIN Role ---');
  await assertThrowsAsync(async () => {
    await checkoutService.processCheckoutAsync(
      { ...baseCheckoutPayload, idempotencyKey: `IDEMP-ADMIN-${Date.now()}` },
      adminUser
    );
  }, 'PLATFORM_ADMIN role -> create customer order: DENIED (BLOCKED)');

  await assertThrowsAsync(async () => {
    orderService.createOrder(
      {
        laundryId: 'lnd_001',
        serviceType: 'kiloan',
        pickupAddress: 'Jl. Melati No. 10',
        deliveryAddress: 'Jl. Melati No. 10',
        pickupDate: '2026-08-20',
        pickupTimeSlot: '08:00',
      },
      adminUser
    );
  }, 'PLATFORM_ADMIN role -> direct orderService.createOrder: DENIED (BLOCKED)');

  console.log('\n===========================================================');
  console.log(`ROLE AUTHORIZATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('===========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRoleAuthorizationOrderRestrictionTests();
