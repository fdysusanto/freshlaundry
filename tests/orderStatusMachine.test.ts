import {
  OrderStatus,
  canTransitionOrderStatus,
  canRoleTransitionOrder,
  getAllowedNextStatuses,
  normalizeOrderStatus,
  VALID_ORDER_TRANSITIONS,
} from '../types/order';

function runTests() {
  console.log('==================================================');
  console.log('RUNNING ORDER STATE MACHINE UNIT TESTS');
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

  // 1. Status Normalization Tests
  assert(normalizeOrderStatus('pending') === 'pending', 'normalizeOrderStatus("pending") -> "pending"');
  assert(normalizeOrderStatus('pending_payment') === 'pending', 'normalizeOrderStatus("pending_payment") -> "pending"');
  assert(normalizeOrderStatus('paid') === 'pending', 'normalizeOrderStatus("paid") -> "pending"');
  assert(normalizeOrderStatus('processing') === 'in_washing', 'normalizeOrderStatus("processing") -> "in_washing"');
  assert(normalizeOrderStatus('ready') === 'ready_for_delivery', 'normalizeOrderStatus("ready") -> "ready_for_delivery"');
  assert(normalizeOrderStatus('completed') === 'delivered', 'normalizeOrderStatus("completed") -> "delivered"');

  // 2. Valid Transition Chain Tests
  assert(canTransitionOrderStatus('pending', 'assigned'), 'VALID: pending -> assigned');
  assert(canTransitionOrderStatus('assigned', 'picked_up'), 'VALID: assigned -> picked_up');
  assert(canTransitionOrderStatus('picked_up', 'in_washing'), 'VALID: picked_up -> in_washing');
  assert(canTransitionOrderStatus('in_washing', 'ready_for_delivery'), 'VALID: in_washing -> ready_for_delivery');
  assert(canTransitionOrderStatus('ready_for_delivery', 'out_for_delivery'), 'VALID: ready_for_delivery -> out_for_delivery');
  assert(canTransitionOrderStatus('out_for_delivery', 'delivered'), 'VALID: out_for_delivery -> delivered');
  assert(canTransitionOrderStatus('pending', 'cancelled'), 'VALID: pending -> cancelled');
  assert(canTransitionOrderStatus('assigned', 'cancelled'), 'VALID: assigned -> cancelled');

  // 3. Invalid Transition Chain Tests
  assert(!canTransitionOrderStatus('pending', 'delivered'), 'INVALID: pending -> delivered');
  assert(!canTransitionOrderStatus('pending', 'in_washing'), 'INVALID: pending -> in_washing');
  assert(!canTransitionOrderStatus('delivered', 'pending'), 'INVALID: delivered -> pending');
  assert(!canTransitionOrderStatus('cancelled', 'picked_up'), 'INVALID: cancelled -> picked_up');
  assert(!canTransitionOrderStatus('delivered', 'cancelled'), 'INVALID: delivered -> cancelled');
  assert(!canTransitionOrderStatus('in_washing', 'picked_up'), 'INVALID: in_washing -> picked_up');

  // 4. Role Permission Tests
  // Customer Permissions
  assert(canRoleTransitionOrder('customer', 'pending', 'cancelled'), 'ROLE: Customer can cancel pending order');
  assert(canRoleTransitionOrder('customer', 'assigned', 'cancelled'), 'ROLE: Customer can cancel assigned order');
  assert(!canRoleTransitionOrder('customer', 'pending', 'assigned'), 'ROLE: Customer CANNOT assign courier');
  assert(!canRoleTransitionOrder('customer', 'in_washing', 'ready_for_delivery'), 'ROLE: Customer CANNOT mark ready');

  // Laundry Owner / Staff Permissions
  assert(canRoleTransitionOrder('laundry_owner', 'pending', 'assigned'), 'ROLE: Owner can transition pending -> assigned');
  assert(canRoleTransitionOrder('laundry_staff', 'picked_up', 'in_washing'), 'ROLE: Staff can transition picked_up -> in_washing');
  assert(canRoleTransitionOrder('laundry_owner', 'in_washing', 'ready_for_delivery'), 'ROLE: Owner can transition in_washing -> ready_for_delivery');
  assert(!canRoleTransitionOrder('laundry_staff', 'ready_for_delivery', 'out_for_delivery'), 'ROLE: Staff CANNOT transition to out_for_delivery');

  // Courier Permissions
  assert(canRoleTransitionOrder('courier', 'assigned', 'picked_up'), 'ROLE: Courier can transition assigned -> picked_up');
  assert(canRoleTransitionOrder('courier', 'ready_for_delivery', 'out_for_delivery'), 'ROLE: Courier can transition ready_for_delivery -> out_for_delivery');
  assert(canRoleTransitionOrder('courier', 'out_for_delivery', 'delivered'), 'ROLE: Courier can transition out_for_delivery -> delivered');
  assert(!canRoleTransitionOrder('courier', 'pending', 'in_washing'), 'ROLE: Courier CANNOT transition pending -> in_washing');

  // Admin Permissions
  assert(canRoleTransitionOrder('platform_admin', 'pending', 'assigned'), 'ROLE: Admin can execute any valid transition (pending -> assigned)');
  assert(canRoleTransitionOrder('admin', 'in_washing', 'ready_for_delivery'), 'ROLE: Admin can execute any valid transition (in_washing -> ready_for_delivery)');
  assert(!canRoleTransitionOrder('admin', 'pending', 'delivered'), 'ROLE: Admin STILL CANNOT violate state machine graph (pending -> delivered)');

  console.log('\n==================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
