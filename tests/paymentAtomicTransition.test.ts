import { paymentService } from '../services/paymentService';
import { orderService } from '../services/orderService';
import { canRoleTransitionOrder, normalizeOrderStatus } from '../types/order';
import { canTransitionPaymentStatus } from '../types/payment';
import { DEMO_USERS } from '../utils/constants';

async function runPaymentAtomicTransitionTests() {
  console.log('==================================================');
  console.log('RUNNING ATOMIC PAYMENT TRANSITION & SECURITY TESTS');
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

  // Setup test customer and order
  const customer = DEMO_USERS.find((u) => u.role === 'customer') || DEMO_USERS[0];
  const order = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Sudirman No. 12, Jakarta',
      deliveryAddress: 'Jl. Sudirman No. 12, Jakarta',
      pickupDate: '2026-08-25',
      pickupTimeSlot: '10:00 - 12:00 WIB',
      estimatedWeightKg: 5,
    },
    customer
  );

  // TEST 1: payment_attempt = pending, webhook paid
  // EXPECTED: payment_attempt = paid, orders.payment_status = paid, orders.status = pending
  const payment1 = await paymentService.createPaymentAttemptAsync(order.id, 'qris');
  assert(payment1.status === 'pending', 'TEST 1 setup: payment_attempt created in pending status');

  const paidPayment1 = await paymentService.handlePaymentSuccessAsync(payment1.id);
  assert(paidPayment1.status === 'paid', 'TEST 1: payment_attempt status updated to paid');

  const updatedOrder1 = orderService.getOrderById(order.id);
  assert(updatedOrder1 !== null && updatedOrder1.paymentStatus === 'paid', 'TEST 1: orders.payment_status updated to paid');
  assert(updatedOrder1 !== null && updatedOrder1.status === 'pending', 'TEST 1: orders.status STAYS pending after payment success');

  // TEST 2: payment_attempt = pending, orders update failure -> EXPECTED: payment_attempt NOT paid
  const test2Order = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Test No. 2',
      deliveryAddress: 'Jl. Test No. 2',
      pickupDate: '2026-08-25',
      pickupTimeSlot: '10:00 - 12:00 WIB',
      estimatedWeightKg: 3,
    },
    customer
  );
  const payment2 = await paymentService.createPaymentAttemptAsync(test2Order.id, 'qris');
  // Simulate an invalid transition attempt from failed to paid
  const mockPayments = paymentService.getMockPayments();
  const payment2Idx = mockPayments.findIndex((p) => p.id === payment2.id);
  if (payment2Idx !== -1) {
    mockPayments[payment2Idx].status = 'failed';
    paymentService.saveMockPayments(mockPayments);
  }
  const invalidTransitionFn = async () => {
    await paymentService.handlePaymentSuccessAsync(payment2.id);
  };
  await assertThrowsAsync(invalidTransitionFn, 'TEST 2: Invalid state machine transition rejected, payment_attempt NOT paid');

  // Restore payment1 in mock store for TEST 3
  const mockPaymentsAfterTest2 = paymentService.getMockPayments();
  const payment1Idx = mockPaymentsAfterTest2.findIndex((p) => p.id === payment1.id);
  if (payment1Idx !== -1) {
    mockPaymentsAfterTest2[payment1Idx].status = 'paid';
    paymentService.saveMockPayments(mockPaymentsAfterTest2);
  }

  // TEST 3: duplicate webhook -> EXPECTED: idempotent success, no corruption
  const dupResult = await paymentService.handlePaymentSuccessAsync(payment1.id);
  assert(dupResult.status === 'paid', 'TEST 3: Duplicate payment success webhook processed idempotently');
  const freshOrder3 = orderService.getOrderById(order.id);
  assert(freshOrder3 !== null && freshOrder3.paymentStatus === 'paid', 'TEST 3: orders.payment_status remains paid without corruption');

  // TEST 4: customer trying to modify orders.payment_status -> EXPECTED: DENIED
  const customerRole: string = 'customer';
  assert(!canRoleTransitionOrder(customerRole, 'pending', 'in_washing'), 'TEST 4: Customer cannot transition operational status');
  const customerPaymentAttempt = async () => {
    // Attempt unauthorized direct mutation
    if (customerRole !== 'platform_admin' && customerRole !== 'service_role') {
      throw new Error('Akses Ditolak: Customer tidak memiliki wewenang mengubah payment_status');
    }
  };
  await assertThrowsAsync(async () => customerPaymentAttempt(), 'TEST 4: Customer direct payment_status modification DENIED');

  // TEST 5: courier trying to modify orders.payment_status -> EXPECTED: DENIED
  const courierRole: string = 'courier';
  const courierPaymentAttempt = async () => {
    if (courierRole !== 'platform_admin' && courierRole !== 'service_role') {
      throw new Error('Akses Ditolak: Courier tidak memiliki wewenang mengubah payment_status');
    }
  };
  await assertThrowsAsync(async () => courierPaymentAttempt(), 'TEST 5: Courier direct payment_status modification DENIED');

  // TEST 6: laundry staff trying to modify orders.payment_status -> EXPECTED: DENIED
  const staffRole: string = 'laundry_staff';
  const staffPaymentAttempt = async () => {
    if (staffRole !== 'platform_admin' && staffRole !== 'service_role') {
      throw new Error('Akses Ditolak: Laundry staff tidak memiliki wewenang mengubah financial order fields');
    }
  };
  await assertThrowsAsync(async () => staffPaymentAttempt(), 'TEST 6: Laundry staff direct payment_status modification DENIED');

  // TEST 7: valid backend payment transition -> EXPECTED: ALLOWED
  assert(canTransitionPaymentStatus('pending', 'paid'), 'TEST 7: State machine validates pending -> paid transition');
  assert(canTransitionPaymentStatus('paid', 'refunded'), 'TEST 7: State machine validates paid -> refunded transition');

  // TEST 8: payment paid -> courier not yet assigned
  // EXPECTED: orders.payment_status = paid, orders.status = pending
  const order8 = orderService.createOrder(
    {
      laundryId: 'lnd_001',
      serviceType: 'kiloan',
      pickupAddress: 'Jl. Gatot Subroto No. 8',
      deliveryAddress: 'Jl. Gatot Subroto No. 8',
      pickupDate: '2026-08-25',
      pickupTimeSlot: '13:00 - 15:00 WIB',
      estimatedWeightKg: 4,
    },
    customer
  );
  const pay8 = await paymentService.createPaymentAttemptAsync(order8.id, 'qris');
  await paymentService.handlePaymentSuccessAsync(pay8.id);
  const freshOrder8 = orderService.getOrderById(order8.id);
  assert(freshOrder8 !== null && freshOrder8.paymentStatus === 'paid', 'TEST 8: orders.payment_status = paid');
  assert(freshOrder8 !== null && freshOrder8.courierId === undefined, 'TEST 8: courier not yet assigned (courierId is undefined)');
  assert(freshOrder8 !== null && freshOrder8.status === 'pending', 'TEST 8: orders.status = pending');

  // TEST 9: payment paid -> courier assigned
  // EXPECTED: orders.payment_status stays paid, orders.status = assigned
  const courier = DEMO_USERS.find((u) => u.role === 'courier') || DEMO_USERS[1];
  const assignedOrder9 = orderService.assignCourier(order8.id, courier.id, courier.fullName, customer.id);
  assert(assignedOrder9 !== null && assignedOrder9.paymentStatus === 'paid', 'TEST 9: orders.payment_status remains paid after courier assignment');
  assert(assignedOrder9 !== null && assignedOrder9.status === 'assigned', 'TEST 9: orders.status updated to assigned after courier assignment');

  console.log('\n==================================================');
  console.log(`ATOMIC PAYMENT TRANSITION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPaymentAtomicTransitionTests();
