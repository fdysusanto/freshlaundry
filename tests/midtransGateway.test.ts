import { MidtransPaymentGateway } from '../services/paymentGateway';

// Store original fetch & env
const originalFetch = global.fetch;
const originalEnv = process.env;

async function runMidtransGatewayTests() {
  console.log('==================================================');
  console.log('RUNNING MIDTRANS PAYMENT GATEWAY ADAPTER TESTS');
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

  const TEST_SERVER_KEY = 'SB-Mid-server-TESTKEY12345';
  const EXPECTED_BASIC_AUTH = `Basic ${Buffer.from(TEST_SERVER_KEY + ':').toString('base64')}`;

  // Test 1: Successful Snap Transaction & Auth Header Verification
  {
    process.env = { ...originalEnv, MIDTRANS_SERVER_KEY: TEST_SERVER_KEY, MIDTRANS_IS_PRODUCTION: 'false' };
    let capturedUrl = '';
    let capturedHeaders: any = {};
    let capturedBody: any = {};

    global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedHeaders = init?.headers || {};
      capturedBody = JSON.parse((init?.body as string) || '{}');

      return {
        ok: true,
        status: 200,
        json: async () => ({
          token: 'snap-token-test-xyz123',
          redirect_url: 'https://app.sandbox.midtrans.com/snap/v1/transactions/snap-token-test-xyz123/pdf',
        }),
      } as Response;
    }) as typeof fetch;

    const gateway = new MidtransPaymentGateway();
    const res = await gateway.createPaymentRequest({
      orderId: 'ord_12345',
      amount: 50000,
      currency: 'IDR',
      paymentMethod: 'snap',
      idempotencyKey: 'MDT-IDEMP-001',
    });

    assert(res.success === true, 'Test 1: Success flag is true');
    assert(res.provider === 'midtrans', 'Test 1: Provider is midtrans');
    assert(res.paymentToken === 'snap-token-test-xyz123', 'Test 1: paymentToken returned correctly');
    assert(
      res.paymentUrl === 'https://app.sandbox.midtrans.com/snap/v1/transactions/snap-token-test-xyz123/pdf',
      'Test 1: paymentUrl returned correctly'
    );
    assert(capturedUrl === 'https://app.sandbox.midtrans.com/snap/v1/transactions', 'Test 1: Endpoint used sandbox URL');
    assert(capturedHeaders['Authorization'] === EXPECTED_BASIC_AUTH, 'Test 1: Authorization header matches expected HTTP Basic auth string');
    assert(capturedBody.transaction_details.gross_amount === 50000, 'Test 1: Gross amount matches trusted server amount');
    assert(!JSON.stringify(res).includes(TEST_SERVER_KEY), 'Test 1 (Security): Server key never appears in returned frontend object');
  }

  // Test 2: Production Endpoint Switching
  {
    process.env = { ...originalEnv, MIDTRANS_SERVER_KEY: TEST_SERVER_KEY, MIDTRANS_IS_PRODUCTION: 'true' };
    let capturedUrl = '';

    global.fetch = (async (url: string | URL | Request) => {
      capturedUrl = url.toString();
      return {
        ok: true,
        status: 200,
        json: async () => ({
          token: 'snap-token-prod-999',
          redirect_url: 'https://app.midtrans.com/snap/v1/transactions/snap-token-prod-999/pdf',
        }),
      } as Response;
    }) as typeof fetch;

    const gateway = new MidtransPaymentGateway();
    await gateway.createPaymentRequest({
      orderId: 'ord_12345',
      amount: 100000,
      currency: 'IDR',
      paymentMethod: 'snap',
      idempotencyKey: 'MDT-IDEMP-002',
    });

    assert(capturedUrl === 'https://app.midtrans.com/snap/v1/transactions', 'Test 2: Endpoint used production URL when MIDTRANS_IS_PRODUCTION=true');
  }

  // Test 3: Midtrans HTTP Error Handling
  {
    process.env = { ...originalEnv, MIDTRANS_SERVER_KEY: TEST_SERVER_KEY, MIDTRANS_IS_PRODUCTION: 'false' };

    global.fetch = (async () => {
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error_messages: ['Access denied due to invalid server key', 'Order ID already exists'],
        }),
      } as Response;
    }) as typeof fetch;

    const gateway = new MidtransPaymentGateway();
    await assertThrowsAsync(async () => {
      await gateway.createPaymentRequest({
        orderId: 'ord_12345',
        amount: 50000,
        currency: 'IDR',
        paymentMethod: 'snap',
        idempotencyKey: 'MDT-IDEMP-003',
      });
    }, 'Test 3: HTTP 400 error handled safely');
  }

  // Test 4: Missing Token in Response
  {
    process.env = { ...originalEnv, MIDTRANS_SERVER_KEY: TEST_SERVER_KEY, MIDTRANS_IS_PRODUCTION: 'false' };

    global.fetch = (async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          // missing token property!
        }),
      } as Response;
    }) as typeof fetch;

    const gateway = new MidtransPaymentGateway();
    await assertThrowsAsync(async () => {
      await gateway.createPaymentRequest({
        orderId: 'ord_12345',
        amount: 50000,
        currency: 'IDR',
        paymentMethod: 'snap',
        idempotencyKey: 'MDT-IDEMP-004',
      });
    }, 'Test 4: Response missing token triggers error');
  }

  // Test 5: Invalid Amount Validation
  {
    process.env = { ...originalEnv, MIDTRANS_SERVER_KEY: TEST_SERVER_KEY, MIDTRANS_IS_PRODUCTION: 'false' };
    const gateway = new MidtransPaymentGateway();

    await assertThrowsAsync(async () => {
      await gateway.createPaymentRequest({
        orderId: 'ord_12345',
        amount: 0,
        currency: 'IDR',
        paymentMethod: 'snap',
        idempotencyKey: 'MDT-IDEMP-005',
      });
    }, 'Test 5: Zero or negative amount rejected before API call');
  }

  // Test 6: Missing MIDTRANS_SERVER_KEY Validation
  {
    process.env = { ...originalEnv, MIDTRANS_SERVER_KEY: '', MIDTRANS_IS_PRODUCTION: 'false' };
    delete process.env.MIDTRANS_SERVER_KEY;
    const gateway = new MidtransPaymentGateway();

    await assertThrowsAsync(async () => {
      await gateway.createPaymentRequest({
        orderId: 'ord_12345',
        amount: 50000,
        currency: 'IDR',
        paymentMethod: 'snap',
        idempotencyKey: 'MDT-IDEMP-006',
      });
    }, 'Test 6: Missing MIDTRANS_SERVER_KEY rejected before API call');
  }

  // Restore environment & fetch
  process.env = originalEnv;
  global.fetch = originalFetch;

  console.log('\n==================================================');
  console.log(`MIDTRANS GATEWAY ADAPTER SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMidtransGatewayTests();
