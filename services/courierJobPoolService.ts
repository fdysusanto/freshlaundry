import { supabase, isSupabaseConfigured } from './supabase';
import { orderService } from './orderService';
import { TIME_SLOTS, DEMO_USERS } from '../utils/constants';

export interface JobPoolSlotMetadata {
  jobType: 'pickup' | 'delivery';
  timeSlot: string;
  availableOrders: number;
  claimStatus: 'locked' | 'open' | 'empty' | 'full';
  claimableAt: string;
  maxCapacityPerCourier: number;
  remainingCapacity?: number;
}

export interface CourierJobPoolResponse {
  date: string;
  pickupSlots: JobPoolSlotMetadata[];
  deliverySlots: JobPoolSlotMetadata[];
}

export interface ClaimSlotRequest {
  date: string;
  jobType: 'pickup' | 'delivery';
  timeSlot: string;
}

export interface ClaimSlotResponse {
  success: boolean;
  jobType: 'pickup' | 'delivery';
  date: string;
  timeSlot: string;
  claimedCount: number;
  claimedOrderIds: string[];
  message?: string;
}

/**
 * Returns current date string in Asia/Jakarta WIB timezone (YYYY-MM-DD)
 */
export function getWibTodayDateString(now: Date = new Date()): string {
  const wibTimeMs = now.getTime() + 7 * 60 * 60 * 1000;
  const wibDate = new Date(wibTimeMs);
  return wibDate.toISOString().split('T')[0];
}

/**
 * Calculates claimableAt ISO timestamp (Slot Start - 15 minutes) for a slot and date in WIB
 */
export function getSlotClaimableAtIso(dateStr: string, timeSlotStr: string): string {
  const slotMatch = timeSlotStr ? timeSlotStr.match(/(\d{1,2}):(\d{2})/) : null;
  const startHour = slotMatch ? parseInt(slotMatch[1], 10) : 8;
  const startMinute = slotMatch ? parseInt(slotMatch[2], 10) : 0;

  const slotStartMs = new Date(`${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00.000+07:00`).getTime();
  const claimableMs = slotStartMs - 15 * 60 * 1000;
  return new Date(claimableMs).toISOString();
}

/**
 * Evaluates helper function if a courier slot is currently claimable
 */
export function isCourierSlotClaimable(
  dateStr: string,
  timeSlotStr: string,
  nowInput: Date | string = new Date()
): { isClaimable: boolean; claimableAtIso: string } {
  const now = typeof nowInput === 'string' ? new Date(nowInput) : nowInput;
  const claimableAtIso = getSlotClaimableAtIso(dateStr, timeSlotStr);
  const claimableMs = new Date(claimableAtIso).getTime();
  return {
    isClaimable: now.getTime() >= claimableMs,
    claimableAtIso,
  };
}

export const courierJobPoolService = {
  /**
   * Fetches aggregate metadata for Today's Courier Job Pool.
   * STRICT PII SECURITY: Returns ONLY aggregate metadata. NO customer names, addresses, or phones.
   */
  async getCourierJobPoolAsync(
    dateInput?: string,
    courierId?: string,
    nowInput: Date | string = new Date(),
    client?: any
  ): Promise<CourierJobPoolResponse> {
    const now = typeof nowInput === 'string' ? new Date(nowInput) : nowInput;
    const targetDate = dateInput || getWibTodayDateString(now);
    const db = client || supabase;

    const pickupSlots: JobPoolSlotMetadata[] = [];
    const deliverySlots: JobPoolSlotMetadata[] = [];

    for (const timeSlot of TIME_SLOTS) {
      const { isClaimable, claimableAtIso } = isCourierSlotClaimable(targetDate, timeSlot, now);

      let availablePickupCount = 0;
      let availableDeliveryCount = 0;

      let courierPickupClaimedCount = 0;
      let courierDeliveryClaimedCount = 0;

      // 1. Supabase Live DB Query Mode
      if (isSupabaseConfigured && db && typeof db.from === 'function') {
        // Query Available Pickup Orders (pending, paid, courier_id IS NULL)
        const { count: pCount } = await db
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('pickup_date', targetDate)
          .eq('pickup_time_slot', timeSlot)
          .eq('payment_status', 'paid')
          .eq('status', 'pending')
          .is('courier_id', null);

        availablePickupCount = pCount || 0;

        // Query Available Delivery Orders (ready_for_delivery, paid, courier_id IS NULL)
        const { count: dCount } = await db
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('delivery_date', targetDate)
          .eq('delivery_time_slot', timeSlot)
          .eq('payment_status', 'paid')
          .eq('status', 'ready_for_delivery')
          .is('courier_id', null);

        availableDeliveryCount = dCount || 0;

        // Query Courier's Existing Claimed Orders if courierId provided
        if (courierId) {
          const { count: cpCount } = await db
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('courier_id', courierId)
            .eq('pickup_date', targetDate)
            .eq('pickup_time_slot', timeSlot)
            .in('status', ['assigned', 'picked_up', 'in_washing', 'ready_for_delivery', 'out_for_delivery', 'delivered']);

          courierPickupClaimedCount = cpCount || 0;

          const { count: cdCount } = await db
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('courier_id', courierId)
            .eq('delivery_date', targetDate)
            .eq('delivery_time_slot', timeSlot)
            .in('status', ['out_for_delivery', 'delivered']);

          courierDeliveryClaimedCount = cdCount || 0;
        }
      } else {
        // 2. In-Memory Mock Fallback Query Mode
        const allOrders = orderService.getOrders();

        availablePickupCount = allOrders.filter(
          (o) =>
            o.pickupDate === targetDate &&
            o.pickupTimeSlot === timeSlot &&
            o.paymentStatus === 'paid' &&
            o.status === 'pending' &&
            !o.courierId
        ).length;

        availableDeliveryCount = allOrders.filter(
          (o) =>
            (o.deliveryDate || o.pickupDate) === targetDate &&
            (o.deliveryTimeSlot || o.pickupTimeSlot) === timeSlot &&
            o.paymentStatus === 'paid' &&
            o.status === 'ready_for_delivery' &&
            !o.courierId
        ).length;

        if (courierId) {
          courierPickupClaimedCount = allOrders.filter(
            (o) =>
              o.courierId === courierId &&
              o.pickupDate === targetDate &&
              o.pickupTimeSlot === timeSlot &&
              ['assigned', 'picked_up', 'in_washing', 'ready_for_delivery', 'out_for_delivery', 'delivered'].includes(o.status)
          ).length;

          courierDeliveryClaimedCount = allOrders.filter(
            (o) =>
              o.courierId === courierId &&
              (o.deliveryDate || o.pickupDate) === targetDate &&
              (o.deliveryTimeSlot || o.pickupTimeSlot) === timeSlot &&
              ['out_for_delivery', 'delivered'].includes(o.status)
          ).length;
        }
      }

      // Compute Pickup Claim Status
      let pickupClaimStatus: 'locked' | 'open' | 'empty' | 'full' = 'locked';
      if (!isClaimable) {
        pickupClaimStatus = 'locked';
      } else if (courierId && courierPickupClaimedCount >= 5) {
        pickupClaimStatus = 'full';
      } else if (availablePickupCount === 0) {
        pickupClaimStatus = 'empty';
      } else {
        pickupClaimStatus = 'open';
      }

      // Compute Delivery Claim Status
      let deliveryClaimStatus: 'locked' | 'open' | 'empty' | 'full' = 'locked';
      if (!isClaimable) {
        deliveryClaimStatus = 'locked';
      } else if (courierId && courierDeliveryClaimedCount >= 5) {
        deliveryClaimStatus = 'full';
      } else if (availableDeliveryCount === 0) {
        deliveryClaimStatus = 'empty';
      } else {
        deliveryClaimStatus = 'open';
      }

      pickupSlots.push({
        jobType: 'pickup',
        timeSlot,
        availableOrders: availablePickupCount,
        claimStatus: pickupClaimStatus,
        claimableAt: claimableAtIso,
        maxCapacityPerCourier: 5,
        remainingCapacity: Math.max(0, 5 - courierPickupClaimedCount),
      });

      deliverySlots.push({
        jobType: 'delivery',
        timeSlot,
        availableOrders: availableDeliveryCount,
        claimStatus: deliveryClaimStatus,
        claimableAt: claimableAtIso,
        maxCapacityPerCourier: 5,
        remainingCapacity: Math.max(0, 5 - courierDeliveryClaimedCount),
      });
    }

    return {
      date: targetDate,
      pickupSlots,
      deliverySlots,
    };
  },

  /**
   * Executes atomic slot claim via orderService.claimSlotJobBatchAsync
   */
  async claimCourierSlotAsync(
    params: {
      courierId: string;
      jobDate: string;
      jobType: 'pickup' | 'delivery';
      timeSlot: string;
      maxCapacity?: number;
      nowInput?: Date | string;
    },
    client?: any
  ): Promise<ClaimSlotResponse> {
    const res = await orderService.claimSlotJobBatchAsync(
      params.courierId,
      params.jobDate,
      params.jobType,
      params.timeSlot,
      params.maxCapacity || 5,
      params.nowInput || new Date(),
      client
    );

    return {
      success: res.success,
      jobType: params.jobType,
      date: params.jobDate,
      timeSlot: params.timeSlot,
      claimedCount: res.claimedCount,
      claimedOrderIds: res.claimedOrderIds,
    };
  },
};
