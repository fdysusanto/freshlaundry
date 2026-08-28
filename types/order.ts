import { UserRole } from './user';
import { AddressSnapshot } from './address';

export type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'in_washing'
  | 'ready_for_delivery'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'expired' | 'refund_pending' | 'refunded';

export type ServiceType = 'kiloan' | 'express' | 'dry_clean' | 'satuan';

export interface OrderItem {
  id: string;
  serviceId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: 'kg' | 'pcs';
  subtotal?: number;
}

export interface StatusLog {
  id: string;
  orderId: string;
  status: OrderStatus;
  notes?: string;
  updatedBy: string;
  timestamp: string;
}

export interface CourierInfo {
  id: string;
  name: string;
  phone?: string;
}

export interface Order {
  id: string;
  trackingNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  laundryId?: string;
  laundryName?: string;
  courierId?: string;
  courierName?: string;
  pickupCourier?: CourierInfo | null;
  deliveryCourier?: CourierInfo | null;
  serviceType: ServiceType;
  serviceName: string;
  status: OrderStatus;
  items: OrderItem[];
  estimatedWeightKg?: number;
  finalWeightKg?: number;
  pickupAddress: string;
  deliveryAddress: string;
  pickupAddressSnapshot?: AddressSnapshot;
  deliveryAddressSnapshot?: AddressSnapshot;
  pickupDate: string;
  pickupTimeSlot: string;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  notes?: string;
  subtotal?: number;
  deliveryFee?: number;
  platformFee?: number;
  discount?: number;
  totalPrice: number;
  paymentStatus: PaymentStatus;
  idempotencyKey?: string;
  assignmentId?: string;
  assignmentType?: 'pickup' | 'delivery';
  assignmentStatus?: 'offered' | 'accepted' | 'rejected' | 'expired' | 'completed';
  createdAt: string;
  updatedAt: string;
  logs: StatusLog[];
}

export interface CreateOrderPayload {
  laundryId?: string;
  serviceType?: ServiceType;
  serviceId?: string;
  pickupAddress: string;
  deliveryAddress: string;
  pickupAddressSnapshot?: AddressSnapshot;
  deliveryAddressSnapshot?: AddressSnapshot;
  pickupDate: string;
  pickupTimeSlot: string;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  estimatedWeightKg?: number;
  items?: Omit<OrderItem, 'id'>[];
  notes?: string;
  voucherCode?: string;
  idempotencyKey?: string;
}

/**
 * State Machine Transition Graph.
 * Maps current canonical OrderStatus to allowed next canonical OrderStatuses.
 */
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['picked_up', 'cancelled'],
  picked_up: ['in_washing'],
  in_washing: ['ready_for_delivery'],
  ready_for_delivery: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

/**
 * Normalizes legacy UI alias strings to canonical OrderStatus values.
 */
export function normalizeOrderStatus(rawStatus: string): OrderStatus {
  const clean = (rawStatus || '').trim().toLowerCase();
  switch (clean) {
    case 'pending':
    case 'pending_payment':
    case 'paid':
      return 'pending';
    case 'assigned':
    case 'waiting_pickup':
      return 'assigned';
    case 'picked_up':
      return 'picked_up';
    case 'in_washing':
    case 'processing':
      return 'in_washing';
    case 'ready_for_delivery':
    case 'ready':
      return 'ready_for_delivery';
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'delivered':
    case 'completed':
      return 'delivered';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

/**
 * Checks whether a transition from currentStatus to targetStatus is valid according to the State Machine.
 */
export function canTransitionOrderStatus(currentStatus: OrderStatus, targetStatus: OrderStatus): boolean {
  const allowedNext = VALID_ORDER_TRANSITIONS[currentStatus] || [];
  return allowedNext.includes(targetStatus);
}

/**
 * Checks whether a role is authorized to transition an order from currentStatus to targetStatus.
 */
export function canRoleTransitionOrder(
  role: UserRole | string,
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): boolean {
  if (!canTransitionOrderStatus(currentStatus, targetStatus)) {
    return false;
  }

  const cleanRole = (role || '').trim().toLowerCase();

  switch (cleanRole) {
    case 'platform_admin':
    case 'admin':
      return true;

    case 'customer':
      // Customers can only cancel orders in pending or assigned states
      return targetStatus === 'cancelled' && (currentStatus === 'pending' || currentStatus === 'assigned');

    case 'laundry_owner':
    case 'laundry_staff':
      // Laundry partners can assign courier, cancel pre-pickup orders, process laundry, or mark ready
      if (currentStatus === 'pending' && targetStatus === 'assigned') return true;
      if ((currentStatus === 'pending' || currentStatus === 'assigned') && targetStatus === 'cancelled') return true;
      if (currentStatus === 'picked_up' && targetStatus === 'in_washing') return true;
      if (currentStatus === 'in_washing' && targetStatus === 'ready_for_delivery') return true;
      return false;

    case 'courier':
      // Couriers execute pickup, start delivery, or mark delivered
      if (currentStatus === 'assigned' && targetStatus === 'picked_up') return true;
      if (currentStatus === 'ready_for_delivery' && targetStatus === 'out_for_delivery') return true;
      if (currentStatus === 'out_for_delivery' && targetStatus === 'delivered') return true;
      return false;

    default:
      return false;
  }
}

/**
 * Returns allowed next statuses for a given current status and optional role.
 */
export function getAllowedNextStatuses(currentStatus: OrderStatus, role?: UserRole | string): OrderStatus[] {
  const possibleNext = VALID_ORDER_TRANSITIONS[currentStatus] || [];
  if (!role) {
    return possibleNext;
  }
  return possibleNext.filter((next) => canRoleTransitionOrder(role, currentStatus, next));
}


