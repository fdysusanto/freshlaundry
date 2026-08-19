declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: any) => void;
          onPending?: (result: any) => void;
          onError?: (result: any) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

export interface PaymentTriggerInput {
  paymentToken?: string;
  paymentUrl?: string;
  invoiceUrl?: string;
  onSuccess?: (result?: any) => void;
  onPending?: (result?: any) => void;
  onError?: (errorMsg?: string) => void;
  onClose?: () => void;
}

/**
 * Triggers Midtrans Snap payment popup if available with paymentToken,
 * or falls back to redirect URL (paymentUrl -> legacy invoiceUrl).
 * Frontend callbacks are strictly UI-only and NEVER mutate backend payment status directly.
 */
export function triggerPaymentFlow(input: PaymentTriggerInput): boolean {
  const { paymentToken, paymentUrl, invoiceUrl, onSuccess, onPending, onError, onClose } = input;

  // 1. Preferred: Midtrans Snap.js Popup Modal
  if (paymentToken && typeof window !== 'undefined' && window.snap && typeof window.snap.pay === 'function') {
    try {
      window.snap.pay(paymentToken, {
        onSuccess: (result) => {
          if (onSuccess) onSuccess(result);
        },
        onPending: (result) => {
          if (onPending) onPending(result);
        },
        onError: (err) => {
          const safeMsg = typeof err === 'string' ? err : err?.status_message || 'Gagal memproses pembayaran via gateway.';
          if (onError) onError(safeMsg);
        },
        onClose: () => {
          if (onClose) onClose();
        },
      });
      return true; // Successfully opened Snap popup
    } catch {
      // Fall through to redirect fallback if snap.pay throws
    }
  }

  // 2. Fallback: Midtrans Snap Redirect URL
  const targetRedirectUrl = paymentUrl || invoiceUrl;
  if (targetRedirectUrl && typeof targetRedirectUrl === 'string' && targetRedirectUrl.startsWith('http')) {
    if (typeof window !== 'undefined') {
      window.location.href = targetRedirectUrl;
    }
    return true; // Triggered redirect
  }

  if (onError) {
    onError('Token pembayaran atau URL pembayaran tidak valid.');
  }
  return false;
}
