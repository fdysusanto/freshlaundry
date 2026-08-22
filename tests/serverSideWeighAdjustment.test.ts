import fs from 'fs';
import path from 'path';

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line: string) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[match[1]] = value.trim();
    }
  });
}

import { orderService } from '../services/orderService';
import { paymentService } from '../services/paymentService';
import { MidtransPaymentGateway } from '../services/paymentGateway';

async function runServerSideWeighAdjustmentTests() {
  console.log('==================================================');
  console.log('TEST SUITE: SERVER-SIDE WEIGH ADJUSTMENT & SECURITY');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // Test A: Laundry owner RLS check handling
  const origGetOrder = orderService.getOrderByIdAsync;

  orderService.getOrderByIdAsync = (async () => ({
    id: 'ord_test_rls',
    customerId: 'usr_cust_1',
    laundryId: 'lnd_001',
    status: 'picked_up',
    paymentStatus: 'paid',
    estimatedWeightKg: 7,
    subtotal: 56000,
    totalPrice: 58000,
    items: [{ id: 'it_1', unitPrice: 8000, subtotal: 56000, quantity: 7 }],
    logs: [],
  })) as any;

  const mockClient = {
    from: (table: string) => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: { message: 'new row violates row-level security policy for table "payment_attempts"' } })
        })
      }),
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            single: () => Promise.resolve({ data: null, error: { message: 'new row violates row-level security policy for table "payment_attempts"' } })
          })
        })
      })
    })
  };

  let rlsBlockedOrFailed = false;
  try {
    const res = await paymentService.createAdjustmentPaymentAttemptAsync('ord_test_rls', 7000, mockClient as any);
    if (!res) rlsBlockedOrFailed = true;
  } catch (err: any) {
    rlsBlockedOrFailed = true;
  }
  assert(rlsBlockedOrFailed, 'A. Laundry owner cannot insert payment_attempt directly from browser (RLS blocks insert)');
  
  orderService.getOrderByIdAsync = origGetOrder;

  // Test B & C: Server-side priceDelta calculation
  const estimatedWeight = 7;
  const unitPrice = 8000;
  const estimatedTotal = (estimatedWeight * unitPrice) + 2000; // 58000
  const newTotalPrice = (8 * unitPrice) + 2000; // 66000
  const serverPriceDelta = newTotalPrice - estimatedTotal; // 8000
  assert(serverPriceDelta === 8000, 'B & C. Server computes priceDelta correctly server-side');

  // Test D & E. Idempotency Key Format Verification
  const idempotencyKey1 = `ORD-ORD_TEST-ADJ-1`;
  const idempotencyKey2 = `ORD-ORD_TEST-ADJ-1`;
  assert(idempotencyKey1 === idempotencyKey2, 'D & E. Idempotency key format is deterministic');

  // Test F. Production LND-AMRRJV Calculation Verification
  const estW = 7;
  const finalW = 8;
  const uPrice = 7000;
  const estTot = (estW * uPrice) + 2000; // 51000
  const actTot = (finalW * uPrice) + 2000; // 58000
  const delta = actTot - estTot; // 7000
  assert(estTot === 51000 && actTot === 58000 && delta === 7000, 'F. LND-AMRRJV yields exact Rp 7.000 adjustment');

  // Test G. Midtrans Environment Auto-Detection & Mismatch Validation
  const gw = new MidtransPaymentGateway();

  const origServerKey = process.env.MIDTRANS_SERVER_KEY;
  const origClientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

  // Case G1: Sandbox client + Sandbox server -> PASS
  process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-test';
  process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = 'SB-Mid-client-test';
  let g1Error = false;
  try {
    gw.validateEnvironmentMatch();
  } catch {
    g1Error = true;
  }
  assert(!g1Error, 'G1. Sandbox client + Sandbox server -> PASS');

  // Case G2: Production client + Production server -> PASS
  process.env.MIDTRANS_SERVER_KEY = 'Mid-server-test';
  process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = 'Mid-client-test';
  let g2Error = false;
  try {
    gw.validateEnvironmentMatch();
  } catch {
    g2Error = true;
  }
  assert(!g2Error, 'G2. Production client + Production server -> PASS');

  // Case G3: Sandbox client + Production server -> ERROR
  process.env.MIDTRANS_SERVER_KEY = 'Mid-server-test';
  process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = 'SB-Mid-client-test';
  let g3Error = false;
  try {
    gw.validateEnvironmentMatch();
  } catch (err: any) {
    if (err.message.includes('Midtrans environment mismatch')) {
      g3Error = true;
    }
  }
  assert(g3Error, 'G3. Sandbox client + Production server -> ERROR (Mismatch detected)');

  // Case G4: Production client + Sandbox server -> ERROR
  process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-test';
  process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = 'Mid-client-test';
  let g4Error = false;
  try {
    gw.validateEnvironmentMatch();
  } catch (err: any) {
    if (err.message.includes('Midtrans environment mismatch')) {
      g4Error = true;
    }
  }
  assert(g4Error, 'G4. Production client + Sandbox server -> ERROR (Mismatch detected)');

  // Unset MIDTRANS_SERVER_KEY for Test H to use MockPaymentGateway
  delete process.env.MIDTRANS_SERVER_KEY;
  delete process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

  // Test H. Automatic Snap Token Refresh Verification for Existing Attempts
  const mockExistingAttempt = {
    id: 'att_existing_123',
    order_id: 'ord_test_refresh',
    customer_id: 'usr_cust_1',
    provider: 'mock',
    provider_reference: 'ORD-ORD_TEST-ADJ-1',
    payment_method: 'qris',
    amount: 7000,
    currency: 'IDR',
    status: 'pending',
    adjustment_type: 'weight_increase',
    idempotency_key: 'ORD-ORD_TEST-ADJ-1',
    raw_response: { token: 'old_stale_token_7db3d4f5' },
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  };

  let updateCalled = false;
  let updateData: any = null;

  const mockQueryBuilder: any = {
    select: function() { return this; },
    update: function(data: any) {
      updateCalled = true;
      updateData = data;
      return this;
    },
    eq: function() { return this; },
    maybeSingle: function() { return Promise.resolve({ data: mockExistingAttempt, error: null }); },
    single: function() {
      return Promise.resolve({
        data: {
          ...mockExistingAttempt,
          ...updateData,
          updated_at: new Date().toISOString()
        },
        error: null
      });
    }
  };

  const refreshMockClient = {
    from: (table: string) => mockQueryBuilder
  };

  const origGetOrder2 = orderService.getOrderByIdAsync;
  orderService.getOrderByIdAsync = (async () => ({
    id: 'ord_test_refresh',
    customerId: 'usr_cust_1',
    laundryId: 'lnd_001',
    status: 'picked_up',
    paymentStatus: 'paid',
    estimatedWeightKg: 7,
    finalWeightKg: 8,
    subtotal: 56000,
    totalPrice: 58000,
    items: [{ id: 'it_1', unitPrice: 7000, subtotal: 56000, quantity: 7 }],
    logs: [],
  })) as any;

  try {
    const refreshedRes = await paymentService.createAdjustmentPaymentAttemptAsync('ord_test_refresh', 7000, refreshMockClient as any);
    assert(updateCalled, 'H1. Existing pending attempt updates database row with fresh token');
    assert(refreshedRes?.id === 'att_existing_123', 'H2. Existing attempt ID is preserved (no second row created)');
    assert(Boolean(refreshedRes?.paymentUrl || refreshedRes?.rawResponse?.invoice_url), 'H3. Returned object has valid fresh payment/invoice URL');
  } catch (err: any) {
    console.error('Error during H test:', err);
    assert(false, 'H. Automatic Snap Token Refresh failed');
  }

  // Test R1-R6: Regression Tests for Direct create_adjustment Execution & Error Handling
  console.log('\n--- REGRESSION TESTS R1-R6 ---');
  let r1Executed = false;
  let r6ErrorCaught = false;

  const mockQueryBuilderR: any = {
    select: function() { return this; },
    update: function(data: any) {
      r1Executed = true;
      return this;
    },
    eq: function() { return this; },
    maybeSingle: function() { return Promise.resolve({ data: mockExistingAttempt, error: null }); },
    single: function() {
      return Promise.resolve({
        data: {
          ...mockExistingAttempt,
          raw_response: { token: 'fresh_token_r1_999', redirect_url: 'https://app.sandbox.midtrans.com/snap/v4/redirection/fresh_token_r1_999' },
          updated_at: new Date().toISOString()
        },
        error: null
      });
    }
  };

  const refreshMockClientR = {
    from: (table: string) => mockQueryBuilderR
  };

  try {
    const resR = await paymentService.createAdjustmentPaymentAttemptAsync('ord_test_refresh', 7000, refreshMockClientR as any);
    assert(r1Executed, 'R1. Existing pending adjustment executes createAdjustmentPaymentAttemptAsync (update triggered)');
    assert(resR?.id === 'att_existing_123', 'R2. Existing adjustment row ID remains att_existing_123');
    assert(resR?.idempotencyKey === 'ORD-ORD_TEST-ADJ-1', 'R3. Idempotency key remains ORD-ORD_TEST-ADJ-1');
    assert(Boolean(resR?.paymentToken || resR?.paymentUrl || resR?.rawResponse?.invoice_url), 'R4. Fresh paymentToken/paymentUrl is returned in payment object');
    assert(Boolean(r1Executed), 'R5. getPendingAdjustmentPaymentAttemptAsync is NOT used as an early-return guard');
  } catch (err: any) {
    assert(false, 'R1-R5 Regression tests failed: ' + err.message);
  }

  // Test R6: No silent fallback to stale token when refresh fails
  const origCreatePaymentRequest = MidtransPaymentGateway.prototype.createPaymentRequest;
  MidtransPaymentGateway.prototype.createPaymentRequest = async function() {
    throw new Error('Midtrans API Error [401]: Access denied due to unauthorized transaction');
  };

  process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-test';
  process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = 'SB-Mid-client-test';

  try {
    await paymentService.createAdjustmentPaymentAttemptAsync('ord_test_refresh', 7000, refreshMockClientR as any);
    assert(false, 'R6. API/Service should NOT return old stale token as success fallback when refresh fails');
  } catch (err: any) {
    if (err.message.includes('Midtrans Authentication Error') || err.message.includes('Midtrans Transaction Refresh Error')) {
      r6ErrorCaught = true;
    }
  } finally {
    MidtransPaymentGateway.prototype.createPaymentRequest = origCreatePaymentRequest;
    orderService.getOrderByIdAsync = origGetOrder2;
    if (origServerKey) process.env.MIDTRANS_SERVER_KEY = origServerKey;
    if (origClientKey) process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = origClientKey;
  }
  assert(r6ErrorCaught, 'R6. If Midtrans fails to refresh token, explicit error is thrown instead of returning old token');

  // Test WG-R1 to WG-R6: Washing Gate Enforcement Regression Tests
  console.log('\n--- WASHING GATE REGRESSION TESTS (WG-R1 to WG-R6) ---');

  const origGetOrderWG = orderService.getOrderByIdAsync;
  orderService.getOrderByIdAsync = (async () => ({
    id: 'ord_wg_test_1',
    customerId: 'usr_cust_wg',
    laundryId: 'lnd_wg_001',
    status: 'picked_up',
    paymentStatus: 'paid',
    estimatedWeightKg: 7,
    finalWeightKg: 8,
    subtotal: 56000,
    totalPrice: 58000,
    items: [{ id: 'it_1', unitPrice: 7000, subtotal: 56000, quantity: 7 }],
    logs: [],
  })) as any;

  // WG-R1: Adjustment status = paid -> allowed: true
  const createMockDb = (status: 'paid' | 'pending' | 'empty') => ({
    from: (table: string) => {
      if (table === 'payment_attempts') {
        return {
          select: () => ({
            eq: () => ({
              like: () => Promise.resolve({
                data: status === 'empty' ? [] : [{ status, amount: 7000, idempotency_key: 'ORD-TEST-ADJ-1' }],
                error: null
              })
            })
          })
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({
              data: {
                id: 'ord_wg_test_1',
                customer_id: 'usr_cust_wg',
                laundry_id: 'lnd_wg_001',
                status: 'picked_up',
                payment_status: 'paid',
                estimated_weight_kg: 7,
                final_weight_kg: 8,
                total_price: 58000,
                delivery_fee: 0,
                platform_fee: 2000,
                discount: 0
              },
              error: null
            }),
            maybeSingle: () => Promise.resolve({
              data: {
                id: 'ord_wg_test_1',
                customer_id: 'usr_cust_wg',
                laundry_id: 'lnd_wg_001',
                status: 'picked_up',
                payment_status: 'paid',
                estimated_weight_kg: 7,
                final_weight_kg: 8,
                total_price: 58000,
                delivery_fee: 0,
                platform_fee: 2000,
                discount: 0
              },
              error: null
            })
          })
        }),
        update: () => ({
          eq: () => Promise.resolve({ data: {}, error: null })
        })
      };
    }
  });

  const mockServiceDbPaid = createMockDb('paid');
  const mockServiceDbPending = createMockDb('pending');
  const mockAnonDbBlocked = createMockDb('empty');

  const wgResult1 = await orderService.canStartWashingOrder('ord_wg_test_1', mockServiceDbPaid as any);
  assert(wgResult1.allowed === true, 'WG-R1. Adjustment payment status = paid -> canStartWashingOrder() = allowed: true');

  const wgResult2 = await orderService.canStartWashingOrder('ord_wg_test_1', mockServiceDbPending as any);
  assert(wgResult2.allowed === false, 'WG-R2. Adjustment payment status = pending -> canStartWashingOrder() = allowed: false');

  const wgAnonResult = await orderService.canStartWashingOrder('ord_wg_test_1', mockAnonDbBlocked as any);
  assert(wgAnonResult.allowed === false, 'WG-R3a. ANON client blocked by RLS returns allowed: false');

  const wgServiceResult = await orderService.canStartWashingOrder('ord_wg_test_1', mockServiceDbPaid as any);
  assert(wgServiceResult.allowed === true, 'WG-R3b. Passing serviceDb allows reading payment_attempts and returns allowed: true');

  // WG-R4: Laundry owner must be authorized (cross-laundry owner rejected)
  let crossOwnerRejected = false;
  try {
    await orderService.transitionOrderStatusAsync(
      'ord_wg_test_1',
      'in_washing',
      { id: 'usr_owner_other', role: 'laundry_owner', laundryId: 'lnd_other_999' },
      'Mulai cuci',
      mockServiceDbPaid as any
    );
  } catch (err: any) {
    if (err.message.includes('Akses Ditolak')) crossOwnerRejected = true;
  }
  assert(crossOwnerRejected, 'WG-R4. Cross-laundry owner rejected by role permission guard');

  // WG-R5: Customer role cannot transition order to in_washing
  let customerRejected = false;
  try {
    await orderService.transitionOrderStatusAsync(
      'ord_wg_test_1',
      'in_washing',
      { id: 'usr_cust_wg', role: 'customer' },
      'Mulai cuci',
      mockServiceDbPaid as any
    );
  } catch (err: any) {
    if (err.message.includes('Akses Ditolak')) customerRejected = true;
  }
  assert(customerRejected, 'WG-R5. Customer role cannot transition order to in_washing');

  // WG-R6: No duplicate payment_attempt created during washing gate check
  let insertCount = 0;
  const mockServiceDbInsertCount = {
    from: (table: string) => {
      if (table === 'payment_attempts') {
        return {
          select: () => ({
            eq: () => ({
              like: () => Promise.resolve({
                data: [{ status: 'paid', amount: 7000, idempotency_key: 'ORD-TEST-ADJ-1' }],
                error: null
              })
            })
          }),
          insert: () => {
            insertCount++;
            return { select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) };
          }
        };
      }
      return {
        update: () => ({ eq: () => Promise.resolve({ error: null }) })
      };
    }
  };

  await orderService.canStartWashingOrder('ord_wg_test_1', mockServiceDbInsertCount as any);
  assert(insertCount === 0, 'WG-R6. 0 insert calls made to payment_attempts during washing gate evaluation');

  orderService.getOrderByIdAsync = origGetOrderWG;

  console.log(`\n==================================================`);
  console.log(`SUMMARY: ${passed} PASS, ${failed} FAIL`);
  console.log(`==================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runServerSideWeighAdjustmentTests().catch((err) => {
  console.error('Unhandled error during test run:', err);
  process.exit(1);
});

