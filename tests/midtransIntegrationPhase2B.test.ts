import { paymentService } from '../services/paymentService';
import { checkoutService } from '../services/checkoutService';
import { orderService } from '../services/orderService';
import { DEMO_USERS } from '../utils/constants';

const originalFetch = global.fetch;
const originalEnv = process.env;

async function runPhase2BTests() {
  console.log('==================================================');
  console.log('RUNNING PHASE 2B MIDTRANS INTEGRATION TESTS');
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

  const TEST_SERVER_KEY = 'SB-Mid-server-TESTKEY-PHASE2B';

  // Set up mock fetch for Midtrans Snap API
  let mockFetchCallCount = 0;
  let lastRequestBody: any = {};

  function setupMockFetchSuccess() {
    mockFetchCallCount = 0;
    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      mockFetchCallCount++;
      lastRequestBody = JSON.parse((init?.body as string) || '{}');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          token: `snap-token-mock-${mockFetchCallCount}`,
          redirect_url: `https://app.sandbox.midtrans.com/snap/v1/transactions/snap-token-mock-${mockFetchCallCount}/pdf`,
        }),
      } as Response;
    }) as typeof fetch;
  }

  function setupMockFetchError() {
    global.fetch = (async () => {
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error_messages: ['Midtrans API Error: Simulating Gateway Failure'],
        }),
      } as Response;
    }) as typeof fetch;
  }

  // Create test order
  const customer = DEMO_USERS[0];
  const testOrder = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Sudirman No. 123',
      deliveryAddress: 'Jl. Sudirman No. 123',
      pickupDate: '2026-08-22',
      pickupTimeSlot: '10:00 - 12:00 WIB',
      estimatedWeightKg: 4,
    },
    customer
  );
  // Authoritative total price for 4kg kiloan = 4 * 8000 + 2000 = Rp 34.000

  // Enable Midtrans Gateway
  process.env = { ...originalEnv, MIDTRANS_SERVER_KEY: TEST_SERVER_KEY, MIDTRANS_IS_PRODUCTION: 'false' };
  setupMockFetchSuccess();

  // Test 1 & 6 & 7: New Midtrans payment attempt returns paymentToken & paymentUrl
  const payment1 = await paymentService.createPaymentAttemptAsync(testOrder.id, 'snap');
  assert(payment1.provider === 'midtrans', 'Test 1: Provider is midtrans');
  assert(payment1.status === 'pending', 'Test 1: Initial payment status is pending');
  assert(payment1.paymentToken === 'snap-token-mock-1', 'Test 6: paymentToken is returned in PaymentAttempt');
  assert(
    payment1.paymentUrl === 'https://app.sandbox.midtrans.com/snap/v1/transactions/snap-token-mock-1/pdf',
    'Test 7: paymentUrl is returned in PaymentAttempt'
  );
  assert(mockFetchCallCount === 1, 'Test 1: Midtrans API called exactly once');

  // Test 2 & 3 & 4 & 5: Existing pending Midtrans attempt is reused (Idempotency)
  const initialProviderRef = payment1.providerReference;
  const initialIdempotencyKey = payment1.idempotencyKey;

  const payment2 = await paymentService.createPaymentAttemptAsync(testOrder.id, 'snap');
  assert(payment2.id === payment1.id, 'Test 2: Reused SAME payment attempt ID (Idempotency PASS)');
  assert(payment2.paymentToken === 'snap-token-mock-1', 'Test 2: Reused SAME paymentToken');
  assert(payment2.providerReference === initialProviderRef, 'Test 5: provider_reference remains stable on retry');
  assert(payment2.idempotencyKey === initialIdempotencyKey, 'Test 4: Same idempotency key is reused');
  assert(mockFetchCallCount === 1, 'Test 3: Double payment request did NOT make duplicate call to Midtrans API');

  // Test 8 & 9: Amount comes from trusted order total; client amount manipulation rejected
  await assertThrowsAsync(async () => {
    await paymentService.createPaymentAttemptAsync(testOrder.id, 'snap', 100); // Spoofed Rp 100!
  }, 'Test 9: Client amount manipulation (Rp 100 vs Rp 34.000) rejected by server validation');

  assert(lastRequestBody.transaction_details.gross_amount === 34000, 'Test 8: Amount sent to Midtrans came from trusted database order total Rp 34.000');

  // Test 10 & 11 & 12: Failed Midtrans transaction creation does not mark order as paid or change orders.status
  const testOrder2 = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'express',
      pickupAddress: 'Jl. Gatot Subroto No. 45',
      deliveryAddress: 'Jl. Gatot Subroto No. 45',
      pickupDate: '2026-08-23',
      pickupTimeSlot: '13:00 - 15:00 WIB',
      estimatedWeightKg: 3,
    },
    customer
  );

  setupMockFetchError();

  await assertThrowsAsync(async () => {
    await paymentService.createPaymentAttemptAsync(testOrder2.id, 'snap');
  }, 'Test 10: Midtrans API error throws exception');

  const order2AfterFail = orderService.getOrderById(testOrder2.id);
  assert(order2AfterFail?.status === 'pending', 'Test 11 & 12: Failed Midtrans creation leaves orders.status as pending');
  assert(order2AfterFail?.paymentStatus === 'unpaid', 'Test 10: Failed Midtrans creation does not set order.paymentStatus to paid or pending');

  // Test 13: Xendit Fallback functional when MIDTRANS_SERVER_KEY is absent and XENDIT_SECRET_KEY is present
  delete process.env.MIDTRANS_SERVER_KEY;
  process.env.XENDIT_SECRET_KEY = 'xnd_development_testkey123';

  global.fetch = (async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'inv_xendit_mock_123',
        status: 'PENDING',
        external_id: 'XND-TEST-001',
        invoice_url: 'https://checkout.xendit.co/v2/inv_xendit_mock_123',
      }),
    } as Response;
  }) as typeof fetch;

  const testOrder3 = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'satuan',
      pickupAddress: 'Jl. Thamrin No. 8',
      deliveryAddress: 'Jl. Thamrin No. 8',
      pickupDate: '2026-08-24',
      pickupTimeSlot: '08:00 - 10:00 WIB',
      estimatedWeightKg: 1,
    },
    customer
  );

  const payment3 = await paymentService.createPaymentAttemptAsync(testOrder3.id, 'qris');
  assert(payment3.provider === 'xendit', 'Test 13: Xendit fallback activated when XENDIT_SECRET_KEY present and MIDTRANS_SERVER_KEY absent');
  assert(payment3.invoiceUrl === 'https://checkout.xendit.co/v2/inv_xendit_mock_123', 'Test 13: Xendit invoiceUrl returned correctly');

  // Test 14: Mock Gateway Fallback functional when no keys are present
  delete process.env.XENDIT_SECRET_KEY;
  delete process.env.MIDTRANS_SERVER_KEY;

  const testOrder4 = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Asia Afrika No. 10',
      deliveryAddress: 'Jl. Asia Afrika No. 10',
      pickupDate: '2026-08-25',
      pickupTimeSlot: '15:00 - 17:00 WIB',
      estimatedWeightKg: 2,
    },
    customer
  );

  const payment4 = await paymentService.createPaymentAttemptAsync(testOrder4.id, 'qris');
  assert(payment4.provider === 'mock_qris', 'Test 14: Mock gateway fallback activated when no keys present');

  // Restore fetch & env
  process.env = originalEnv;
  global.fetch = originalFetch;

  console.log('\n==================================================');
  console.log(`PHASE 2B SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2BTests();
