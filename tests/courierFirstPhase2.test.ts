import { createHash } from 'crypto';
import { paymentService } from '../services/paymentService';
import { orderService } from '../services/orderService';
import { dispatchService } from '../services/dispatchService';
import { DEMO_USERS } from '../utils/constants';

const originalFetch = global.fetch;
const originalEnv = process.env;

async function runCourierFirstPhase2Tests() {
  console.log('==================================================');
  console.log('RUNNING COURIER-FIRST PHASE 2 (WEIGHT & PRICE ADJUSTMENT) TESTS');
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

  const TEST_SERVER_KEY = 'SB-Mid-server-TESTKEY-PHASE2';
  process.env = { ...originalEnv, MIDTRANS_SERVER_KEY: TEST_SERVER_KEY, MIDTRANS_IS_PRODUCTION: 'false' };

  global.fetch = (async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        token: 'snap-token-phase2-test',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/v1/transactions/snap-token-phase2-test/pdf',
      }),
    } as Response;
  }) as typeof fetch;

  function generateSignature(orderId: string, statusCode: string, grossAmount: string): string {
    return createHash('sha512').update(orderId + statusCode + grossAmount + TEST_SERVER_KEY).digest('hex');
  }

  const customer = DEMO_USERS[0];
  const owner = DEMO_USERS.find((u) => u.role === 'laundry_owner') || { id: 'usr_owner_01', role: 'laundry_owner', laundryId: 'lnd_001' };
  const courier = DEMO_USERS.find((u) => u.role === 'courier') || { id: 'usr_courier_01', role: 'courier' };

  async function createInitialPaidOrder(estWeight: number = 5) {
    const order = orderService.createOrder(
      {
        laundryId: 'lnd_001',
        serviceType: 'kiloan',
        pickupAddress: 'Jl. Phase 2 Test No. 1',
        deliveryAddress: 'Jl. Phase 2 Test No. 1',
        pickupDate: '2026-08-30',
        pickupTimeSlot: '10:00 - 12:00 WIB',
        estimatedWeightKg: estWeight,
      },
      customer
    );
    const payment = await paymentService.createPaymentAttemptAsync(order.id, 'snap');
    const providerRef = payment.providerReference || payment.idempotencyKey;
    const grossAmountStr = Math.round(order.totalPrice).toFixed(2);

    await paymentService.processMidtransWebhookAsync({
      eventId: `evt_initial_${Date.now()}_${Math.random()}`,
      providerReference: providerRef,
      targetStatus: 'paid',
      incomingAmount: order.totalPrice,
      rawPayload: {
        transaction_status: 'settlement',
        order_id: providerRef,
        status_code: '200',
        gross_amount: grossAmountStr,
        signature_key: generateSignature(providerRef, '200', grossAmountStr),
      },
    });

    // Assign courier to transition status from pending -> assigned & record pickup
    await dispatchService.dispatchOrderAsync(order.id, 'pickup', 'admin');
    orderService.updateOrderStatus(order.id, 'assigned', 'Kurir menerima tugas pickup', courier.id);
    await orderService.transitionOrderStatusAsync(order.id, 'picked_up', { id: courier.id, role: 'courier' });
    await orderService.markCourierArrivedAtLaundryAsync(order.id, courier.id);

    const updated = await orderService.getOrderByIdAsync(order.id);
    return updated!;
  }

  // ---------------------------------------------------------------------------
  // CASE 1: Estimated 5kg / Rp42,000, Actual 5kg / Rp42,000 -> Adjustment Rp0 -> Washing Unlocked
  // ---------------------------------------------------------------------------
  console.log('--- CASE 1: Actual Weight Equal to Estimated Weight ---');
  const order1 = await createInitialPaidOrder(5);
  const res1 = await orderService.updateActualWeightAndRecalculatePriceAsync(order1.id, 5, {
    id: owner.id,
    role: 'laundry_owner',
    laundryId: 'lnd_001',
  });
  const gate1 = await orderService.canStartWashingOrder(order1.id);

  assert(res1.priceDelta === 0, 'Case 1: Price delta is Rp 0 when actual weight matches estimated weight');
  assert(res1.adjustmentPaymentAttempt === null, 'Case 1: No adjustment payment attempt created when delta is 0');
  assert(Boolean(gate1.allowed) === true, 'Case 1: Washing gate UNLOCKED immediately when delta is 0');

  // ---------------------------------------------------------------------------
  // CASE 2: Estimated 5kg / Rp42,000, Actual 7kg / Rp58,000 -> Adjustment +Rp16,000 -> Pending -> Washing Locked
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 2: Actual Weight Higher than Estimated Weight ---');
  const order2 = await createInitialPaidOrder(5);
  const res2 = await orderService.updateActualWeightAndRecalculatePriceAsync(order2.id, 7, {
    id: owner.id,
    role: 'laundry_owner',
    laundryId: 'lnd_001',
  });

  const gate2 = await orderService.canStartWashingOrder(order2.id);

  assert(res2.priceDelta === 16000, 'Case 2: Price delta is +Rp 16.000 for +2kg increase');
  assert(res2.adjustmentPaymentAttempt !== null, 'Case 2: Adjustment payment attempt created automatically');
  assert(res2.adjustmentPaymentAttempt.status === 'pending', 'Case 2: Adjustment payment status is pending');
  assert(gate2.allowed === false, 'Case 2: Washing gate LOCKED while adjustment payment is pending');
  assert(Boolean(gate2.reason?.includes('Menunggu pembayaran selisih')), 'Case 2: Clear locking reason provided');

  // ---------------------------------------------------------------------------
  // CASE 3: Adjustment Payment Succeeds -> Adjustment Paid -> Washing Unlocked
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 3: Adjustment Payment Webhook Success ---');
  const adjAttempt2 = res2.adjustmentPaymentAttempt;
  const adjProviderRef2 = adjAttempt2.providerReference || adjAttempt2.idempotencyKey;
  const adjGrossStr2 = Math.round(adjAttempt2.amount).toFixed(2);
  const adjEventId3 = `evt_adj_${Date.now()}`;

  const webhookRes3 = await paymentService.processMidtransWebhookAsync({
    eventId: adjEventId3,
    providerReference: adjProviderRef2,
    targetStatus: 'paid',
    incomingAmount: adjAttempt2.amount,
    rawPayload: {
      transaction_status: 'settlement',
      order_id: adjProviderRef2,
      status_code: '200',
      gross_amount: adjGrossStr2,
      signature_key: generateSignature(adjProviderRef2, '200', adjGrossStr2),
    },
  });

  assert(webhookRes3.success === true, 'Case 3: Adjustment payment webhook processed successfully');

  const gate3 = await orderService.canStartWashingOrder(order2.id);
  assert(gate3.allowed === true, 'Case 3: Washing gate UNLOCKED after adjustment payment paid');

  // ---------------------------------------------------------------------------
  // CASE 4: Duplicate Webhook -> Idempotency Guard
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 4: Duplicate Adjustment Webhook (Idempotency) ---');
  const dupWebhookRes4 = await paymentService.processMidtransWebhookAsync({
    eventId: adjEventId3,
    providerReference: adjProviderRef2,
    targetStatus: 'paid',
    incomingAmount: adjAttempt2.amount,
    rawPayload: {
      transaction_status: 'settlement',
      order_id: adjProviderRef2,
      status_code: '200',
      gross_amount: adjGrossStr2,
      signature_key: generateSignature(adjProviderRef2, '200', adjGrossStr2),
    },
  });

  assert(dupWebhookRes4.idempotent === true, 'Case 4: Duplicate adjustment webhook identified as idempotent');

  // ---------------------------------------------------------------------------
  // CASE 5: Estimated 5kg / Rp42,000, Actual 4kg / Rp34,000 -> Adjustment -Rp8,000 -> No negative attempt -> Washing Unlocked
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 5: Actual Weight Lower than Estimated Weight ---');
  const order5 = await createInitialPaidOrder(5);
  const res5 = await orderService.updateActualWeightAndRecalculatePriceAsync(order5.id, 4, {
    id: owner.id,
    role: 'laundry_owner',
    laundryId: 'lnd_001',
  });

  const gate5 = await orderService.canStartWashingOrder(order5.id);

  assert(res5.priceDelta === -8000, 'Case 5: Price delta is negative (-Rp 8.000)');
  assert(res5.adjustmentPaymentAttempt === null, 'Case 5: NO negative payment attempt created');
  assert(gate5.allowed === true, 'Case 5: Washing gate UNLOCKED for lower weight');

  // ---------------------------------------------------------------------------
  // CASE 6: Laundry Owner from OTHER outlet tries to update weight -> REJECTED
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 6: Cross-Laundry Owner Access Attempt ---');
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(order1.id, 6, {
      id: 'usr_other_owner',
      role: 'laundry_owner',
      laundryId: 'lnd_OTHER_OUTLET',
    });
    assert(false, 'Case 6: Cross-laundry owner edit should be rejected');
  } catch (err: any) {
    assert(err.message.includes('Akses Ditolak'), 'Case 6: Security rejection triggered for cross-laundry owner');
  }

  // ---------------------------------------------------------------------------
  // CASE 7: Customer tries to modify final_weight_kg -> DENIED
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 7: Customer Weight Tamper Attempt ---');
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(order1.id, 1, {
      id: customer.id,
      role: 'customer',
    });
    assert(false, 'Case 7: Customer weight edit should be rejected');
  } catch (err: any) {
    assert(err.message.includes('Akses Ditolak'), 'Case 7: Security rejection triggered for customer role');
  }

  // ---------------------------------------------------------------------------
  // CASE 8: Courier tries to modify final_weight_kg -> DENIED
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 8: Courier Weight Tamper Attempt ---');
  try {
    await orderService.updateActualWeightAndRecalculatePriceAsync(order1.id, 1, {
      id: courier.id,
      role: 'courier',
    });
    assert(false, 'Case 8: Courier weight edit should be rejected');
  } catch (err: any) {
    assert(err.message.includes('Akses Ditolak'), 'Case 8: Security rejection triggered for courier role');
  }

  // ---------------------------------------------------------------------------
  // CASE 9: Laundry tries to start washing before weight verification -> DENIED
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 9: Start Washing Before Weight Verification ---');
  const order9 = await createInitialPaidOrder(5);
  // Do not weigh order9 to test Washing Gate before weight verification

  const gate9 = await orderService.canStartWashingOrder(order9.id);

  assert(gate9.allowed === false, 'Case 9: Washing DENIED before weight verification');
  assert(Boolean(gate9.reason?.includes('Pencucian Ditolak')), 'Case 9: Reason specifies pending weight verification');

  try {
    await orderService.transitionOrderStatusAsync(order9.id, 'in_washing', { id: owner.id, role: 'laundry_owner', laundryId: 'lnd_001' });
    assert(false, 'Case 9: Status transition to in_washing should throw error');
  } catch (err: any) {
    assert(err.message.includes('Pencucian Ditolak'), 'Case 9: transitionOrderStatusAsync enforces washing gate');
  }

  // ---------------------------------------------------------------------------
  // CASE 10: Laundry tries to start washing when adjustment payment pending -> DENIED
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 10: Start Washing When Adjustment Pending ---');
  const order10 = await createInitialPaidOrder(5);
  await orderService.updateActualWeightAndRecalculatePriceAsync(order10.id, 8, {
    id: owner.id,
    role: 'laundry_owner',
    laundryId: 'lnd_001',
  });

  const gate10 = await orderService.canStartWashingOrder(order10.id);
  assert(gate10.allowed === false, 'Case 10: Washing DENIED while adjustment payment is pending');

  try {
    await orderService.transitionOrderStatusAsync(order10.id, 'in_washing', { id: owner.id, role: 'laundry_owner', laundryId: 'lnd_001' });
    assert(false, 'Case 10: Status transition to in_washing should throw error when adjustment pending');
  } catch (err: any) {
    assert(err.message.includes('Pencucian Ditolak'), 'Case 10: State machine transition enforces washing gate for pending adjustment');
  }

  // ---------------------------------------------------------------------------
  // CASE 11: Laundry starts washing after adjustment is paid -> PASS
  // ---------------------------------------------------------------------------
  console.log('\n--- CASE 11: Start Washing After Adjustment Paid ---');
  const res11 = await orderService.updateActualWeightAndRecalculatePriceAsync(order10.id, 8, {
    id: owner.id,
    role: 'laundry_owner',
    laundryId: 'lnd_001',
  });
  const adjAttempt11 = res11.adjustmentPaymentAttempt;
  const adjRef11 = adjAttempt11.providerReference || adjAttempt11.idempotencyKey;
  const adjGrossStr11 = Math.round(adjAttempt11.amount).toFixed(2);

  await paymentService.processMidtransWebhookAsync({
    eventId: `evt_adj11_${Date.now()}`,
    providerReference: adjRef11,
    targetStatus: 'paid',
    incomingAmount: adjAttempt11.amount,
    rawPayload: {
      transaction_status: 'settlement',
      order_id: adjRef11,
      status_code: '200',
      gross_amount: adjGrossStr11,
      signature_key: generateSignature(adjRef11, '200', adjGrossStr11),
    },
  });

  const gate11 = await orderService.canStartWashingOrder(order10.id);
  assert(Boolean(gate11.allowed) === true, 'Case 11: Washing ALLOWED after adjustment payment paid');

  const washingOrder11 = await orderService.transitionOrderStatusAsync(order10.id, 'in_washing', { id: owner.id, role: 'laundry_owner', laundryId: 'lnd_001' });
  assert(washingOrder11?.status === 'in_washing', 'Case 11: Order status successfully transitioned to in_washing!');

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

runCourierFirstPhase2Tests();
