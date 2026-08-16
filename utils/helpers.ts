import { OrderStatus, normalizeOrderStatus, getAllowedNextStatuses, canTransitionOrderStatus, canRoleTransitionOrder } from '@/types/order';
import { ORDER_STATUS_CONFIG } from './constants';

export { normalizeOrderStatus, canTransitionOrderStatus, canRoleTransitionOrder };

export function getStatusConfig(status: string | OrderStatus) {
  const canonical = normalizeOrderStatus(status);
  return ORDER_STATUS_CONFIG[canonical] || {
    label: canonical,
    description: '',
    color: 'text-gray-700',
    bg: 'bg-gray-50 border-gray-200',
    stepIndex: 0,
  };
}

export function getNextPossibleStatuses(currentStatus: string | OrderStatus, role?: string): OrderStatus[] {
  const canonical = normalizeOrderStatus(currentStatus);
  return getAllowedNextStatuses(canonical, role);
}

