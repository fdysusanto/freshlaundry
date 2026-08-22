import { createHash } from 'crypto';
import { paymentService } from '../services/paymentService';
import { orderService } from '../services/orderService';
import { dispatchService } from '../services/dispatchService';
import { DEMO_USERS } from '../utils/constants';

const originalFetch = global.fetch;
const originalEnv = process.env;

async function runCourierFirstPhase1Tests() {
  console.log('==================================================');
  console.log('RUNNING COURIER-FIRST PHASE 1 AUTOMATIC DISPATCH TESTS');
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

  const TEST_SERVER_KEY = 'SB-Mid-server-TESTKEY-AUTOMATIC-DISPATCH';
  process.env = { ...originalEnv, MIDTRANS_SERVER_KEY: TEST_SERVER_KEY, MIDTRANS_IS_PRODUCTION: 'false' };

  // Mock global.fetch to simulate Midtrans Snap Token response for unit test
  global.fetch = (async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        token: 'snap-token-auto-dispatch-test',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/v1/transactions/snap-token-auto-dispatch-test/pdf',
      }),
    } as Response;
  }) as typeof fetch;

  function generateSignature(orderId: string, statusCode: string, grossAmount: string): string {
    return createHash('sha512').update(orderId + statusCode + grossAmount + TEST_SERVER_KEY).digest('hex');
  }

  const customer = DEMO_USERS[0];

  // ---------------------------------------------------------------------------
  // CASE 1: Customer checkout -> Payment unpaid -> NO dispatch
  // ---------------------------------------------------------------------------
  console.log('--- CASE 1: Checkout (Unpaid) -> No Dispatch ---');
  const orderUnpaid = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Unpaid Test No. 1',
      deliveryAddress: 'Jl. Unpaid Test No. 1',
      pickupDate: '2026-08-30',
      pickupTimeSlot: '08:00 - 10:00 WIB',
      estimatedWeightKg: 5,
    },
    customer
  );
  const paymentUnpaid = await paymentService.createPaymentAttemptAsync(orderUnpaid.id, 'snap');
  const dispatchStatus1 = await dispatchService.getDispatchStatusAsync(orderUnpaid.id);

  assert(paymentUnpaid.status === 'pending', 'Case 1: Payment status is initially pending (unpaid)');
  assert(!dispatchStatus1.hasActiveDispatch, 'Case 1: NO dispatch batch created for unpaid order');

  try {
    await dispatchService.dispatchOrderAsync(orderUnpaid.id, 'pickup', 'test_user');
    assert(false, 'Case 1: Attempting dispatch on unpaid order should throw error');
  } catch (err: any) {
    assert(err.message.includes('belum lunas'), 'Case 1: Manual dispatch throws rejection for unpaid order');
  }

  // ---------------------------------------------------------------------------
  // CASE 2: Midtrans payment success -> Payment paid -> AUTOMATIC DISPATCH CREATED
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 2: Midtrans Payment Success -> Automatic Dispatch ---');
  const orderSuccess = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Automatic Dispatch No. 2',
      deliveryAddress: 'Jl. Automatic Dispatch No. 2',
      pickupDate: '2026-08-30',
      pickupTimeSlot: '10:00 - 12:00 WIB',
      estimatedWeightKg: 5,
    },
    customer
  );
  const paymentSuccess = await paymentService.createPaymentAttemptAsync(orderSuccess.id, 'snap');
  const providerRef2 = paymentSuccess.providerReference || paymentSuccess.idempotencyKey;
  const grossAmountStr2 = Math.round(orderSuccess.totalPrice).toFixed(2);

  const webhookResult2 = await paymentService.processMidtransWebhookAsync({
    eventId: `evt_success_${Date.now()}`,
    providerReference: providerRef2,
    targetStatus: 'paid',
    incomingAmount: orderSuccess.totalPrice,
    rawPayload: {
      transaction_status: 'settlement',
      order_id: providerRef2,
      status_code: '200',
      gross_amount: grossAmountStr2,
      signature_key: generateSignature(providerRef2, '200', grossAmountStr2),
    },
  });

  const updatedOrder2 = await orderService.getOrderByIdAsync(orderSuccess.id);
  const dispatchStatus2 = await dispatchService.getDispatchStatusAsync(orderSuccess.id);

  assert(webhookResult2.success, 'Case 2: Webhook payment success returned true');
  assert(updatedOrder2?.paymentStatus === 'paid', 'Case 2: Order paymentStatus updated to paid');
  assert(dispatchStatus2.hasActiveDispatch, 'Case 2: AUTOMATIC DISPATCH BATCH CREATED upon payment success!');

  // ---------------------------------------------------------------------------
  // CASE 3: Duplicate webhook -> Payment remains paid -> ONLY ONE dispatch batch
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 3: Duplicate Webhook -> Idempotency Check ---');
  const eventId3 = `evt_dup_${Date.now()}`;
  const webhookResult3a = await paymentService.processMidtransWebhookAsync({
    eventId: eventId3,
    providerReference: providerRef2,
    targetStatus: 'paid',
    incomingAmount: orderSuccess.totalPrice,
    rawPayload: { transaction_status: 'settlement' },
  });

  const webhookResult3b = await paymentService.processMidtransWebhookAsync({
    eventId: eventId3,
    providerReference: providerRef2,
    targetStatus: 'paid',
    incomingAmount: orderSuccess.totalPrice,
    rawPayload: { transaction_status: 'settlement' },
  });

  const dispatchStatus3 = await dispatchService.getDispatchStatusAsync(orderSuccess.id);

  assert(webhookResult3b.idempotent === true, 'Case 3: Duplicate webhook payload identified as idempotent');
  assert(dispatchStatus3.batchNumber === 1, 'Case 3: ONLY ONE dispatch batch exists for the order (no duplicates)');

  // ---------------------------------------------------------------------------
  // CASE 4: Payment failed -> NO dispatch
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 4: Payment Failed -> NO Dispatch ---');
  const orderFailed = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Failed Test No. 4',
      deliveryAddress: 'Jl. Failed Test No. 4',
      pickupDate: '2026-08-30',
      pickupTimeSlot: '13:00 - 15:00 WIB',
      estimatedWeightKg: 5,
    },
    customer
  );
  const paymentFailed = await paymentService.createPaymentAttemptAsync(orderFailed.id, 'snap');
  const providerRef4 = paymentFailed.providerReference || paymentFailed.idempotencyKey;

  await paymentService.processMidtransWebhookAsync({
    eventId: `evt_failed_${Date.now()}`,
    providerReference: providerRef4,
    targetStatus: 'failed',
    incomingAmount: orderFailed.totalPrice,
    rawPayload: { transaction_status: 'deny' },
  });

  const updatedOrder4 = await orderService.getOrderByIdAsync(orderFailed.id);
  const dispatchStatus4 = await dispatchService.getDispatchStatusAsync(orderFailed.id);

  assert(updatedOrder4?.paymentStatus === 'failed', 'Case 4: Order paymentStatus updated to failed');
  assert(!dispatchStatus4.hasActiveDispatch, 'Case 4: NO dispatch batch created for failed payment');

  // ---------------------------------------------------------------------------
  // CASE 5: Payment expired -> NO dispatch
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 5: Payment Expired -> NO Dispatch ---');
  const orderExpired = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Expired Test No. 5',
      deliveryAddress: 'Jl. Expired Test No. 5',
      pickupDate: '2026-08-30',
      pickupTimeSlot: '15:00 - 17:00 WIB',
      estimatedWeightKg: 5,
    },
    customer
  );
  const paymentExpired = await paymentService.createPaymentAttemptAsync(orderExpired.id, 'snap');
  const providerRef5 = paymentExpired.providerReference || paymentExpired.idempotencyKey;

  await paymentService.processMidtransWebhookAsync({
    eventId: `evt_expired_${Date.now()}`,
    providerReference: providerRef5,
    targetStatus: 'expired',
    incomingAmount: orderExpired.totalPrice,
    rawPayload: { transaction_status: 'expire' },
  });

  const updatedOrder5 = await orderService.getOrderByIdAsync(orderExpired.id);
  const dispatchStatus5 = await dispatchService.getDispatchStatusAsync(orderExpired.id);

  assert(updatedOrder5?.paymentStatus === 'expired', 'Case 5: Order paymentStatus updated to expired');
  assert(!dispatchStatus5.hasActiveDispatch, 'Case 5: NO dispatch batch created for expired payment');

  // Restore env & fetch
  process.env = originalEnv;
  global.fetch = originalFetch;

  console.log('\n==================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCourierFirstPhase1Tests();
