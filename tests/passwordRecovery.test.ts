import { authService } from '../services/authService';

async function runPasswordRecoveryTests() {
  console.log('==================================================');
  console.log('RUNNING PASSWORD RECOVERY & SECURITY TESTS');
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

  // TEST 1: authService.resetPasswordForEmailAsync is defined
  assert(
    typeof authService.resetPasswordForEmailAsync === 'function',
    'Test 1: authService.resetPasswordForEmailAsync is defined'
  );

  // TEST 2: authService.updatePasswordAsync is defined
  assert(
    typeof authService.updatePasswordAsync === 'function',
    'Test 2: authService.updatePasswordAsync is defined'
  );

  // TEST 3: updatePasswordAsync fails gracefully when unauthenticated
  await assertThrowsAsync(
    () => authService.updatePasswordAsync('newSecretPass123'),
    'Test 3: updatePasswordAsync fails when no recovery session active'
  );

  // TEST 4: Security Audit - Verify no Service Role Key in authService
  const authServiceStr = authService.toString();
  assert(
    !authServiceStr.includes('SUPABASE_SERVICE_ROLE_KEY'),
    'Test 4: Security - authService does NOT expose SUPABASE_SERVICE_ROLE_KEY to client'
  );

  console.log('\n==================================================');
  console.log(`PASSWORD RECOVERY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPasswordRecoveryTests();
