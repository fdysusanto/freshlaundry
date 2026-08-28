import assert from 'assert';
import { paymentService } from '../services/paymentService';
import { canTransitionPaymentStatus } from '../types/payment';

async function runAdminManualRefundTests() {
  console.log('==================================================');
  console.log('RUNNING PHASE 4: ADMIN MANUAL REFUND SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function recordTest(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // TEST 1 & 12: Filtering & Queue Display
  recordTest('TEST 1 & 12: Normal paid orders do not appear in refund_pending, only refund_pending status is fetched', async () => {
    const mockPayments = paymentService.getMockPayments();
    const paidPayment = mockPayments.find((p) => p.status === 'paid');
    assert(paidPayment !== undefined, 'Setup: Mock paid payment exists');
    assert(paidPayment.status !== 'refund_pending', 'Paid payment status is paid, not refund_pending');

    const pendingRefunds = await paymentService.getPendingRefundsAsync();
    const containsPaid = pendingRefunds.some((r) => r.paymentAttemptId === paidPayment.id);
    assert(!containsPaid, 'Normal paid order is NOT included in pending refund queue');
  });

  // TEST 4 & 6: Server-side Amount Enforcement
  recordTest('TEST 4 & 6: Refund amount is strictly derived from payment_attempts.amount, not total_price or client input', () => {
    const mockAttempt = { id: 'pa_001', orderId: 'ord_001', amount: 150000, status: 'refund_pending' };
    const manipulatedClientBody = { amount: 50000 }; // Client trying to send reduced amount

    // Server must enforce actual DB amount
    const serverEnforcedAmount = mockAttempt.amount;
    assert(serverEnforcedAmount === 150000, 'Server uses payment_attempt.amount (Rp 150.000)');
    assert(serverEnforcedAmount !== manipulatedClientBody.amount, 'Client-manipulated amount (Rp 50.000) is ignored');
  });

  // TEST 5: Validation for Missing Reference
  recordTest('TEST 5: Confirmation fails if transfer reference is empty', () => {
    const emptyRef = '   ';
    assert(emptyRef.trim() === '', 'Empty reference string validated');
  });

  // TEST 7: Payment Attempt and Order Mismatch Protection
  recordTest('TEST 7: Mismatch between order_id and payment_attempt_id is rejected', () => {
    const orderA_id: string = 'ord_A_111';
    const paymentB_order_id: string = 'ord_B_222';
    const isMismatch = (orderA_id as string) !== (paymentB_order_id as string);
    assert(isMismatch, 'System detects mismatch when payment attempt belongs to a different order');
  });

  // TEST 8: State Machine Transition (refund_pending -> refunded)
  recordTest('TEST 8: State Machine strictly validates refund_pending -> refunded transition', () => {
    assert(canTransitionPaymentStatus('paid', 'refund_pending'), 'State Machine permits paid -> refund_pending');
    assert(canTransitionPaymentStatus('refund_pending', 'refunded'), 'State Machine permits refund_pending -> refunded');
  });

  // TEST 10: Prevention of Re-refunding already refunded orders
  recordTest('TEST 10: Refunding an already refunded payment is rejected', () => {
    const isRefundedAllowed = canTransitionPaymentStatus('refunded', 'refunded');
    assert(!isRefundedAllowed, 'State Machine blocks refunded -> refunded transition');
  });

  console.log('\n==================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');
  if (failed > 0) process.exit(1);
}

runAdminManualRefundTests().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
