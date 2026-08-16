export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

export interface PaymentAttempt {
  id: string;
  orderId: string;
  customerId: string;
  provider: string;
  providerReference?: string;
  paymentMethod: string;
  amount: number; // Integer IDR
  currency: 'IDR';
  status: PaymentStatus;
  idempotencyKey: string;
  expiresAt?: string;
  paidAt?: string;
  invoiceUrl?: string;
  rawResponse?: any;
  createdAt: string;
  updatedAt: string;
}

/**
 * State Machine Transition Graph for Payments.
 * Maps current PaymentStatus to allowed next PaymentStatuses.
 */
export const VALID_PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  unpaid: ['pending'],
  pending: ['paid', 'failed', 'expired'],
  paid: ['refunded'],
  failed: [],
  expired: [],
  refunded: [],
};

/**
 * Normalizes raw status string to canonical PaymentStatus.
 */
export function normalizePaymentStatus(rawStatus: string): PaymentStatus {
  const clean = (rawStatus || '').trim().toLowerCase();
  switch (clean) {
    case 'unpaid':
      return 'unpaid';
    case 'pending':
      return 'pending';
    case 'paid':
      return 'paid';
    case 'failed':
      return 'failed';
    case 'expired':
      return 'expired';
    case 'refunded':
      return 'refunded';
    default:
      return 'unpaid';
  }
}

/**
 * Checks whether a transition from currentStatus to targetStatus is valid in the Payment State Machine.
 */
export function canTransitionPaymentStatus(currentStatus: PaymentStatus, targetStatus: PaymentStatus): boolean {
  const allowed = VALID_PAYMENT_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}
