import {
  PaymentStatus,
  canTransitionPaymentStatus,
  normalizePaymentStatus,
} from '../types/payment';
import { paymentService } from '../services/paymentService';
import { orderService } from '../services/orderService';
import { MockPaymentGateway } from '../services/paymentGateway';
import { DEMO_USERS } from '../utils/constants';

async function runPaymentStateMachineTests() {
  console.log('==================================================');
  console.log('RUNNING PAYMENT STATE MACHINE & GATEWAY TESTS');
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

  // 1. Valid Payment Transitions
  assert(canTransitionPaymentStatus('unpaid', 'pending'), 'Test 1: VALID unpaid -> pending');
  assert(canTransitionPaymentStatus('pending', 'paid'), 'Test 2: VALID pending -> paid');
  assert(canTransitionPaymentStatus('pending', 'failed'), 'Test 3: VALID pending -> failed');
  assert(canTransitionPaymentStatus('pending', 'expired'), 'Test 4: VALID pending -> expired');
  assert(canTransitionPaymentStatus('paid', 'refund_pending'), 'Test 5: VALID paid -> refund_pending');
  assert(canTransitionPaymentStatus('refund_pending', 'refunded'), 'Test 5b: VALID refund_pending -> refunded');

  // 2. Invalid Payment Transitions
  assert(!canTransitionPaymentStatus('unpaid', 'paid'), 'Test 6: INVALID unpaid -> paid (Must pass through pending)');
  assert(!canTransitionPaymentStatus('paid', 'unpaid'), 'Test 7: INVALID paid -> unpaid');
  assert(!canTransitionPaymentStatus('failed', 'paid'), 'Test 8: INVALID failed -> paid');
  assert(!canTransitionPaymentStatus('expired', 'paid'), 'Test 9: INVALID expired -> paid');
  assert(!canTransitionPaymentStatus('refunded', 'paid'), 'Test 10: INVALID refunded -> paid');

  // Create a mock order to use for integration tests
  const customer = DEMO_USERS[0];
  const order = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Melati No. 45, Jakarta',
      deliveryAddress: 'Jl. Melati No. 45, Jakarta',
      pickupDate: '2026-08-20',
      pickupTimeSlot: '08:00 - 10:00 WIB',
      estimatedWeightKg: 5,
    },
    customer
  );
  // Authoritative total price for 5kg kiloan = 5 x 8000 + 2000 = Rp 42.000
  assert(order.totalPrice === 42000, 'Test Setup: Order created with total price Rp 42.000');

  // Test 11: Amount validation (client amount differs from order total -> REJECTED)
  await assertThrowsAsync(async () => {
    await paymentService.createPaymentAttemptAsync(order.id, 'qris', 1000); // Spoofed Rp 1.000 by client!
  }, 'Test 11: Client amount Rp 1.000 differing from order total Rp 42.000 rejected');

  // Test 12: Payment for non-existent order -> REJECTED
  await assertThrowsAsync(async () => {
    await paymentService.createPaymentAttemptAsync('ord_non_existent', 'qris');
  }, 'Test 12: Payment for invalid order ID rejected');

  // Test 13: Idempotency check (Duplicate payment creation returns existing pending attempt)
  const payment1 = await paymentService.createPaymentAttemptAsync(order.id, 'qris');
  assert(payment1.status === 'pending', 'Test 13: Initial payment created in pending status');
  assert(payment1.amount === 42000, 'Test 13: Payment attempt amount matches authoritative order total Rp 42.000');

  const payment2 = await paymentService.createPaymentAttemptAsync(order.id, 'qris');
  assert(payment2.id === payment1.id, 'Test 13: Duplicate create request returns SAME payment ID (IDEMPOTENCY PASS)');
  assert(payment2.idempotencyKey === payment1.idempotencyKey, 'Test 13: Idempotency keys match perfectly');

  // Test 14: Mock Gateway Creates Payment
  const mockGateway = new MockPaymentGateway();
  const gatewayRes = await mockGateway.createPaymentRequest({
    orderId: order.id,
    amount: 42000,
    currency: 'IDR',
    paymentMethod: 'qris',
    idempotencyKey: 'IDEMP-TEST-001',
  });
  assert(gatewayRes.success === true, 'Test 14: Mock gateway successfully generated payment request');
  assert(gatewayRes.providerReference.startsWith('MOCK-QRIS-'), 'Test 14: Provider reference generated with MOCK-QRIS prefix');

  // Test 15: Mock Gateway Verifies Payment
  const verifyRes = await mockGateway.verifyPayment(gatewayRes.providerReference);
  assert(verifyRes === true, 'Test 15: Mock gateway verified payment successfully');
  const statusAfterVerify = await mockGateway.checkPaymentStatus(gatewayRes.providerReference);
  assert(statusAfterVerify === 'paid', 'Test 15: Gateway status updated to paid');

  // Test 16: Mock Gateway Failure Handling
  const payment3 = await paymentService.createPaymentAttemptAsync(order.id, 'qris');
  // Transition pending -> failed
  const failedPayment = await paymentService.handlePaymentFailureAsync(payment3.id, 'Saldo QRIS tidak mencukupi');
  assert(failedPayment.status === 'failed', 'Test 16: Payment transition to failed executed correctly');

  // Test invalid transition attempt from failed to paid
  await assertThrowsAsync(async () => {
    await paymentService.handlePaymentSuccessAsync(failedPayment.id);
  }, 'Test 16: Attempting to transition failed payment to paid rejected by State Machine');

  console.log('\n==================================================');
  console.log(`PAYMENT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPaymentStateMachineTests();

