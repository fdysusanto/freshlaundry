import { Order } from '@/types/order';

export interface ShortfallResult {
  isShortfall: boolean;
  hasExtraWeight: boolean;
  adjustmentStatus: 'paid' | 'pending' | 'none';
  amount: number;
}

/**
 * Source of Truth helper to determine if an order currently has an outstanding payment shortfall
 * (KURANG BAYAR) and calculate the nominal amount.
 *
 * Rules:
 * 1. If adjustmentStatus is 'paid', isShortfall is FALSE and amount = 0 (Scenario C).
 * 2. If adjustmentStatus is 'pending', isShortfall is TRUE. Nominal amount prioritizes adjustmentInfo.amount.
 * 3. If no adjustment attempt exists yet ('none'), but finalWeightKg > estimatedWeightKg,
 *    calculate canonical nominal shortfall based on weight delta and unit price.
 */
export function calculateOrderShortfall(
  order: Pick<Order, 'finalWeightKg' | 'estimatedWeightKg' | 'paymentStatus' | 'items' | 'totalPrice'>,
  adjustmentStatus?: 'paid' | 'pending' | 'none',
  adjustmentAmount?: number
): ShortfallResult {
  const effAdjStatus = adjustmentStatus ?? 'none';

  if (effAdjStatus === 'paid') {
    return {
      isShortfall: false,
      hasExtraWeight: Boolean(
        order.finalWeightKg !== undefined &&
        order.finalWeightKg !== null &&
        (order.estimatedWeightKg === undefined || order.finalWeightKg > order.estimatedWeightKg)
      ),
      adjustmentStatus: 'paid',
      amount: 0,
    };
  }

  const estWeight = order.estimatedWeightKg !== undefined && order.estimatedWeightKg !== null ? order.estimatedWeightKg : 5;
  const finalWeight = order.finalWeightKg;

  const hasExtraWeight = Boolean(
    finalWeight !== undefined &&
    finalWeight !== null &&
    finalWeight > estWeight
  );

  const isShortfall = (effAdjStatus === 'pending') || hasExtraWeight;

  let calculatedAmount = 0;
  if (isShortfall) {
    if (adjustmentAmount !== undefined && adjustmentAmount > 0) {
      calculatedAmount = adjustmentAmount;
    } else if (hasExtraWeight && finalWeight !== undefined && finalWeight !== null) {
      const weightDelta = finalWeight - estWeight;
      const unitPrice = order.items && order.items[0] && order.items[0].unitPrice ? order.items[0].unitPrice : 8000;
      calculatedAmount = Math.round(weightDelta * unitPrice);
    }
  }

  return {
    isShortfall,
    hasExtraWeight,
    adjustmentStatus: effAdjStatus,
    amount: calculatedAmount,
  };
}
