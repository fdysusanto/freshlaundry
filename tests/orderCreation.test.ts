import { checkoutService } from '../services/checkoutService';
import { DEMO_USERS } from '../utils/constants';

async function runOrderCreationTests() {
  console.log('==================================================');
  console.log('RUNNING ORDER CREATION & ENGINE CONSOLIDATION TESTS');
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

  async function assertThrowsAsync(fn: () => Promise<any>, testName: string) {
    try {
      await fn();
      console.error(`[FAIL] ${testName} (Expected exception but none was thrown)`);
      failed++;
    } catch (err: any) {
      console.log(`[PASS] ${testName} (Caught expected error: "${err.message}")`);
      passed++;
    }
  }

  const customer = DEMO_USERS[0];

  // Test 1: Successful Consolidated Order Checkout
  const test1Key = `IDEMP-TEST-${Date.now()}-1`;
  const res1 = await checkoutService.processCheckoutAsync(
    {
      laundryId: 'lnd_001',
      items: [{ serviceId: 'srv_001', quantity: 5 }], // 5 x 8000 = 40.000 subtotal
      pickupAddress: 'Jl. Sudirman No. 12, Jakarta',
      deliveryAddress: 'Jl. Sudirman No. 12, Jakarta',
      pickupDate: '2026-08-20',
      pickupTimeSlot: '10:00 - 12:00 WIB',
      idempotencyKey: test1Key,
    },
    customer
  );

  assert(res1.success === true, 'Test 1: Checkout succeeded');
  assert(res1.isDuplicate === false, 'Test 1: First request marked as new (isDuplicate = false)');
  assert(res1.order.status === 'pending', 'Test 1: Order initial status is pending');
  assert(res1.pricing.subtotal === 40000, 'Test 1: Pricing subtotal = Rp 40.000');
  assert(res1.pricing.totalPrice === 42000, 'Test 1: Pricing totalPrice = 40.000 + 2.000 platform fee = Rp 42.000');
  assert(res1.payment.status === 'pending', 'Test 1: Initial payment attempt status is pending');
  assert(res1.payment.provider === 'mock_qris', 'Test 1: Payment provider initialized to mock_qris');

  // Test 2: Duplicate Submission Test (Idempotency Key Safeguard)
  // Request B sent with exact same idempotencyKey
  const res2 = await checkoutService.processCheckoutAsync(
    {
      laundryId: 'lnd_001',
      items: [{ serviceId: 'srv_001', quantity: 5 }],
      pickupAddress: 'Jl. Sudirman No. 12, Jakarta',
      deliveryAddress: 'Jl. Sudirman No. 12, Jakarta',
      pickupDate: '2026-08-20',
      pickupTimeSlot: '10:00 - 12:00 WIB',
      idempotencyKey: test1Key, // SAME KEY!
    },
    customer
  );

  assert(res2.success === true, 'Test 2: Replayed request succeeded');
  assert(res2.isDuplicate === true, 'Test 2: Replayed request flagged as duplicate (isDuplicate = true)');
  assert(res2.order.id === res1.order.id, 'Test 2: Returned SAME order ID (No duplicate Order B created)');
  assert(res2.payment.id === res1.payment.id, 'Test 2: Returned SAME payment attempt ID');

  // Test 3: Price Manipulation Test (Client sends unitPrice = 1)
  const test3Key = `IDEMP-TEST-${Date.now()}-3`;
  const res3 = await checkoutService.processCheckoutAsync(
    {
      laundryId: 'lnd_001',
      items: [{ serviceId: 'srv_001', quantity: 5, unitPrice: 1 }], // Client spoofed Rp 1 unitPrice!
      pickupAddress: 'Jl. Gatot Subroto No. 8, Jakarta',
      pickupDate: '2026-08-21',
      pickupTimeSlot: '14:00 - 16:00 WIB',
      idempotencyKey: test3Key,
    },
    customer
  );

  assert(res3.pricing.itemsBreakdown[0].unitPrice === 8000, 'Test 3: Database unitPrice Rp 8.000 wins over client spoofed Rp 1');
  assert(res3.pricing.subtotal === 40000, 'Test 3: Server calculated subtotal Rp 40.000 correctly');

  // Test 4: Multi-Tenant Guard Test (Laundry A with Service of Laundry B)
  // srv_101 belongs to lnd_002, submitting under lnd_001 must be REJECTED!
  const test4Key = `IDEMP-TEST-${Date.now()}-4`;
  await assertThrowsAsync(async () => {
    await checkoutService.processCheckoutAsync(
      {
        laundryId: 'lnd_001',
        items: [{ serviceId: 'srv_101', quantity: 2 }],
        pickupAddress: 'Jl. Gatot Subroto No. 8',
        pickupDate: '2026-08-21',
        pickupTimeSlot: '14:00 - 16:00 WIB',
        idempotencyKey: test4Key,
      },
      customer
    );
  }, 'Test 4: Multi-tenant cross-laundry service selection rejected');

  // Test 5: Payment Amount Authority Test
  const test5Key = `IDEMP-TEST-${Date.now()}-5`;
  const res5 = await checkoutService.processCheckoutAsync(
    {
      laundryId: 'lnd_001',
      items: [{ serviceId: 'srv_001', quantity: 2 }], // 2 x 8000 + 2000 = 18.000 total
      pickupAddress: 'Jl. Kebayoran Lama No. 99',
      pickupDate: '2026-08-22',
      pickupTimeSlot: '09:00 - 11:00 WIB',
      idempotencyKey: test5Key,
      clientSuppliedTotal: 1000, // Spoofed Rp 1.000 total!
    },
    customer
  );
  assert(res5.pricing.totalPrice === 18000, 'Test 5: Authoritative total price calculated as Rp 18.000');

  // Test 6: Input Errors (Empty items, invalid laundry, missing idempotency key)
  await assertThrowsAsync(async () => {
    await checkoutService.processCheckoutAsync(
      {
        laundryId: 'lnd_001',
        items: [],
        pickupAddress: 'Jl. X',
        pickupDate: '2026-08-22',
        pickupTimeSlot: '09:00',
        idempotencyKey: 'IDEMP-FAIL-1',
      },
      customer
    );
  }, 'Test 6: Empty items array rejected');

  await assertThrowsAsync(async () => {
    await checkoutService.processCheckoutAsync(
      {
        laundryId: 'lnd_001',
        items: [{ serviceId: 'srv_001', quantity: 1 }],
        pickupAddress: 'Jl. X',
        pickupDate: '2026-08-22',
        pickupTimeSlot: '09:00',
        idempotencyKey: '',
      },
      customer
    );
  }, 'Test 6: Missing idempotencyKey rejected');

  // Test 7: Voucher Code Checkout Integration
  const test7Key = `IDEMP-TEST-${Date.now()}-7`;
  const res7 = await checkoutService.processCheckoutAsync(
    {
      laundryId: 'lnd_001',
      items: [{ serviceId: 'srv_001', quantity: 3 }], // 24.000 subtotal
      pickupAddress: 'Jl. Rasuna Said No. 10',
      pickupDate: '2026-08-22',
      pickupTimeSlot: '13:00 - 15:00 WIB',
      voucherCode: 'FRESH5K',
      idempotencyKey: test7Key,
    },
    customer
  );
  assert(res7.pricing.discount === 5000, 'Test 7: Discount Rp 5.000 applied via FRESH5K voucher');
  assert(res7.pricing.totalPrice === 21000, 'Test 7: Final total price = 24000 + 2000 - 5000 = Rp 21.000');

  console.log('\n==================================================');
  console.log(`ORDER CREATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runOrderCreationTests();
