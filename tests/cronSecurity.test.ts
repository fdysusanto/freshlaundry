import { NextRequest } from 'next/server';
import { POST as handlePickupsPost, GET as handlePickupsGet } from '../app/api/cron/process-scheduled-pickups/route';
import { POST as handleDeliveriesPost, GET as handleDeliveriesGet } from '../app/api/cron/process-scheduled-deliveries/route';
import { POST as handleExpiredPost, GET as handleExpiredGet } from '../app/api/cron/process-expired-batches/route';
import { verifyCronAuth } from '../utils/cronAuth';

async function runCronSecurityTests() {
  console.log('==================================================');
  console.log('RUNNING PRODUCTION CRON SECURITY & AUTHENTICATION TESTS');
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

  const TEST_SECRET = 'test_cron_secret_production_2026';
  const originalEnvSecret = process.env.CRON_SECRET;

  try {
    // 1. HARDENED SECURITY TEST: Missing CRON_SECRET env var returns 500 configuration error
    delete process.env.CRON_SECRET;
    const reqNoEnv = new NextRequest('http://localhost:3000/api/cron/process-expired-batches', {
      method: 'GET',
      headers: { 'x-cron-secret': 'freshlaundry_cron_secret_2026' },
    });
    const resNoEnv = await handleExpiredGet(reqNoEnv);
    const bodyNoEnv = await resNoEnv.json();

    assert(
      resNoEnv.status === 500 && bodyNoEnv.message.includes('CRON_SECRET belum dikonfigurasi'),
      'Cron Security 1: Missing CRON_SECRET env var returns 500 configuration error (no hardcoded fallback)'
    );

    // Set valid test env var
    process.env.CRON_SECRET = TEST_SECRET;

    // 2. UNAUTHENTICATED REQUESTS -> 401
    const reqNoAuth = new NextRequest('http://localhost:3000/api/cron/process-expired-batches', { method: 'GET' });
    const resNoAuth = await handleExpiredGet(reqNoAuth);
    assert(resNoAuth.status === 401, 'Cron Security 2: Unauthenticated GET request to process-expired-batches returns 401');

    // 3. INVALID SECRET -> 401
    const reqBadAuth = new NextRequest('http://localhost:3000/api/cron/process-expired-batches', {
      method: 'GET',
      headers: { authorization: 'Bearer wrong_secret' },
    });
    const resBadAuth = await handleExpiredGet(reqBadAuth);
    assert(resBadAuth.status === 401, 'Cron Security 3: Invalid Authorization Bearer secret returns 401');

    // 4. VERCEL CRON NATIVE AUTH: GET + Authorization: Bearer <CRON_SECRET> -> 200 OK
    const routesToTest = [
      { name: 'process-scheduled-pickups', handlerGet: handlePickupsGet, handlerPost: handlePickupsPost },
      { name: 'process-scheduled-deliveries', handlerGet: handleDeliveriesGet, handlerPost: handleDeliveriesPost },
      { name: 'process-expired-batches', handlerGet: handleExpiredGet, handlerPost: handleExpiredPost },
    ];

    for (const r of routesToTest) {
      // GET + Authorization: Bearer
      const reqBearer = new NextRequest(`http://localhost:3000/api/cron/${r.name}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${TEST_SECRET}` },
      });
      const resBearer = await r.handlerGet(reqBearer);
      assert(resBearer.status === 200, `Cron Security 4: GET /api/cron/${r.name} with Authorization Bearer returns 200 OK`);

      // POST + x-cron-secret
      const reqXCron = new NextRequest(`http://localhost:3000/api/cron/${r.name}`, {
        method: 'POST',
        headers: { 'x-cron-secret': TEST_SECRET },
      });
      const resXCron = await r.handlerPost(reqXCron);
      assert(resXCron.status === 200, `Cron Security 5: POST /api/cron/${r.name} with x-cron-secret returns 200 OK`);
    }

    console.log('\n==================================================');
    console.log(`CRON SECURITY TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    if (originalEnvSecret) {
      process.env.CRON_SECRET = originalEnvSecret;
    } else {
      delete process.env.CRON_SECRET;
    }
  }
}

runCronSecurityTests().catch((err) => {
  console.error('Fatal Error running cron security tests:', err);
  process.exit(1);
});
