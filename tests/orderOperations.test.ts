import { checkoutService } from '../services/checkoutService';
import { orderService } from '../services/orderService';
import { paymentService } from '../services/paymentService';
import { DEMO_USERS } from '../utils/constants';
import { UserProfile } from '../types/user';

async function runOrderOperationsEndToEndTests() {
  console.log('==================================================');
  console.log('RUNNING PHASE 4E: END-TO-END ORDER OPERATIONS TESTS');
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

  // Participants from DEMO_USERS:
  // DEMO_USERS[0]: Customer (Budi)
  // DEMO_USERS[1]: Courier 1 (Agung)
  // DEMO_USERS[2]: Courier 2 (Rizky)
  // DEMO_USERS[3]: Laundry Owner (Hendra, lnd_001)
  const customer: UserProfile = DEMO_USERS[0];
  const courier: UserProfile = DEMO_USERS[1];
  const wrongCourier: UserProfile = DEMO_USERS[2];
  const laundryOwner: UserProfile = DEMO_USERS[3];
  const wrongLaundryOwner: UserProfile = { ...DEMO_USERS[3], id: 'usr_owner_99', laundryId: 'lnd_999' };

  // Step 1: Customer creates order via Checkout Engine
  const idempotencyKey = `IDEMP-E2E-${Date.now()}`;
  const checkoutRes = await checkoutService.processCheckoutAsync(
    {
      laundryId: 'lnd_001',
      items: [{ serviceId: 'srv_001', quantity: 5 }], // 5kg Cuci Kiloan @ 8.000 + 2.000 platform = Rp 42.000
      pickupAddress: 'Jl. Melati No. 123, Kebayoran',
      pickupDate: '2026-08-20',
      pickupTimeSlot: '08:00 - 10:00 WIB',
      idempotencyKey,
    },
    customer
  );

  assert(checkoutRes.success === true, 'Test 1: Customer creates order via Checkout Engine');
  const orderId = checkoutRes.order.id;

  // Step 2: Checkout Idempotency Test
  const checkoutReplayed = await checkoutService.processCheckoutAsync(
    {
      laundryId: 'lnd_001',
      items: [{ serviceId: 'srv_001', quantity: 5 }],
      pickupAddress: 'Jl. Melati No. 123, Kebayoran',
      pickupDate: '2026-08-20',
      pickupTimeSlot: '08:00 - 10:00 WIB',
      idempotencyKey,
    },
    customer
  );
  assert(checkoutReplayed.isDuplicate === true, 'Test 2: Replayed checkout request returns duplicate flag (isDuplicate = true)');
  assert(checkoutReplayed.order.id === orderId, 'Test 2: Replayed checkout returns SAME order ID');

  // Step 3: Initial Payment Status is pending
  assert(checkoutRes.payment.status === 'pending', 'Test 3: Initial payment status is pending');

  // Step 4 & 5: Payment Pending -> Payment Paid Confirmation
  const paymentRes = await paymentService.handlePaymentSuccessAsync(checkoutRes.payment.id);
  assert(paymentRes.status === 'paid', 'Test 5: Payment status transitions to paid via paymentService');

  // Verify order paymentStatus updated to paid while order.status remains pending
  const orderAfterPay = await orderService.getOrderByIdAsync(orderId);
  assert(orderAfterPay?.paymentStatus === 'paid', 'Test 5: order.paymentStatus updated to paid');
  assert(orderAfterPay?.status === 'pending', 'Test 5: order.status remains pending (Payment & Order separation maintained)');

  // Step 6 & 7: Laundry Acceptance & Role Authorization
  // Customer attempts to ACCEPT ORDER (pending -> assigned) -> REJECTED
  await assertThrowsAsync(async () => {
    await orderService.transitionOrderStatusAsync(orderId, 'assigned', { id: customer.id, role: customer.role }, 'Customer mencoba assign');
  }, 'Test 7: Customer CANNOT accept order (Role authorization enforced)');

  // Laundry Owner accepts order (pending -> assigned) -> VALID
  const orderAssigned = await orderService.transitionOrderStatusAsync(
    orderId,
    'assigned',
    { id: laundryOwner.id, role: laundryOwner.role, laundryId: laundryOwner.laundryId },
    'Diterima oleh laundry'
  );
  assert(orderAssigned?.status === 'assigned', 'Test 6: Laundry owner accepts order (pending -> assigned)');

  // Step 8: Courier Assigned
  const orderCourierAssigned = await orderService.assignCourierAsync(orderId, courier.id, courier.fullName, laundryOwner.id);
  assert(orderCourierAssigned?.courierId === courier.id, 'Test 8: Courier assigned to order');

  // Step 9 & 17: Courier Pickup & Wrong Courier Rejection
  // Wrong courier tries to pickup -> REJECTED
  await assertThrowsAsync(async () => {
    await orderService.transitionOrderStatusAsync(
      orderId,
      'picked_up',
      { id: wrongCourier.id, role: wrongCourier.role },
      'Kurir salah jemput'
    );
  }, 'Test 17: Wrong courier CANNOT pickup order assigned to another courier');

  // Assigned courier picks up -> VALID
  const orderPickedUp = await orderService.transitionOrderStatusAsync(
    orderId,
    'picked_up',
    { id: courier.id, role: courier.role },
    'Pakaian dijemput kurir'
  );
  assert(orderPickedUp?.status === 'picked_up', 'Test 9: Assigned courier picks up order (assigned -> picked_up)');

  // Step 10 & 16: Laundry Processing & Wrong Laundry Owner Rejection
  // Wrong laundry owner tries to process -> REJECTED
  await assertThrowsAsync(async () => {
    await orderService.transitionOrderStatusAsync(
      orderId,
      'in_washing',
      { id: wrongLaundryOwner.id, role: wrongLaundryOwner.role, laundryId: wrongLaundryOwner.laundryId },
      'Toko B coba cuci'
    );
  }, 'Test 16: Wrong laundry owner CANNOT process order belonging to another laundry');

  // Laundry Owner starts washing (picked_up -> in_washing) -> VALID
  const orderWashing = await orderService.transitionOrderStatusAsync(
    orderId,
    'in_washing',
    { id: laundryOwner.id, role: laundryOwner.role, laundryId: laundryOwner.laundryId },
    'Mulai proses pencucian'
  );
  assert(orderWashing?.status === 'in_washing', 'Test 10: Laundry owner starts washing (picked_up -> in_washing)');

  // Step 11: Laundry Marks Ready (in_washing -> ready_for_delivery)
  const orderReady = await orderService.transitionOrderStatusAsync(
    orderId,
    'ready_for_delivery',
    { id: laundryOwner.id, role: laundryOwner.role, laundryId: laundryOwner.laundryId },
    'Cucian selesai & siap dikirim'
  );
  assert(orderReady?.status === 'ready_for_delivery', 'Test 11: Laundry owner marks ready (in_washing -> ready_for_delivery)');

  // Step 12 & 18: Courier Delivery & Wrong Courier Delivery Rejection
  // Wrong courier tries to deliver -> REJECTED
  await assertThrowsAsync(async () => {
    await orderService.transitionOrderStatusAsync(
      orderId,
      'out_for_delivery',
      { id: wrongCourier.id, role: wrongCourier.role },
      'Kurir salah antar'
    );
  }, 'Test 18: Wrong courier CANNOT deliver order assigned to another courier');

  // Assigned courier starts delivery (ready_for_delivery -> out_for_delivery) -> VALID
  const orderOutForDelivery = await orderService.transitionOrderStatusAsync(
    orderId,
    'out_for_delivery',
    { id: courier.id, role: courier.role },
    'Kurir mengantar pesanan ke alamat'
  );
  assert(orderOutForDelivery?.status === 'out_for_delivery', 'Test 12: Assigned courier starts delivery (ready_for_delivery -> out_for_delivery)');

  // Step 13: Courier Completes Delivery (out_for_delivery -> delivered)
  const orderDelivered = await orderService.transitionOrderStatusAsync(
    orderId,
    'delivered',
    { id: courier.id, role: courier.role },
    'Pesanan diterima oleh pelanggan'
  );
  assert(orderDelivered?.status === 'delivered', 'Test 13: Assigned courier completes delivery (out_for_delivery -> delivered)');

  // Step 14: Terminal State Protection (delivered -> pending REJECTED)
  await assertThrowsAsync(async () => {
    await orderService.transitionOrderStatusAsync(
      orderId,
      'pending',
      { id: laundryOwner.id, role: laundryOwner.role },
      'Coba reset delivered ke pending'
    );
  }, 'Test 14: Delivered status is TERMINAL (cannot transition back to pending)');

  // Step 15: Cancelled Terminal State Protection
  const cancelTestOrder = await checkoutService.processCheckoutAsync(
    {
      laundryId: 'lnd_001',
      items: [{ serviceId: 'srv_001', quantity: 1 }],
      pickupAddress: 'Jl. Cancel No. 1',
      pickupDate: '2026-08-20',
      pickupTimeSlot: '08:00 - 10:00 WIB',
      idempotencyKey: `IDEMP-CANCEL-${Date.now()}`,
    },
    customer
  );
  const cancelledOrder = await orderService.transitionOrderStatusAsync(
    cancelTestOrder.order.id,
    'cancelled',
    { id: customer.id, role: customer.role },
    'Dibatalkan pelanggan'
  );
  assert(cancelledOrder?.status === 'cancelled', 'Test 15: Order cancelled successfully');

  await assertThrowsAsync(async () => {
    await orderService.transitionOrderStatusAsync(
      cancelTestOrder.order.id,
      'picked_up',
      { id: courier.id, role: courier.role },
      'Coba jemput order yang sudah batal'
    );
  }, 'Test 15: Cancelled status is TERMINAL (cannot transition to active state)');

  // Step 19: Invalid Transition Rejection (pending -> in_washing)
  const freshOrder = await checkoutService.processCheckoutAsync(
    {
      laundryId: 'lnd_001',
      items: [{ serviceId: 'srv_001', quantity: 1 }],
      pickupAddress: 'Jl. Fresh No. 2',
      pickupDate: '2026-08-20',
      pickupTimeSlot: '08:00 - 10:00 WIB',
      idempotencyKey: `IDEMP-FRESH-${Date.now()}`,
    },
    customer
  );
  await assertThrowsAsync(async () => {
    await orderService.transitionOrderStatusAsync(
      freshOrder.order.id,
      'in_washing',
      { id: laundryOwner.id, role: laundryOwner.role },
      'Lompat langsung dari pending ke washing'
    );
  }, 'Test 19: Invalid transition (pending -> in_washing) rejected by State Machine');

  // Step 20: Status Audit Logs Created
  const finalOrder = await orderService.getOrderByIdAsync(orderId);
  assert(Boolean(finalOrder && finalOrder.logs.length >= 6), `Test 20: Audit logs recorded all lifecycle transitions (${finalOrder?.logs.length} logs recorded)`);

  console.log('\n==================================================');
  console.log(`END-TO-END OPERATIONS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runOrderOperationsEndToEndTests();
