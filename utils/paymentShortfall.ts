import { Order } from '@/types/order';

/**
 * Source of Truth helper to determine if an order currently has an outstanding payment shortfall
 * (KURANG BAYAR).
 *
 * Rules:
 * 1. finalWeightKg must be defined (weighed by courier/laundry).
 * 2. finalWeightKg > estimatedWeightKg (or initial estimated weight).
 * 3. The weight increase adjustment payment status is NOT 'paid'.
 *    (If adjustmentStatus is 'paid', isShortfall is false - Scenario C).
 */
export function calculateOrderShortfall(
  order: Pick<Order, 'finalWeightKg' | 'estimatedWeightKg' | 'paymentStatus'>,
  adjustmentStatus?: 'paid' | 'pending' | 'none'
): {
  isShortfall: boolean;
  hasExtraWeight: boolean;
  adjustmentStatus: 'paid' | 'pending' | 'none';
} {
  const hasExtraWeight = Boolean(
    order.finalWeightKg !== undefined &&
    order.finalWeightKg !== null &&
    (order.estimatedWeightKg === undefined || order.finalWeightKg > order.estimatedWeightKg)
  );

  const effAdjStatus = adjustmentStatus ?? 'none';
  const isShortfall = hasExtraWeight && effAdjStatus !== 'paid';

  return {
    isShortfall,
    hasExtraWeight,
    adjustmentStatus: effAdjStatus,
  };
}
