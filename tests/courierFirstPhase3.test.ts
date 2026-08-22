import { createHash } from 'crypto';
import { paymentService } from '../services/paymentService';
import { orderService } from '../services/orderService';
import { dispatchService } from '../services/dispatchService';
import { DEMO_USERS } from '../utils/constants';

const originalFetch = global.fetch;
const originalEnv = process.env;

async function runCourierFirstPhase3Tests() {
  console.log('==================================================');
  console.log('RUNNING COURIER-FIRST PHASE 3 (COURIER PORTAL & ARRIVAL FLOW) TESTS');
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

  const TEST_SERVER_KEY = 'SB-Mid-server-TESTKEY-PHASE3';
  process.env = { ...originalEnv, MIDTRANS_SERVER_KEY: TEST_SERVER_KEY, MIDTRANS_IS_PRODUCTION: 'false' };

  global.fetch = (async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        token: 'snap-token-phase3-test',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/v1/transactions/snap-token-phase3-test/pdf',
      }),
    } as Response;
  }) as typeof fetch;

  function generateSignature(orderId: string, statusCode: string, grossAmount: string): string {
    return createHash('sha512').update(orderId + statusCode + grossAmount + TEST_SERVER_KEY).digest('hex');
  }

  const customer = DEMO_USERS[0];
  const owner = DEMO_USERS.find((u) => u.role === 'laundry_owner') || { id: 'usr_owner_01', role: 'laundry_owner', laundryId: 'lnd_001' };
  const courier = DEMO_USERS.find((u) => u.role === 'courier') || { id: 'usr_courier_01', role: 'courier' };

  // ---------------------------------------------------------------------------
  // CASE 1: Payment success -> Automatic Dispatch Created
  // ---------------------------------------------------------------------------
  console.log('--- CASE 1: Payment Success -> Automatic Dispatch ---');
  const order1 = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Phase 3 Test No. 1',
      deliveryAddress: 'Jl. Phase 3 Test No. 1',
      pickupDate: '2026-08-30',
      pickupTimeSlot: '10:00 - 12:00 WIB',
      estimatedWeightKg: 5,
    },
    customer
  );
  const payment1 = await paymentService.createPaymentAttemptAsync(order1.id, 'snap');
  const providerRef1 = payment1.providerReference || payment1.idempotencyKey;
  const grossAmountStr1 = Math.round(order1.totalPrice).toFixed(2);

  await paymentService.processMidtransWebhookAsync({
    eventId: `evt_phase3_1_${Date.now()}`,
    providerReference: providerRef1,
    targetStatus: 'paid',
    incomingAmount: order1.totalPrice,
    rawPayload: {
      transaction_status: 'settlement',
      order_id: providerRef1,
      status_code: '200',
      gross_amount: grossAmountStr1,
      signature_key: generateSignature(providerRef1, '200', grossAmountStr1),
    },
  });

  const dispatchStatus1 = await dispatchService.getDispatchStatusAsync(order1.id);
  assert(dispatchStatus1.hasActiveDispatch === true, 'Case 1: Automatic dispatch batch created upon payment success');

  // ---------------------------------------------------------------------------
  // CASE 2: Courier Accepts Assignment -> Order Assigned
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 2: Courier Accepts Assignment ---');
  await orderService.acceptCourierAssignmentAsync(order1.id, courier.id);
  const orderAfterAccept = await orderService.getOrderByIdAsync(order1.id);

  assert(orderAfterAccept?.courierId === courier.id, 'Case 2: Courier ID set on order');
  assert(orderAfterAccept?.status === 'assigned', 'Case 2: Order status transitioned to assigned');

  // ---------------------------------------------------------------------------
  // CASE 3: Courier Pickups from Customer -> Order Picked Up
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 3: Courier Pickups from Customer ---');
  await orderService.transitionOrderStatusAsync(order1.id, 'picked_up', { id: courier.id, role: 'courier' });
  await orderService.markCourierArrivedAtLaundryAsync(order1.id, courier.id);
  const orderAfterArrive = await orderService.getOrderByIdAsync(order1.id);
  const arrivalLog = orderAfterArrive?.logs.find((l) => l.notes?.includes('courier_arrived'));

  assert(arrivalLog !== undefined, 'Case 3: Arrival log event recorded in order_status_logs');
  assert(orderAfterArrive?.status === 'picked_up', 'Case 3: Order status is picked_up after customer pickup');

  // ---------------------------------------------------------------------------
  // CASE 4: Start Washing Before Weight Verification -> DENIED
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 4: Start Washing Before Weight Verification ---');
  const gate4 = await orderService.canStartWashingOrder(order1.id);
  assert(gate4.allowed === false, 'Case 4: Washing gate DENIED when weight is not verified');

  try {
    await orderService.transitionOrderStatusAsync(order1.id, 'in_washing', { id: owner.id, role: 'laundry_owner', laundryId: 'lnd_001' });
    assert(false, 'Case 4: Should throw error when washing attempted before weight verification');
  } catch (err: any) {
    assert(err.message.includes('Pencucian Ditolak'), 'Case 4: Server-side transition enforces washing gate rejection');
  }

  // ---------------------------------------------------------------------------
  // CASE 5: Owner Verifies Same Weight -> Washing Gate OPEN
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 5: Owner Verifies Equal Weight ---');
  await orderService.updateActualWeightAndRecalculatePriceAsync(order1.id, 5, {
    id: owner.id,
    role: 'laundry_owner',
    laundryId: 'lnd_001',
  });
  const gate5 = await orderService.canStartWashingOrder(order1.id);
  assert(gate5.allowed === true, 'Case 5: Washing gate OPEN when weight verified with Rp 0 delta');

  // ---------------------------------------------------------------------------
  // CASE 6: Owner Verifies Higher Weight -> Adjustment Payment Created
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 6: Owner Verifies Higher Weight ---');
  const order6 = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Phase 3 Test No. 6',
      deliveryAddress: 'Jl. Phase 3 Test No. 6',
      pickupDate: '2026-08-30',
      pickupTimeSlot: '10:00 - 12:00 WIB',
      estimatedWeightKg: 5,
    },
    customer
  );
  const payment6 = await paymentService.createPaymentAttemptAsync(order6.id, 'snap');
  const providerRef6 = payment6.providerReference || payment6.idempotencyKey;
  await paymentService.processMidtransWebhookAsync({
    eventId: `evt_phase3_6_${Date.now()}`,
    providerReference: providerRef6,
    targetStatus: 'paid',
    incomingAmount: order6.totalPrice,
    rawPayload: { transaction_status: 'settlement' },
  });

  await orderService.acceptCourierAssignmentAsync(order6.id, courier.id);
  await orderService.transitionOrderStatusAsync(order6.id, 'picked_up', { id: courier.id, role: 'courier' });
  await orderService.markCourierArrivedAtLaundryAsync(order6.id, courier.id);

  const res6 = await orderService.updateActualWeightAndRecalculatePriceAsync(order6.id, 7, {
    id: owner.id,
    role: 'laundry_owner',
    laundryId: 'lnd_001',
  });

  assert(res6.priceDelta === 16000, 'Case 6: Price delta +Rp 16.000 calculated server-side');
  assert(res6.adjustmentPaymentAttempt !== null, 'Case 6: Adjustment payment attempt created');

  // ---------------------------------------------------------------------------
  // CASE 7: Start Washing While Adjustment Pending -> DENIED
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 7: Start Washing While Adjustment Pending ---');
  const gate7 = await orderService.canStartWashingOrder(order6.id);
  assert(gate7.allowed === false, 'Case 7: Washing DENIED while adjustment payment is pending');

  try {
    await orderService.transitionOrderStatusAsync(order6.id, 'in_washing', { id: owner.id, role: 'laundry_owner', laundryId: 'lnd_001' });
    assert(false, 'Case 7: Should throw error when washing attempted with pending adjustment');
  } catch (err: any) {
    assert(err.message.includes('Pencucian Ditolak'), 'Case 7: Washing gate rejection enforced');
  }

  // ---------------------------------------------------------------------------
  // CASE 8: Customer Pays Adjustment -> Washing Gate OPEN
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 8: Customer Pays Price Adjustment ---');
  const adjAttempt6 = res6.adjustmentPaymentAttempt;
  const adjRef6 = adjAttempt6.providerReference || adjAttempt6.idempotencyKey;
  const adjGrossStr6 = Math.round(adjAttempt6.amount).toFixed(2);

  await paymentService.processMidtransWebhookAsync({
    eventId: `evt_adj8_${Date.now()}`,
    providerReference: adjRef6,
    targetStatus: 'paid',
    incomingAmount: adjAttempt6.amount,
    rawPayload: {
      transaction_status: 'settlement',
      order_id: adjRef6,
      status_code: '200',
      gross_amount: adjGrossStr6,
      signature_key: generateSignature(adjRef6, '200', adjGrossStr6),
    },
  });

  const gate8 = await orderService.canStartWashingOrder(order6.id);
  assert(gate8.allowed === true, 'Case 8: Washing gate OPEN after adjustment paid');

  // ---------------------------------------------------------------------------
  // CASE 9: Laundry Starts Washing -> in_washing
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 9: Laundry Starts Washing ---');
  const order9Washing = await orderService.transitionOrderStatusAsync(order6.id, 'in_washing', { id: owner.id, role: 'laundry_owner', laundryId: 'lnd_001' });
  assert(order9Washing?.status === 'in_washing', 'Case 9: Order status successfully updated to in_washing');

  // ---------------------------------------------------------------------------
  // CASE 10: Customer Cannot Modify Weight -> DENIED
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 10: Customer Weight Modification Rejection ---');
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(order1.id, 2, {
      id: customer.id,
      role: 'customer',
    });
    assert(false, 'Case 10: Customer weight edit should be rejected');
  } catch (err: any) {
    assert(err.message.includes('Akses Ditolak'), 'Case 10: Security check rejects customer weight edit');
  }

  // ---------------------------------------------------------------------------
  // CASE 11: Courier Cannot Modify Weight -> DENIED
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 11: Courier Weight Modification Rejection ---');
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(order1.id, 2, {
      id: courier.id,
      role: 'courier',
    });
    assert(false, 'Case 11: Courier weight edit should be rejected');
  } catch (err: any) {
    assert(err.message.includes('Akses Ditolak'), 'Case 11: Security check rejects courier weight edit');
  }

  // ---------------------------------------------------------------------------
  // CASE 12: Owner From Another Laundry Cannot Modify Order -> DENIED
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 12: Cross-Laundry Owner Access Rejection ---');
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(order1.id, 4, {
      id: 'usr_other_owner',
      role: 'laundry_owner',
      laundryId: 'lnd_OTHER_OUTLET',
    });
    assert(false, 'Case 12: Cross-laundry edit should be rejected');
  } catch (err: any) {
    assert(err.message.includes('Akses Ditolak'), 'Case 12: Security check rejects cross-laundry owner');
  }

  // ---------------------------------------------------------------------------
  // CASE 13: Duplicate Webhook -> No Duplicate Payment or Dispatch
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 13: Duplicate Webhook Idempotency ---');
  const dupEventId = `evt_dup_phase3_${Date.now()}`;
  await paymentService.processMidtransWebhookAsync({
    eventId: dupEventId,
    providerReference: providerRef1,
    targetStatus: 'paid',
    incomingAmount: order1.totalPrice,
    rawPayload: { transaction_status: 'settlement' },
  });

  const dupWebhookRes = await paymentService.processMidtransWebhookAsync({
    eventId: dupEventId,
    providerReference: providerRef1,
    targetStatus: 'paid',
    incomingAmount: order1.totalPrice,
    rawPayload: { transaction_status: 'settlement' },
  });

  assert(dupWebhookRes.idempotent === true, 'Case 13: Duplicate webhook identified as idempotent');

  // ---------------------------------------------------------------------------
  // CASE 14: Duplicate Courier Acceptance -> No Duplicate Assignment
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 14: Duplicate Courier Acceptance ---');
  const order14 = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Phase 3 Test No. 14',
      deliveryAddress: 'Jl. Phase 3 Test No. 14',
      pickupDate: '2026-08-30',
      pickupTimeSlot: '10:00 - 12:00 WIB',
      estimatedWeightKg: 5,
    },
    customer
  );
  const payment14 = await paymentService.createPaymentAttemptAsync(order14.id, 'snap');
  const providerRef14 = payment14.providerReference || payment14.idempotencyKey;
  await paymentService.processMidtransWebhookAsync({
    eventId: `evt_phase3_14_${Date.now()}`,
    providerReference: providerRef14,
    targetStatus: 'paid',
    incomingAmount: order14.totalPrice,
    rawPayload: { transaction_status: 'settlement' },
  });

  await orderService.acceptCourierAssignmentAsync(order14.id, courier.id);
  const reAccept = await orderService.acceptCourierAssignmentAsync(order14.id, courier.id);
  assert(reAccept?.courierId === courier.id, 'Case 14: Re-accepting courier assignment returns same assignment idempotently');

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

runCourierFirstPhase3Tests();
