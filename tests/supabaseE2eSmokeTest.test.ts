import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { orderService } from '../services/orderService';
import { paymentService } from '../services/paymentService';
import { dispatchService } from '../services/dispatchService';

// Read .env.local file natively
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
  console.log('SUPABASE LIVE ENVIRONMENT E2E SMOKE TEST');
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('CRITICAL: Supabase credentials not found in .env.local!');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log(`Connected to Supabase Live: ${supabaseUrl}\n`);

  const TEST_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-TESTKEY';

  function generateSignature(orderId: string, statusCode: string, grossAmount: string): string {
    return createHash('sha512').update(orderId + statusCode + grossAmount + TEST_SERVER_KEY).digest('hex');
  }

  // Fetch real Laundry Outlet, Customer, and Courier profiles from Supabase DB
  const { data: laundries } = await supabase.from('laundries').select('id, name, owner_id').limit(1);
  const laundryId = laundries && laundries.length > 0 ? laundries[0].id : 'lnd_001';
  const ownerId = laundries && laundries.length > 0 && laundries[0].owner_id ? laundries[0].owner_id : 'usr_owner_01';

  const { data: customers } = await supabase.from('profiles').select('id, full_name, phone').eq('role', 'customer').limit(1);
  const customerId = customers && customers.length > 0 ? customers[0].id : 'usr_customer_01';

  const { data: couriers } = await supabase.from('profiles').select('id, full_name').eq('role', 'courier').limit(1);
  const courierId = couriers && couriers.length > 0 ? couriers[0].id : 'usr_courier_01';

  let createdOrderId: string | null = null;

  try {
    // ---------------------------------------------------------------------------
    // STEP 1: Create Order in Supabase
    // ---------------------------------------------------------------------------
    console.log('--- STEP 1: Customer Checkout (Create Order) ---');
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

    const newOrder = await orderService.createOrderAsync(orderInput as any, customerUser as any);
    createdOrderId = newOrder.id;

    assert(createdOrderId !== null, `Step 1: Order created in Supabase with ID: ${createdOrderId}`);
    assert(newOrder.paymentStatus === 'unpaid', 'Step 1: Initial paymentStatus is unpaid');
    assert(newOrder.status === 'pending', 'Step 1: Initial order status is pending');

    // ---------------------------------------------------------------------------
    // STEP 2: Create Initial Payment Attempt
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 2: Initial Payment Attempt ---');
    const paymentAttempt = await paymentService.createPaymentAttemptAsync(createdOrderId, 'snap');
    assert(paymentAttempt !== null, 'Step 2: Initial payment attempt created in Supabase');

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
    });

    assert(webhookRes.success === true, 'Step 3: Payment webhook processed successfully');

    const orderPaid = await orderService.getOrderByIdAsync(createdOrderId);
    assert(orderPaid?.paymentStatus === 'paid', 'Step 3: Order paymentStatus updated to paid in Supabase');

    const dispatchStatus = await dispatchService.getDispatchStatusAsync(createdOrderId);
    assert(dispatchStatus.hasActiveDispatch === true, 'Step 3: Automatic dispatch batch created in Supabase');

    // ---------------------------------------------------------------------------
    // STEP 4: Courier Accepts Assignment -> Assigned
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 4: Courier Accepts Assignment ---');
    await orderService.acceptCourierAssignmentAsync(createdOrderId, courierId);

    const orderAssigned = await orderService.getOrderByIdAsync(createdOrderId);
    assert(orderAssigned?.courierId === courierId, 'Step 4: Courier ID assigned in Supabase');
    assert(orderAssigned?.status === 'assigned', 'Step 4: Order status updated to assigned');

    // ---------------------------------------------------------------------------
    // STEP 5: Courier Pickups from Customer -> Picked Up
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 5: Courier Pickup from Customer ---');
    const gatePickup = await orderService.canCourierPickupOrder(createdOrderId, courierId);
    assert(gatePickup.allowed === true, 'Step 5: Pickup gate ALLOWED for courier pickup from customer');

    const orderPickedUp = await orderService.transitionOrderStatusAsync(
      createdOrderId,
      'picked_up',
      { id: courierId, role: 'courier' },
      'Kurir telah mengambil laundry dari rumah customer'
    );
    assert(orderPickedUp?.status === 'picked_up', 'Step 5: Order status transitioned to picked_up in Supabase');

    // ---------------------------------------------------------------------------
    // STEP 6: Courier Arrives at Outlet
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 6: Courier Arrives at Laundry Outlet ---');
    await orderService.markCourierArrivedAtLaundryAsync(createdOrderId, courierId);

    const orderArrived = await orderService.getOrderByIdAsync(createdOrderId);
    const hasArrivalLog = (orderArrived?.logs || []).some((l) => l.notes?.includes('courier_arrived'));
    assert(hasArrivalLog === true, 'Step 6: Arrival log recorded in order_status_logs in Supabase');

    // ---------------------------------------------------------------------------
    // STEP 7: Laundry Weighing & Verification (Higher Weight: 7kg vs 5kg Est)
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 7: Laundry Owner Weighs & Verifies (7kg Actual) ---');
    const targetLaundryId = orderPickedUp?.laundryId || laundryId;
    const weighRes = await orderService.updateActualWeightAndRecalculatePriceAsync(createdOrderId, 7, {
      id: ownerId,
      role: 'laundry_owner',
      laundryId: targetLaundryId,
    });

    assert(weighRes.priceDelta === 16000, `Step 7: Server-side price delta calculated: +Rp ${weighRes.priceDelta}`);
    assert(weighRes.adjustmentPaymentAttempt !== undefined, 'Step 7: Price adjustment payment attempt created in Supabase');

    const orderWeighed = await orderService.getOrderByIdAsync(createdOrderId);
    assert(orderWeighed?.finalWeightKg === 7, 'Step 7: final_weight_kg updated to 7 in Supabase');

    // ---------------------------------------------------------------------------
    // STEP 8: Washing Gate Check (Blocked while adjustment pending)
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 8: Washing Gate Check (Adjustment Pending) ---');
    const gateWashingBefore = await orderService.canStartWashingOrder(createdOrderId);
    assert(gateWashingBefore.allowed === false, 'Step 8: Washing gate DENIED while adjustment payment is pending');

    // ---------------------------------------------------------------------------
    // STEP 9: Customer Pays Adjustment via Webhook
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 9: Customer Pays Price Adjustment ---');
    const adjAttempt = weighRes.adjustmentPaymentAttempt;
    const adjRef = adjAttempt.providerReference || adjAttempt.idempotencyKey;
    const adjGrossStr = Math.round(adjAttempt.amount).toFixed(2);

    await paymentService.processMidtransWebhookAsync({
      eventId: `evt_adj_smoke_${Date.now()}`,
      providerReference: adjRef,
      targetStatus: 'paid',
      incomingAmount: adjAttempt.amount,
      rawPayload: {
        transaction_status: 'settlement',
        order_id: adjRef,
        status_code: '200',
        gross_amount: adjGrossStr,
        signature_key: generateSignature(adjRef, '200', adjGrossStr),
      },
    });

    const gateWashingAfter = await orderService.canStartWashingOrder(createdOrderId);
    assert(gateWashingAfter.allowed === true, 'Step 9: Washing gate UNLOCKED after adjustment payment paid');

    // ---------------------------------------------------------------------------
    // STEP 10: Laundry Starts Washing -> in_washing
    // ---------------------------------------------------------------------------
    console.log('\n--- STEP 10: Laundry Starts Washing ---');
    const orderWashing = await orderService.transitionOrderStatusAsync(
      createdOrderId,
      'in_washing',
      { id: ownerId, role: 'laundry_owner', laundryId: targetLaundryId },
      'Laundry outlet mulai mencuci cucian customer'
    );
    assert(orderWashing?.status === 'in_washing', 'Step 10: Order status updated to in_washing in Supabase');

  } catch (err: any) {
    console.error('\nCRITICAL E2E ERROR:', err);
    assert(false, `E2E Execution failed with error: ${err.message}`);
  } finally {
    // ---------------------------------------------------------------------------
    // STEP 11: Cleanup Smoke Test Data from Supabase Live DB
    // ---------------------------------------------------------------------------
    if (createdOrderId) {
      console.log('\n--- STEP 11: Cleaning Up Smoke Test Data from Supabase DB ---');
      await supabase.from('payment_attempts').delete().eq('order_id', createdOrderId);
      await supabase.from('order_status_logs').delete().eq('order_id', createdOrderId);
      await supabase.from('courier_assignments').delete().eq('order_id', createdOrderId);
      await supabase.from('dispatch_batches').delete().eq('order_id', createdOrderId);
      await supabase.from('order_items').delete().eq('order_id', createdOrderId);
      await supabase.from('orders').delete().eq('id', createdOrderId);
      console.log(`Cleaned up Order #${createdOrderId} and all related DB records.`);
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
