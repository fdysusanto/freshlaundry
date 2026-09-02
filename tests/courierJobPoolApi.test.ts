import { GET as getJobPoolRoute } from '../app/api/courier/job-pool/route';
import { POST as claimSlotRoute } from '../app/api/courier/claim-slot/route';
import { orderService } from '../services/orderService';
import { authService } from '../services/authService';
import { DEMO_USERS, TIME_SLOTS } from '../utils/constants';

async function runCourierJobPoolApiTests() {
  console.log('==================================================');
  console.log('RUNNING COURIER JOB POOL API & SECURITY SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  const dateToday = '2026-09-05';
  const slot1 = TIME_SLOTS[0]; // '08:00 - 10:00 WIB'

  const courierUser = DEMO_USERS.find((u) => u.role === 'courier' && u.id === 'usr_courier_01') || DEMO_USERS[1];
  const customerUser = DEMO_USERS.find((u) => u.role === 'customer') || DEMO_USERS[0];

  function buildCandidateOrder(id: string, pickupDate: string, pickupSlot: string) {
    const o = {
      id,
      trackingNumber: `LND-API-${id}`,
      customerId: customerUser.id,
      customerName: customerUser.fullName,
      customerPhone: customerUser.phone,
      laundryId: 'lnd_001',
      serviceType: 'kiloan' as const,
      serviceName: 'Cuci Komplit',
      items: [{ id: `item_${id}`, serviceId: 'srv_001', name: 'Cuci Komplit', unitPrice: 8000, unit: 'kg' as const, quantity: 5, estimatedHours: 48 }],
      subtotalPrice: 40000,
      deliveryFee: 0,
      platformFee: 2000,
      totalPrice: 42000,
      status: 'pending',
      paymentStatus: 'paid',
      pickupAddress: 'Jl. Merdeka No. 10',
      deliveryAddress: 'Jl. Merdeka No. 10',
      pickupDate,
      pickupTimeSlot: pickupSlot,
      deliveryDate: '2026-09-07',
      deliveryTimeSlot: slot1,
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orderService.getOrders().push(o as any);
    return o;
  }

  // TEST 10 — Valid Courier Claim API Call (Returns max 5 orders)
  orderService.getOrders().length = 0;
  for (let i = 1; i <= 7; i++) {
    buildCandidateOrder(`ord_api_${i}`, dateToday, slot1);
  }

  authService.setCurrentUser(courierUser);
  const reqClaim1 = new Request('http://localhost:3000/api/courier/claim-slot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: dateToday, jobType: 'pickup', timeSlot: slot1, nowInput: `${dateToday}T07:45:00+07:00` }),
  });

  const resClaim1 = await claimSlotRoute(reqClaim1);
  const dataClaim1 = await resClaim1.json();
  assert(
    resClaim1.status === 200 && dataClaim1.success === true && dataClaim1.claimedCount === 5,
    'TEST 10: Valid Courier Claim API Call returns HTTP 200 and claims MAX 5 orders',
    JSON.stringify(dataClaim1)
  );

  // TEST 11 — Double-Click Idempotency (Second claim attempt by same courier does NOT exceed max 5 orders)
  const reqClaim2 = new Request('http://localhost:3000/api/courier/claim-slot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: dateToday, jobType: 'pickup', timeSlot: slot1, nowInput: `${dateToday}T07:45:00+07:00` }),
  });

  const resClaim2 = await claimSlotRoute(reqClaim2);
  const dataClaim2 = await resClaim2.json();
  assert(
    resClaim2.status === 400 && dataClaim2.error?.code === 'MAX_CAPACITY_REACHED',
    'TEST 11: Double-Click claim attempt by same courier rejected with MAX_CAPACITY_REACHED (No capacity overflow)',
    JSON.stringify(dataClaim2)
  );

  // TEST 12 — Direct Customer API Bypass Protection (Customer role calling /api/courier/job-pool -> HTTP 403)
  authService.setCurrentUser(customerUser);
  const reqPoolCustomer = new Request(`http://localhost:3000/api/courier/job-pool?date=${dateToday}`, {
    method: 'GET',
  });

  const resPoolCustomer = await getJobPoolRoute(reqPoolCustomer);
  const dataPoolCustomer = await resPoolCustomer.json();
  assert(
    resPoolCustomer.status === 403 && dataPoolCustomer.success === false,
    'TEST 12: Direct Customer API Bypass on /api/courier/job-pool REJECTED with HTTP 403 Forbidden'
  );

  // TEST 13 — Direct Customer API Bypass Protection (Customer role calling /api/courier/claim-slot -> HTTP 403)
  const reqClaimCustomer = new Request('http://localhost:3000/api/courier/claim-slot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: dateToday, jobType: 'pickup', timeSlot: slot1 }),
  });

  const resClaimCustomer = await claimSlotRoute(reqClaimCustomer);
  const dataClaimCustomer = await resClaimCustomer.json();
  assert(
    resClaimCustomer.status === 403 && dataClaimCustomer.success === false,
    'TEST 13: Direct Customer API Bypass on /api/courier/claim-slot REJECTED with HTTP 403 Forbidden'
  );

  // TEST 14 — Unauthenticated API Call Protection (Unauthenticated request -> HTTP 401)
  const reqUnauth = new Request(`http://localhost:3000/api/courier/job-pool?date=${dateToday}`, {
    method: 'GET',
    headers: { 'x-unauthenticated': 'true' },
  });

  const resUnauth = await getJobPoolRoute(reqUnauth);
  const dataUnauth = await resUnauth.json();
  assert(
    resUnauth.status === 401 && dataUnauth.success === false,
    'TEST 14: Unauthenticated API call to /api/courier/job-pool REJECTED with HTTP 401 Unauthorized'
  );

  // Restore courier session
  authService.setCurrentUser(courierUser);

  console.log('\n==================================================');
  console.log(`COURIER JOB POOL API TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCourierJobPoolApiTests().catch((err) => {
  console.error('Fatal Error running courier job pool API tests:', err);
  process.exit(1);
});
