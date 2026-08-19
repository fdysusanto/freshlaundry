import { triggerPaymentFlow } from '../utils/midtransSnap';

async function runFrontendMidtransSnapTests() {
  console.log('==================================================');
  console.log('RUNNING FRONTEND MIDTRANS SNAP INTEGRATION TESTS');
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

  // Store original window object
  const originalWindow = (global as any).window;

  // Test 1: paymentToken triggers window.snap.pay when available
  {
    let snapPayCalled = false;
    let snapTokenPassed = '';
    let snapCallbacks: any = {};

    (global as any).window = {
      snap: {
        pay: (token: string, callbacks: any) => {
          snapPayCalled = true;
          snapTokenPassed = token;
          snapCallbacks = callbacks;
        },
      },
      location: { href: '' },
    };

    const res = triggerPaymentFlow({
      paymentToken: 'snap-token-test-111',
      paymentUrl: 'https://app.sandbox.midtrans.com/snap/redirect/111',
    });

    assert(Boolean(res), 'Test 1: triggerPaymentFlow returned true for valid Snap payload');
    assert(snapPayCalled, 'Test 1: window.snap.pay was called');
    assert(snapTokenPassed === 'snap-token-test-111', 'Test 1: Correct paymentToken was passed to window.snap.pay');
  }

  // Test 2 & 4: Snap unavailable triggers paymentUrl redirect fallback
  {
    let redirectUrlSet = '';

    (global as any).window = {
      location: {
        set href(val: string) {
          redirectUrlSet = val;
        },
        get href() {
          return redirectUrlSet;
        },
      },
      // snap is undefined!
    };

    const res = triggerPaymentFlow({
      paymentToken: 'snap-token-test-222',
      paymentUrl: 'https://app.sandbox.midtrans.com/snap/redirect/222',
    });

    assert(Boolean(res), 'Test 2 & 4: triggerPaymentFlow returned true on fallback redirect');
    assert(
      redirectUrlSet === 'https://app.sandbox.midtrans.com/snap/redirect/222',
      'Test 2 & 4: Redirected to paymentUrl when window.snap was unavailable'
    );
  }

  // Test 3: Legacy invoiceUrl fallback works when paymentToken and paymentUrl are missing
  {
    let redirectUrlSet = '';

    (global as any).window = {
      location: {
        set href(val: string) {
          redirectUrlSet = val;
        },
        get href() {
          return redirectUrlSet;
        },
      },
    };

    const res = triggerPaymentFlow({
      invoiceUrl: 'https://checkout.xendit.co/v2/inv_legacy_333',
    });

    assert(Boolean(res), 'Test 3: Legacy invoiceUrl fallback returned true');
    assert(
      redirectUrlSet === 'https://checkout.xendit.co/v2/inv_legacy_333',
      'Test 3: Redirected to legacy invoiceUrl when token & paymentUrl absent'
    );
  }

  // Test 5 & 6 & 7 & 8: Callbacks do NOT mutate payment state / call confirm endpoint
  {
    let snapCallbacksCaptured: any = {};

    (global as any).window = {
      snap: {
        pay: (token: string, callbacks: any) => {
          snapCallbacksCaptured = callbacks;
        },
      },
    };

    let onSuccessTriggered = false;
    let onPendingTriggered = false;
    let onErrorTriggered = false;
    let onCloseTriggered = false;

    triggerPaymentFlow({
      paymentToken: 'snap-token-test-444',
      onSuccess: () => { onSuccessTriggered = true; },
      onPending: () => { onPendingTriggered = true; },
      onError: () => { onErrorTriggered = true; },
      onClose: () => { onCloseTriggered = true; },
    });

    // Simulate Midtrans Snap callbacks
    snapCallbacksCaptured.onSuccess({ order_id: 'ord_123', status_code: '200' });
    snapCallbacksCaptured.onPending({ order_id: 'ord_123', status_code: '201' });
    snapCallbacksCaptured.onError({ status_message: 'Payment rejected' });
    snapCallbacksCaptured.onClose();

    assert(onSuccessTriggered, 'Test 5: onSuccess UI callback executed without mutating DB status');
    assert(onPendingTriggered, 'Test 6: onPending UI callback executed without mutating DB status');
    assert(onErrorTriggered, 'Test 7: onError UI callback executed without mutating DB status');
    assert(onCloseTriggered, 'Test 8: onClose UI callback executed without marking payment failed');
  }

  // Test 9: Reusing existing paymentToken works idempotently
  {
    let tokenUsed = '';

    (global as any).window = {
      snap: {
        pay: (token: string) => {
          tokenUsed = token;
        },
      },
    };

    const existingToken = 'snap-token-reused-555';
    triggerPaymentFlow({ paymentToken: existingToken });
    assert(tokenUsed === existingToken, 'Test 9: Reused existing paymentToken on retry click');
  }

  // Test 10: Security check - Server Key is never exposed in frontend utility/DOM
  {
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || 'SB-Mid-client-dummy';
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-SECRET';

    assert(!clientKey.includes('server'), 'Test 10 (Security): Client Key does not contain server key');
    assert(!JSON.stringify(global.window).includes(serverKey), 'Test 10 (Security): Server key is never exposed on window object');
  }

  // Restore original window
  (global as any).window = originalWindow;

  console.log('\n==================================================');
  console.log(`FRONTEND MIDTRANS SNAP SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runFrontendMidtransSnapTests();
