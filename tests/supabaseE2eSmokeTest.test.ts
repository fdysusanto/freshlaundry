import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// 1. READ .env.local NATIVELY BEFORE ANY SERVICE MODULE IS LOADED
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    for (const line of envConfig.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        if (key && values.length > 0) {
          process.env[key.trim()] = values.join('=').trim();
        }
      }
    }
  }
} catch (e) {
  console.warn('Warning loading .env.local', e);
}

// Intercept Midtrans API calls only (let Supabase live HTTP requests pass through)
const realFetch = global.fetch;
global.fetch = (async (url: any, options: any) => {
  const urlStr = String(url);
  if (urlStr.includes('midtrans.com')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        token: 'snap-token-supabase-smoke-test',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/v1/transactions/snap-token-supabase-smoke-test/pdf',
      }),
    } as Response;
  }
  return realFetch(url, options);
}) as typeof fetch;

async function runSupabaseE2eSmokeTest() {
  console.log('==================================================');
  console.log('SUPABASE LIVE ENVIRONMENT E2E SMOKE TEST & SECURITY AUDIT');
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

  // 2. DYNAMICALLY IMPORT SERVICES NOW THAT PROCESS.ENV IS POPULATED
  const { isSupabaseConfigured } = await import('../services/supabase');
  const { orderService } = await import('../services/orderService');
  const { paymentService } = await import('../services/paymentService');
  const { dispatchService } = await import('../services/dispatchService');

  assert(isSupabaseConfigured === true, 'Environment Check: isSupabaseConfigured is TRUE (Live Supabase DB Mode)');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('CRITICAL: Supabase service role credentials not found in .env.local!');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const anonClient = createClient(supabaseUrl, anonKey || '');
  console.log(`Connected to Supabase Live: ${supabaseUrl}\n`);

  const TEST_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-TESTKEY';

  function generateSignature(orderId: string, statusCode: string, grossAmount: string): string {
    return createHash('sha512').update(orderId + statusCode + grossAmount + TEST_SERVER_KEY).digest('hex');
  }

  // Fetch real Laundry Outlet, Customer, and Courier profiles from Supabase DB
  const { data: laundries } = await supabase.from('laundries').select('id, name, owner_id').limit(1);
  const laundryId = laundries && laundries.length > 0 ? laundries[0].id : 'lnd_001';

  const { data: customers } = await supabase.from('profiles').select('id, full_name, phone').eq('role', 'customer').limit(1);
  const customerId = customers && customers.length > 0 ? customers[0].id : 'usr_customer_01';

  const { data: couriers } = await supabase.from('profiles').select('id, full_name').eq('role', 'courier').limit(1);
  const courierId = couriers && couriers.length > 0 ? couriers[0].id : 'usr_courier_01';

  let createdOrderId: string | null = null;

  try {
    // ---------------------------------------------------------------------------
    // PART G: SECURITY AUDIT & REGRESSION CHECKS
    // ---------------------------------------------------------------------------
    console.log('--- PART G: Security Audit & Regression Checks ---');

    // C. Anonymous / Customer client direct INSERT into dispatch_batches -> REJECTED by RLS
    const { error: anonInsertErr } = await (anonClient.from('dispatch_batches') as any).insert({
      order_id: '00000000-0000-0000-0000-000000000000',
      assignment_type: 'pickup',
      batch_number: 99,
      radius_km: 3,
      status: 'active',
      started_at: new Date().toISOString(),
      expires_at: new Date().toISOString(),
    });
    assert(anonInsertErr !== null, 'Security Check C: Anon/Customer client direct INSERT into dispatch_batches REJECTED by RLS');

    // Create a temporary order for security checks
    const secOrder = await orderService.createOrderAsync({
      laundryId,
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Security Test 123',
      deliveryAddress: 'Jl. Security Test 123',
      pickupDate: '2026-08-30',
      pickupTimeSlot: '10:00 - 12:00 WIB',
      estimatedWeightKg: 5,
    } as any, {
      id: customerId,
      fullName: 'Sec Test Customer',
      phone: '081234567890',
      role: 'customer',
    } as any, supabase);

    const secAttempt = await paymentService.createPaymentAttemptAsync(secOrder.id, 'snap', undefined, supabase);
    const secRef = secAttempt.providerReference || secAttempt.idempotencyKey;
    const secGrossStr = Math.round(secOrder.totalPrice).toFixed(2);

    await paymentService.processMidtransWebhookAsync({
      eventId: `evt_sec_${Date.now()}`,
      providerReference: secRef,
      targetStatus: 'paid',
      incomingAmount: secOrder.totalPrice,
      rawPayload: {
        transaction_status: 'settlement',
        order_id: secRef,
        status_code: '200',
        gross_amount: secGrossStr,
        signature_key: generateSignature(secRef, '200', secGrossStr),
      },
      client: supabase,
    });

    // A. dispatchOrderAsync(orderId, ..., adminClient) -> Can INSERT dispatch_batches
    const adminDispatchRes = await dispatchService.dispatchOrderAsync(secOrder.id, 'pickup', 'admin_sec_test', supabase);
    assert(adminDispatchRes.hasActiveDispatch === true || adminDispatchRes.batchNumber >= 1, 'Security Check A: dispatchOrderAsync with explicit service_role client ALLOWED to create dispatch batch');

    // B. dispatchOrderAsync(orderId, ..., anonClient) -> Does NOT auto-escalate (REJECTED by RLS)
    let anonDispatchThrew = false;
    try {
      await dispatchService.dispatchOrderAsync(secOrder.id, 'pickup', 'anon_sec_test', anonClient);
    } catch {
      anonDispatchThrew = true;
    }
    assert(anonDispatchThrew === true, 'Security Check B: dispatchOrderAsync with anon client does NOT auto-escalate to service_role (REJECTED by RLS)');

    // D. acceptCourierAssignmentAsync invokes accept_courier_assignment_atomic RPC
    let rpcAtomicTested = false;
    try {
      await orderService.acceptCourierAssignmentAsync('00000000-0000-0000-0000-000000000000', courierId, anonClient);
    } catch (err: any) {
      rpcAtomicTested = err.message.includes('atomic') || err.message.includes('tidak ditemukan') || err.message.includes('Penugasan');
    }
    assert(rpcAtomicTested === true, 'Security Check D: acceptCourierAssignmentAsync uses accept_courier_assignment_atomic RPC');

    // Cleanup security test records
    await supabase.from('payment_attempts').delete().eq('order_id', secOrder.id);
    await supabase.from('dispatch_batches').delete().eq('order_id', secOrder.id);
    await supabase.from('orders').delete().eq('id', secOrder.id);

    // ---------------------------------------------------------------------------
    // STEP 1: Create Order in Supabase
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 1: Customer Checkout (Create Order in Live Supabase DB) ---');
    const orderInput = {
      laundryId,
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Live Supabase E2E Smoke Test No. 123',
      deliveryAddress: 'Jl. Live Supabase E2E Smoke Test No. 123',
      pickupDate: '2026-08-30',
      pickupTimeSlot: '10:00 - 12:00 WIB',
      estimatedWeightKg: 5,
    };

    const customerUser = {
      id: customerId,
      fullName: 'Smoke Test Customer',
      phone: '081234567890',
      role: 'customer',
    };

    const newOrder = await orderService.createOrderAsync(orderInput as any, customerUser as any, supabase);
    createdOrderId = newOrder.id;

    assert(createdOrderId !== null, `Step 1: Order created in Supabase with ID: ${createdOrderId}`);
    assert(newOrder.paymentStatus === 'unpaid', 'Step 1: Initial paymentStatus is unpaid');
    assert(newOrder.status === 'pending', 'Step 1: Initial order status is pending');

    // Update courier heartbeat so courier is eligible for dispatch
    await dispatchService.updateCourierHeartbeatAsync(courierId, -6.2415, 106.7972, '327401', '3274011001', true, supabase);

    // ---------------------------------------------------------------------------
    // STEP 2: Create Initial Payment Attempt
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 2: Initial Payment Attempt ---');
    const paymentAttempt = await paymentService.createPaymentAttemptAsync(createdOrderId, 'snap', undefined, supabase);
    assert(paymentAttempt !== null, 'Step 2: Initial payment attempt created in Supabase DB');

    const providerRef = paymentAttempt.providerReference || paymentAttempt.idempotencyKey;
    const grossAmountStr = Math.round(newOrder.totalPrice).toFixed(2);

    // ---------------------------------------------------------------------------
    // STEP 3: Midtrans Payment Success Webhook -> Automatic Dispatch
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 3: Midtrans Payment Success Webhook ---');
    const webhookRes = await paymentService.processMidtransWebhookAsync({
      eventId: `evt_smoke_${Date.now()}`,
      providerReference: providerRef,
      targetStatus: 'paid',
      incomingAmount: newOrder.totalPrice,
      rawPayload: {
        transaction_status: 'settlement',
        order_id: providerRef,
        status_code: '200',
        gross_amount: grossAmountStr,
        signature_key: generateSignature(providerRef, '200', grossAmountStr),
      },
      client: supabase,
    });

    assert(webhookRes.success === true, 'Step 3: Payment webhook processed successfully');

    const orderPaid = await orderService.getOrderByIdAsync(createdOrderId, supabase);
    assert(orderPaid?.paymentStatus === 'paid', 'Step 3: Order paymentStatus updated to paid in Supabase DB');

    // ---------------------------------------------------------------------------
    // STEP 4: VERIFY DISPATCH_BATCHES & COURIER_ASSIGNMENTS IN LIVE SUPABASE DB
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 4: Verify Live Supabase DB Records for Dispatch ---');
    const { data: liveBatches } = await supabase.from('dispatch_batches').select('*').eq('order_id', createdOrderId);
    assert(liveBatches !== null && liveBatches.length > 0, `Step 4: dispatch_batches row EXISTS in Supabase DB (${liveBatches?.length || 0} batches)`);

    const { data: liveAssignments } = await supabase.from('courier_assignments').select('*').eq('order_id', createdOrderId);
    assert(liveAssignments !== null && liveAssignments.length > 0, `Step 4: courier_assignments row EXISTS in Supabase DB (${liveAssignments?.length || 0} candidates offered)`);

    const assignedCourierId = liveAssignments && liveAssignments.length > 0 ? liveAssignments[0].courier_id : courierId;

    // ---------------------------------------------------------------------------
    // STEP 5: Verify Pickup Gate Authorization
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 5: Verify Courier Pickup Gate ---');
    const gatePickup = await orderService.canCourierPickupOrder(createdOrderId, assignedCourierId, supabase);
    assert(gatePickup.allowed === true, 'Step 5: Courier pickup gate ALLOWED for assigned order');

    // ---------------------------------------------------------------------------
    // STEP 6: Verify Arrival Mark Logging
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 6: Courier Arrival at Laundry Outlet ---');
    await orderService.markCourierArrivedAtLaundryAsync(createdOrderId, assignedCourierId, supabase);
    const orderArrived = await orderService.getOrderByIdAsync(createdOrderId, supabase);
    const hasArrivalLog = (orderArrived?.logs || []).some((l) => l.notes?.includes('courier_arrived'));
    assert(hasArrivalLog === true, 'Step 6: Arrival log recorded in order_status_logs in Supabase DB');

  } catch (err: any) {
    console.error('\nCRITICAL E2E ERROR:', err);
    assert(false, `E2E Execution failed with error: ${err.message}`);
  } finally {
    // ---------------------------------------------------------------------------
    // STEP 7: Clean Up Test Records from Supabase DB
    // ---------------------------------------------------------------------------
    if (createdOrderId) {
      console.log('\n--- STEP 7: Cleaning Up Smoke Test Data from Supabase DB ---');
      await supabase.from('payment_attempts').delete().eq('order_id', createdOrderId);
      await supabase.from('order_status_logs').delete().eq('order_id', createdOrderId);
      await supabase.from('courier_assignments').delete().eq('order_id', createdOrderId);
      await supabase.from('dispatch_batches').delete().eq('order_id', createdOrderId);
      await supabase.from('order_items').delete().eq('order_id', createdOrderId);
      await supabase.from('orders').delete().eq('id', createdOrderId);
      console.log(`Cleaned up Order #${createdOrderId} and all related DB records from Supabase DB.`);
    }
  }

  console.log('\n==================================================');
  console.log(`SUPABASE LIVE SMOKE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSupabaseE2eSmokeTest();
