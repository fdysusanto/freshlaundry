import { isSupabaseConfigured, supabase, createServiceRoleClient } from './supabase';
import { notificationService } from './notificationService';
import { UserProfile } from '@/types/user';
import { DEMO_USERS, TIME_SLOTS } from '@/utils/constants';

// =============================================================================
// CENTRALIZED DISPATCH ENGINE CONFIGURATION CONSTANTS
// =============================================================================
export const DISPATCH_CONFIG = {
  MAX_BATCH_SIZE: 10,
  OFFER_TIMEOUT_SECONDS: 60,
  INITIAL_RADIUS_KM: 3,
  SECOND_RADIUS_KM: 5,
  MAX_RADIUS_KM: 10,
  MAX_BATCHES: 3,
  HEARTBEAT_THRESHOLD_MINUTES: 5,
};

export interface CourierCandidate {
  id: string;
  fullName: string;
  phone: string;
  isOnline: boolean;
  latitude: number | null;
  longitude: number | null;
  districtCode: string | null;
  villageCode: string | null;
  lastSeenAt: string | null;
  distanceKm: number;
}

export interface DispatchStatusResult {
  hasActiveDispatch: boolean;
  batchNumber: number;
  radiusKm: number;
  offeredCount: number;
  acceptedCount: number;
  status: 'active' | 'expired' | 'completed' | 'cancelled' | 'idle';
  expiresAt: string | null;
  winnerCourierName?: string;
  message?: string;
  isNewBatch?: boolean;
}

export interface DeliverySchedulerDetail {
  orderId: string;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  currentTimeWib: string;
  result: 'dispatched' | 'skipped' | 'failed';
  reason?: string;
}

export interface DeliverySchedulerSummary {
  scanned: number;
  eligible: number;
  dispatched: number;
  skipped: number;
  failed: number;
  details: DeliverySchedulerDetail[];
}

export interface PickupSchedulerDetail {
  orderId: string;
  pickupDate?: string;
  pickupTimeSlot?: string;
  currentTimeWib: string;
  result: 'dispatched' | 'skipped' | 'failed';
  reason?: string;
}

export interface PickupSchedulerSummary {
  scanned: number;
  eligible: number;
  dispatched: number;
  skipped: number;
  failed: number;
  details: PickupSchedulerDetail[];
}

// In-memory fallback dispatch batches for local dev/mock mode
interface MockDispatchBatch {
  id: string;
  orderId: string;
  assignmentType: 'pickup' | 'delivery';
  batchNumber: number;
  radiusKm: number;
  status: 'active' | 'expired' | 'completed' | 'cancelled';
  startedAt: string;
  expiresAt: string;
  offeredCourierIds: string[];
}

const mockDispatchBatches: MockDispatchBatch[] = [];

/**
 * Calculates straight-line geographic distance between two lat/lng coordinates in kilometers (Haversine Formula).
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100; // Rounded to 2 decimal places
}

/**
 * Checks if current time in Asia/Jakarta (WIB) has reached or passed the scheduled delivery window.
 */
export function isDeliveryDispatchWindowDue(
  deliveryDate?: string,
  deliveryTimeSlot?: string,
  nowInput: Date | string = new Date()
): boolean {
  // Legacy orders without delivery schedule are immediately due
  if (!deliveryDate) return true;

  const now = typeof nowInput === 'string' ? new Date(nowInput) : nowInput;
  if (isNaN(now.getTime())) return false;

  // Strict YYYY-MM-DD format check
  const dateMatch = deliveryDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    console.warn(`[DELIVERY_SCHEDULER_ANOMALY] Format deliveryDate '${deliveryDate}' tidak valid.`);
    return false; // Rule E: Scheduling Anomaly
  }
  const [, targetYear, targetMonth, targetDay] = dateMatch;
  const month = parseInt(targetMonth, 10);
  const day = parseInt(targetDay, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    console.warn(`[DELIVERY_SCHEDULER_ANOMALY] Komponen tanggal '${deliveryDate}' di luar rentang kalender.`);
    return false; // Rule E
  }

  // Parse time slot start hour & minute
  let startHour = 0;
  let startMinute = 0;
  if (deliveryTimeSlot) {
    const slotMatch = deliveryTimeSlot.match(/(\d{1,2}):(\d{2})/);
    if (!slotMatch) {
      console.warn(`[DELIVERY_SCHEDULER_ANOMALY] Format deliveryTimeSlot '${deliveryTimeSlot}' tidak valid.`);
      return false; // Rule E: Scheduling Anomaly
    }
    startHour = parseInt(slotMatch[1], 10);
    startMinute = parseInt(slotMatch[2], 10);
    if (startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59) {
      console.warn(`[DELIVERY_SCHEDULER_ANOMALY] Komponen jam '${deliveryTimeSlot}' di luar rentang 24 jam.`);
      return false; // Rule E
    }
  }

  // Construct target Window Start Timestamp in Asia/Jakarta (+07:00)
  const windowStartIso = `${targetYear}-${targetMonth}-${targetDay}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00.000+07:00`;
  const windowStart = new Date(windowStartIso);
  if (isNaN(windowStart.getTime())) {
    console.warn(`[DELIVERY_SCHEDULER_ANOMALY] Gagal mengonstruksi timestamp windowStart dari '${deliveryDate} ${deliveryTimeSlot}'.`);
    return false; // Rule E
  }

  return now.getTime() >= windowStart.getTime();
}

/**
 * Helper to determine if a customer is allowed to SELECT a specific pickup slot.
 * RULE: A slot is AVAILABLE for customer selection ONLY IF slot.start > current business time in Asia/Jakarta (WIB, UTC+7).
 * - Future pickup date: All valid slots are selectable.
 * - Past pickup date: Unselectable (false).
 * - Today pickup date: Selectable ONLY IF slot.start > current WIB time.
 * - Invalid date or time slot format: Unselectable (false).
 */
export function isPickupSlotSelectable(
  pickupDateStr?: string,
  pickupTimeSlotStr?: string,
  nowInput: Date | string = new Date()
): boolean {
  if (!pickupDateStr || !pickupTimeSlotStr) return false;

  const now = typeof nowInput === 'string' ? new Date(nowInput) : nowInput;
  if (isNaN(now.getTime())) return false;

  const dateMatch = pickupDateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return false;

  const [, targetYear, targetMonth, targetDay] = dateMatch;
  const month = parseInt(targetMonth, 10);
  const day = parseInt(targetDay, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const slotMatch = pickupTimeSlotStr.match(/(\d{1,2}):(\d{2})/);
  if (!slotMatch) return false;

  const startHour = parseInt(slotMatch[1], 10);
  const startMinute = parseInt(slotMatch[2], 10);
  if (startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59) return false;

  const windowStartIso = `${targetYear}-${targetMonth}-${targetDay}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00.000+07:00`;
  const windowStart = new Date(windowStartIso);
  if (isNaN(windowStart.getTime())) return false;

  // Strict rule: slot.start MUST be strictly greater than current business time
  return windowStart.getTime() > now.getTime();
}

export { calculateEarliestDeliveryDateTime, validateDeliverySchedule, resolveOrderProcessingHours } from '@/utils/scheduleUtils';

/**
 * Checks if current time in Asia/Jakarta (WIB) has reached or passed the scheduled pickup window.
 * - Legacy orders without pickup schedule are immediately due (true).
 * - Overdue pickup schedules are due (true) to prevent orders from being stuck.
 * - Invalid date or time slot format returns false + logs anomaly.
 */
export function isPickupDispatchWindowDue(
  pickupDateStr?: string,
  pickupTimeSlotStr?: string,
  nowInput: Date | string = new Date()
): boolean {
  if (!pickupDateStr) return true; // Legacy orders without pickup schedule are immediately due

  const now = typeof nowInput === 'string' ? new Date(nowInput) : nowInput;
  if (isNaN(now.getTime())) return false;

  const dateMatch = pickupDateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    console.warn(`[PICKUP_SCHEDULER_ANOMALY] Format pickupDate '${pickupDateStr}' tidak valid.`);
    return false;
  }

  const [, targetYear, targetMonth, targetDay] = dateMatch;
  const month = parseInt(targetMonth, 10);
  const day = parseInt(targetDay, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    console.warn(`[PICKUP_SCHEDULER_ANOMALY] Komponen tanggal '${pickupDateStr}' di luar rentang kalender.`);
    return false;
  }

  let startHour = 0;
  let startMinute = 0;
  if (pickupTimeSlotStr) {
    const slotMatch = pickupTimeSlotStr.match(/(\d{1,2}):(\d{2})/);
    if (!slotMatch) {
      console.warn(`[PICKUP_SCHEDULER_ANOMALY] Format pickupTimeSlot '${pickupTimeSlotStr}' tidak valid.`);
      return false;
    }
    startHour = parseInt(slotMatch[1], 10);
    startMinute = parseInt(slotMatch[2], 10);
    if (startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59) {
      console.warn(`[PICKUP_SCHEDULER_ANOMALY] Komponen jam '${pickupTimeSlotStr}' di luar rentang 24 jam.`);
      return false;
    }
  }

  const windowStartIso = `${targetYear}-${targetMonth}-${targetDay}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00.000+07:00`;
  const windowStart = new Date(windowStartIso);
  if (isNaN(windowStart.getTime())) {
    console.warn(`[PICKUP_SCHEDULER_ANOMALY] Gagal mengonstruksi timestamp windowStart dari '${pickupDateStr} ${pickupTimeSlotStr}'.`);
    return false;
  }

  return now.getTime() >= windowStart.getTime();
}

/**
 * Helper to resolve appropriate Supabase Client instance:
 * 1. Uses explicit `client` if provided (e.g. service_role / adminClient from Webhooks/Cron).
 * 2. Falls back to default `supabase` client (or null in mock mode).
 */
function getDbClient(client?: any) {
  if (client) return client;
  if (!isSupabaseConfigured) return null;
  return supabase;
}

export const dispatchService = {
  /**
   * Courier Heartbeat Update: Updates courier online state, coordinates, location codes, and last_seen_at = NOW().
   */
  async updateCourierHeartbeatAsync(
    courierId: string,
    latitude: number,
    longitude: number,
    districtCode: string = '327401',
    villageCode: string = '3274011001',
    isOnline: boolean = true,
    client?: any
  ): Promise<void> {
    const now = new Date().toISOString();
    const db = getDbClient(client);

    if (!isSupabaseConfigured || !db) {
      const user = DEMO_USERS.find((u) => u.id === courierId);
      if (user) {
        (user as any).isOnline = isOnline;
        (user as any).latitude = latitude;
        (user as any).longitude = longitude;
        (user as any).districtCode = districtCode;
        (user as any).villageCode = villageCode;
        (user as any).lastSeenAt = now;
      }
      return;
    }

    const { error } = await (db.from('profiles') as any)
      .update({
        is_online: isOnline,
        latitude,
        longitude,
        district_code: districtCode,
        village_code: villageCode,
        last_seen_at: now,
      })
      .eq('id', courierId);

    if (error) {
      console.warn('[HEARTBEAT-UPDATE-ERROR]', error.message);
    }
  },

  /**
   * Server-Side Busy Courier Check: Verifies if courier is currently handling an active courier task.
   * Courier is BUSY if they have an active assignment offer/acceptance OR an active transport order.
   * Courier is AVAILABLE if order is 'in_washing' or 'ready_for_delivery' (pickup task completed).
   */
  async isCourierBusyAsync(courierId: string, client?: any): Promise<boolean> {
    const db = getDbClient(client);
    if (!isSupabaseConfigured || !db) {
      const { orderService } = await import('./orderService');
      const orders = orderService.getOrders();
      const isTransporting = orders.some(
        (o) => o.courierId === courierId && ['assigned', 'picked_up', 'out_for_delivery'].includes(o.status)
      );
      if (isTransporting) return true;
      return mockDispatchBatches.some(
        (b) => b.status === 'active' && b.offeredCourierIds.includes(courierId)
      );
    }

    // Check 1: Active courier_assignments (offered or accepted)
    const { count: asgCount } = await (db.from('courier_assignments') as any)
      .select('id', { count: 'exact', head: true })
      .eq('courier_id', courierId)
      .in('status', ['offered', 'accepted']);

    if (asgCount && asgCount > 0) return true;

    // Check 2: Active order transportation states ('assigned', 'picked_up', 'out_for_delivery')
    const { count: orderCount, error } = await (db.from('orders') as any)
      .select('id', { count: 'exact', head: true })
      .eq('courier_id', courierId)
      .in('status', ['assigned', 'picked_up', 'out_for_delivery']);

    if (error) return false;
    return Boolean(orderCount && orderCount > 0);
  },

  /**
   * Finds eligible, online, fresh-heartbeat, non-busy courier candidates ranked by geographic priority.
   */
  async findEligibleCouriersAsync(
    orderId: string,
    assignmentType: 'pickup' | 'delivery',
    radiusKm: number = DISPATCH_CONFIG.INITIAL_RADIUS_KM,
    excludedCourierIds: string[] = [],
    client?: any
  ): Promise<CourierCandidate[]> {
    const db = getDbClient(client);

    // 1. Fetch Order Origin Coordinates & Administrative Codes
    let originLat = -6.2415; // Fallback lat
    let originLng = 106.7972; // Fallback lng
    let originVillageCode = '3274011001';
    let originDistrictCode = '327401';

    if (isSupabaseConfigured && db) {
      const { data: orderData } = await (db.from('orders') as any)
        .select('*, customer_addresses(*)')
        .eq('id', orderId)
        .single();

      if (orderData) {
        if (orderData.customer_addresses) {
          originLat = Number(orderData.customer_addresses.latitude || originLat);
          originLng = Number(orderData.customer_addresses.longitude || originLng);
          originVillageCode = orderData.customer_addresses.village_code || originVillageCode;
          originDistrictCode = orderData.customer_addresses.district_code || originDistrictCode;
        }
      }
    }

    const heartbeatCutoff = new Date(Date.now() - DISPATCH_CONFIG.HEARTBEAT_THRESHOLD_MINUTES * 60 * 1000).toISOString();

    let rawCouriers: any[] = [];
    if (isSupabaseConfigured && db) {
      const { data } = await (db.from('profiles') as any)
        .select('*')
        .eq('role', 'courier')
        .eq('is_online', true)
        .gte('last_seen_at', heartbeatCutoff);

      rawCouriers = data || [];
    } else {
      rawCouriers = DEMO_USERS.filter((u) => u.role === 'courier').map((c) => ({
        id: c.id,
        full_name: c.fullName,
        phone: c.phone,
        is_online: true,
        latitude: -6.2415,
        longitude: 106.7972,
        village_code: originVillageCode,
        district_code: originDistrictCode,
        last_seen_at: new Date().toISOString(),
      }));
    }

    const eligibleCandidates: CourierCandidate[] = [];

    for (const c of rawCouriers) {
      if (excludedCourierIds.includes(c.id)) continue;

      // Server-side busy protection check
      const isBusy = await this.isCourierBusyAsync(c.id, db);
      if (isBusy) continue;

      // Strict Coordinate Validation: Exclude NULL, NaN, Infinity or out-of-bounds coordinates
      if (c.latitude === null || c.latitude === undefined || c.longitude === null || c.longitude === undefined) {
        continue;
      }
      const lat = Number(c.latitude);
      const lng = Number(c.longitude);
      if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        continue;
      }

      const distance = calculateDistanceKm(originLat, originLng, lat, lng);

      if (distance <= radiusKm) {
        eligibleCandidates.push({
          id: c.id,
          fullName: c.full_name,
          phone: c.phone,
          isOnline: true,
          latitude: lat,
          longitude: lng,
          districtCode: c.district_code,
          villageCode: c.village_code,
          lastSeenAt: c.last_seen_at,
          distanceKm: distance,
        });
      }
    }

    // 2. Rank Eligible Candidates: Same Village -> Same District -> Nearest Distance
    eligibleCandidates.sort((a, b) => {
      const aSameVillage = a.villageCode === originVillageCode ? 0 : 1;
      const bSameVillage = b.villageCode === originVillageCode ? 0 : 1;
      if (aSameVillage !== bSameVillage) return aSameVillage - bSameVillage;

      const aSameDistrict = a.districtCode === originDistrictCode ? 0 : 1;
      const bSameDistrict = b.districtCode === originDistrictCode ? 0 : 1;
      if (aSameDistrict !== bSameDistrict) return aSameDistrict - bSameDistrict;

      return a.distanceKm - b.distanceKm;
    });

    return eligibleCandidates.slice(0, DISPATCH_CONFIG.MAX_BATCH_SIZE);
  },

  /**
   * Triggers System Dispatch Engine for an order (Pickup or Delivery).
   * Supports optional client parameter to pass service_role / adminClient from Webhooks or Cron workers.
   */
  async dispatchOrderAsync(
    orderId: string,
    assignmentType: 'pickup' | 'delivery',
    actorUserId: string,
    client?: any
  ): Promise<DispatchStatusResult> {
    const db = getDbClient(client);

    const { orderService } = await import('./orderService');
    const existingOrder = await orderService.getOrderByIdAsync(orderId, db);
    if (!existingOrder) throw new Error(`Pesanan '${orderId}' tidak ditemukan.`);

    if (existingOrder.paymentStatus !== 'paid') {
      throw new Error(`Dispatch Ditolak: Pesanan '${orderId}' belum lunas.`);
    }

    if (assignmentType === 'pickup') {
      if (existingOrder.status !== 'pending') {
        throw new Error(`Dispatch Pickup Ditolak: Status order harus 'pending' (status saat ini: '${existingOrder.status}').`);
      }

      if (!isPickupDispatchWindowDue(existingOrder.pickupDate, existingOrder.pickupTimeSlot)) {
        return {
          hasActiveDispatch: false,
          batchNumber: 0,
          radiusKm: DISPATCH_CONFIG.INITIAL_RADIUS_KM,
          offeredCount: 0,
          acceptedCount: 0,
          status: 'idle',
          expiresAt: null,
          isNewBatch: false,
          message: 'PICKUP_DISPATCH_WINDOW_NOT_DUE',
        };
      }
    }

    if (assignmentType === 'delivery') {
      if (existingOrder.status !== 'ready_for_delivery') {
        throw new Error(`Dispatch Delivery Ditolak: Status order harus 'ready_for_delivery' (status saat ini: '${existingOrder.status}').`);
      }

      if (!isDeliveryDispatchWindowDue(existingOrder.deliveryDate, existingOrder.deliveryTimeSlot)) {
        throw new Error(`Dispatch Delivery Ditolak: Jadwal pengantaran customer (${existingOrder.deliveryDate} ${existingOrder.deliveryTimeSlot || ''}) belum memasuki dispatch window.`);
      }
    }

    const currentStatus = await this.getDispatchStatusAsync(orderId, db);
    if (currentStatus.hasActiveDispatch) {
      return { ...currentStatus, isNewBatch: false };
    }

    const batchNumber = (currentStatus.batchNumber || 0) + 1;
    let radiusKm = DISPATCH_CONFIG.INITIAL_RADIUS_KM;
    if (batchNumber === 2) radiusKm = DISPATCH_CONFIG.SECOND_RADIUS_KM;
    if (batchNumber >= 3) radiusKm = DISPATCH_CONFIG.MAX_RADIUS_KM;

    // Fetch previous offered courier IDs to prevent duplicate offers
    let previousCourierIds: string[] = [];
    if (db) {
      const { data: prevAssignments } = await (db.from('courier_assignments') as any)
        .select('courier_id')
        .eq('order_id', orderId);
      previousCourierIds = (prevAssignments || []).map((x: any) => x.courier_id);
    }

    const candidates = await this.findEligibleCouriersAsync(orderId, assignmentType, radiusKm, previousCourierIds, db);
    if (candidates.length === 0 && batchNumber < DISPATCH_CONFIG.MAX_BATCHES) {
      // Escalating to next radius if no candidates found in current radius
      const escalatedRadius = batchNumber === 1 ? DISPATCH_CONFIG.SECOND_RADIUS_KM : DISPATCH_CONFIG.MAX_RADIUS_KM;
      const escalatedCandidates = await this.findEligibleCouriersAsync(orderId, assignmentType, escalatedRadius, previousCourierIds, db);
      if (escalatedCandidates.length > 0) {
        candidates.push(...escalatedCandidates);
        radiusKm = escalatedRadius;
      }
    }

    const now = new Date();
    const expiresAtDate = new Date(now.getTime() + DISPATCH_CONFIG.OFFER_TIMEOUT_SECONDS * 1000);
    const expiresAt = expiresAtDate.toISOString();

    if (!db) {
      const activeMockExisting = mockDispatchBatches.find((b) => b.orderId === orderId && b.status === 'active');
      if (activeMockExisting) {
        return {
          hasActiveDispatch: true,
          batchNumber: activeMockExisting.batchNumber,
          radiusKm: activeMockExisting.radiusKm,
          offeredCount: activeMockExisting.offeredCourierIds.length,
          acceptedCount: 0,
          status: 'active',
          expiresAt: activeMockExisting.expiresAt,
          isNewBatch: false,
        };
      }

      const mockBatch: MockDispatchBatch = {
        id: `batch_${Date.now()}`,
        orderId,
        assignmentType,
        batchNumber,
        radiusKm,
        status: candidates.length > 0 ? 'active' : 'expired',
        startedAt: now.toISOString(),
        expiresAt,
        offeredCourierIds: candidates.map((c) => c.id),
      };
      mockDispatchBatches.push(mockBatch);

      if (candidates.length > 0) {
        for (const candidate of candidates) {
          await notificationService.notifyCourierAssignmentAsync({
            recipientCourierId: candidate.id,
            orderId,
            trackingNumber: existingOrder.trackingNumber,
            assignmentType,
            pickupAddress: existingOrder.pickupAddress,
            deliveryAddress: existingOrder.deliveryAddress,
            distanceKm: candidate.distanceKm,
            expiresAt,
            title: `TUGAS ${assignmentType.toUpperCase()} BARU`,
            body: `Penawaran tugas ${assignmentType} order #${existingOrder.trackingNumber} (${candidate.distanceKm} km). Terima dalam ${DISPATCH_CONFIG.OFFER_TIMEOUT_SECONDS} detik.`,
          });
        }
      }

      return {
        hasActiveDispatch: candidates.length > 0,
        batchNumber,
        radiusKm,
        offeredCount: candidates.length,
        acceptedCount: 0,
        status: candidates.length > 0 ? 'active' : 'expired',
        expiresAt,
        isNewBatch: true,
      };
    }

    // Insert dispatch_batches row using db (service_role or authenticated client)
    const { data: insertedBatch, error: batchErr } = await (db.from('dispatch_batches') as any)
      .insert({
        order_id: orderId,
        assignment_type: assignmentType,
        batch_number: batchNumber,
        radius_km: radiusKm,
        status: candidates.length > 0 ? 'active' : 'expired',
        started_at: now.toISOString(),
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (batchErr || !insertedBatch) {
      const isUniqueViolation =
        batchErr?.code === '23505' ||
        batchErr?.message?.includes('uq_active_dispatch_batch') ||
        batchErr?.message?.includes('unique constraint') ||
        batchErr?.message?.includes('duplicate key');

      if (isUniqueViolation) {
        return {
          hasActiveDispatch: true,
          batchNumber,
          radiusKm,
          offeredCount: candidates.length,
          acceptedCount: 0,
          status: 'active',
          expiresAt,
          isNewBatch: false,
          message: 'ACTIVE_DISPATCH_BATCH_EXISTS',
        };
      }

      throw new Error(`Gagal membuat batch dispatch: ${batchErr?.message || 'Unknown error'}`);
    }

    // Broadcast offers to candidates (MAX 10)
    for (const candidate of candidates) {
      await (db.from('courier_assignments') as any).insert({
        order_id: orderId,
        courier_id: candidate.id,
        assignment_type: assignmentType,
        status: 'offered',
        batch_id: insertedBatch.id,
        batch_number: batchNumber,
        expires_at: expiresAt,
        distance_km: candidate.distanceKm,
      });

      // Non-blocking notification side effect
      try {
        await notificationService.notifyCourierAssignmentAsync({
          recipientCourierId: candidate.id,
          orderId,
          trackingNumber: existingOrder.trackingNumber,
          assignmentType,
          pickupAddress: existingOrder.pickupAddress,
          deliveryAddress: existingOrder.deliveryAddress,
          distanceKm: candidate.distanceKm,
          expiresAt,
          title: `TUGAS ${assignmentType.toUpperCase()} BARU`,
          body: `Penawaran tugas ${assignmentType} order #${existingOrder.trackingNumber} (${candidate.distanceKm} km). Terima dalam ${DISPATCH_CONFIG.OFFER_TIMEOUT_SECONDS} detik.`,
        });
      } catch (notifErr: any) {
        console.warn('[NOTIF-SIDE-EFFECT-WARNING] Gagal mengirim notifikasi:', notifErr.message);
      }
    }

    // Insert audit log
    await (db.from('order_status_logs') as any).insert({
      order_id: orderId,
      status: existingOrder.status,
      notes: `Dispatch Engine Batch #${batchNumber} dimulai (${candidates.length} kurir ditawari, radius ${radiusKm} km).`,
      updated_by: actorUserId,
    });

    return {
      hasActiveDispatch: candidates.length > 0,
      batchNumber,
      radiusKm,
      offeredCount: candidates.length,
      acceptedCount: 0,
      status: candidates.length > 0 ? 'active' : 'expired',
      expiresAt,
    };
  },

  /**
   * Retrieves active/latest dispatch status for an order.
   */
  async getDispatchStatusAsync(orderId: string, client?: any, assignmentType?: 'pickup' | 'delivery'): Promise<DispatchStatusResult> {
    const db = getDbClient(client);

    if (!isSupabaseConfigured || !db) {
      const activeMock = mockDispatchBatches.find(
        (b) => b.orderId === orderId && b.status === 'active' && (!assignmentType || b.assignmentType === assignmentType)
      );
      if (activeMock) {
        return {
          hasActiveDispatch: true,
          batchNumber: activeMock.batchNumber,
          radiusKm: activeMock.radiusKm,
          offeredCount: activeMock.offeredCourierIds.length,
          acceptedCount: 0,
          status: 'active',
          expiresAt: activeMock.expiresAt,
        };
      }
      return {
        hasActiveDispatch: false,
        batchNumber: 0,
        radiusKm: DISPATCH_CONFIG.INITIAL_RADIUS_KM,
        offeredCount: 0,
        acceptedCount: 0,
        status: 'idle',
        expiresAt: null,
      };
    }

    let query = (db.from('dispatch_batches') as any)
      .select('*, courier_assignments(*)')
      .eq('order_id', orderId);

    if (assignmentType) {
      query = query.eq('assignment_type', assignmentType);
    }

    const { data: latestBatch } = await query
      .order('batch_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestBatch) {
      return {
        hasActiveDispatch: false,
        batchNumber: 0,
        radiusKm: DISPATCH_CONFIG.INITIAL_RADIUS_KM,
        offeredCount: 0,
        acceptedCount: 0,
        status: 'idle',
        expiresAt: null,
      };
    }

    const assignments = latestBatch.courier_assignments || [];
    const offeredCount = assignments.filter((a: any) => a.status === 'offered').length;
    const acceptedCount = assignments.filter((a: any) => a.status === 'accepted').length;

    return {
      hasActiveDispatch: latestBatch.status === 'active',
      batchNumber: latestBatch.batch_number,
      radiusKm: Number(latestBatch.radius_km),
      offeredCount,
      acceptedCount,
      status: latestBatch.status,
      expiresAt: latestBatch.expires_at,
    };
  },

  /**
   * Background Timeout Worker: Processes expired dispatch batches and automatically triggers next batch.
   */
  async processExpiredDispatchBatchesAsync(client?: any): Promise<void> {
    const now = new Date().toISOString();
    const db = getDbClient(client);

    if (!isSupabaseConfigured || !db) {
      for (const batch of mockDispatchBatches) {
        if (batch.status === 'active' && batch.expiresAt <= now) {
          batch.status = 'expired';
        }
      }
      return;
    }

    // 1. Fetch expired active batches
    const { data: expiredBatches } = await (db.from('dispatch_batches') as any)
      .select('*, orders(*)')
      .eq('status', 'active')
      .lte('expires_at', now);

    if (!expiredBatches || expiredBatches.length === 0) return;

    for (const batch of expiredBatches) {
      // Mark batch expired
      await (db.from('dispatch_batches') as any)
        .update({ status: 'expired' })
        .eq('id', batch.id);

      // Mark unaccepted offers expired
      await (db.from('courier_assignments') as any)
        .update({ status: 'expired' })
        .eq('batch_id', batch.id)
        .eq('status', 'offered');

      const order = batch.orders;
      if (order && order.payment_status === 'paid') {
        const canTriggerNext =
          (batch.assignment_type === 'pickup' && order.status === 'pending') ||
          (batch.assignment_type === 'delivery' && order.status === 'ready_for_delivery');

        if (canTriggerNext && batch.batch_number < DISPATCH_CONFIG.MAX_BATCHES) {
          try {
            await this.dispatchOrderAsync(order.id, batch.assignment_type, order.laundry_id, db);
          } catch (err: any) {
            console.warn('[DISPATCH-AUTO-RETRY-WARNING]', err.message);
          }
        }
      }
    }
  },

  /**
   * Manual Retry Dispatch Action from Owner Dashboard ("Cari Kurir Lagi").
   */
  async retryDispatchAsync(orderId: string, actorUserId: string, client?: any): Promise<DispatchStatusResult> {
    const db = getDbClient(client);

    const { orderService } = await import('./orderService');
    const order = await orderService.getOrderByIdAsync(orderId, db);
    if (!order) throw new Error(`Pesanan '${orderId}' tidak ditemukan.`);

    const assignmentType: 'pickup' | 'delivery' = order.status === 'ready_for_delivery' ? 'delivery' : 'pickup';

    if (assignmentType === 'pickup' && !isPickupDispatchWindowDue(order.pickupDate, order.pickupTimeSlot)) {
      return {
        hasActiveDispatch: false,
        batchNumber: 0,
        radiusKm: DISPATCH_CONFIG.INITIAL_RADIUS_KM,
        offeredCount: 0,
        acceptedCount: 0,
        status: 'idle',
        expiresAt: null,
        message: 'PICKUP_DISPATCH_WINDOW_NOT_DUE',
      };
    }

    if (assignmentType === 'delivery' && !isDeliveryDispatchWindowDue(order.deliveryDate, order.deliveryTimeSlot)) {
      return {
        hasActiveDispatch: false,
        batchNumber: 0,
        radiusKm: DISPATCH_CONFIG.INITIAL_RADIUS_KM,
        offeredCount: 0,
        acceptedCount: 0,
        status: 'idle',
        expiresAt: null,
        message: 'DELIVERY_DISPATCH_WINDOW_NOT_DUE',
      };
    }

    if (isSupabaseConfigured && db) {
      // Expire any stuck active batches safely
      await (db.from('dispatch_batches') as any)
        .update({ status: 'expired' })
        .eq('order_id', orderId)
        .eq('status', 'active');
    }

    return this.dispatchOrderAsync(orderId, assignmentType, actorUserId, db);
  },

  completeMockDispatchBatchAsync(orderId?: string): void {
    if (!orderId) {
      mockDispatchBatches.length = 0;
      return;
    }
    for (const batch of mockDispatchBatches) {
      if (batch.orderId === orderId && batch.status === 'active') {
        batch.status = 'completed';
        batch.offeredCourierIds = [];
      }
    }
  },

  /**
   * Automated Pickup Dispatch Scheduler: Scans all orders in `pending` + `paid`
   * whose scheduled pickup window has arrived (`isPickupDispatchWindowDue` = true)
   * and creates dispatch batch if no active batch/assignment exists.
   */
  async processScheduledPickupsAsync(client?: any): Promise<PickupSchedulerSummary> {
    const db = getDbClient(client);
    const now = new Date();
    const nowIso = now.toISOString();

    const summary: PickupSchedulerSummary = {
      scanned: 0,
      eligible: 0,
      dispatched: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    if (db) {
      const { data: candidates, error: candidateErr } = await (db.from('orders') as any)
        .select('*')
        .eq('status', 'pending')
        .eq('payment_status', 'paid');

      if (candidateErr) {
        console.error('[PICKUP_SCHEDULER_ERROR] Gagal membaca kandidat order pending + paid:', candidateErr.message);
        throw new Error(`Database Error: Gagal membaca kandidat order scheduled pickup. ${candidateErr.message}`);
      }

      const pendingOrders = candidates || [];
      summary.scanned = pendingOrders.length;

      for (const order of pendingOrders) {
        const dispatchStatus = await this.getDispatchStatusAsync(order.id, db);
        if (dispatchStatus.hasActiveDispatch) {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            pickupDate: order.pickup_date,
            pickupTimeSlot: order.pickup_time_slot,
            currentTimeWib: nowIso,
            result: 'skipped',
            reason: 'ACTIVE_DISPATCH_BATCH_EXISTS',
          });
          continue;
        }

        const { data: activeAssignments } = await (db.from('courier_assignments') as any)
          .select('id')
          .eq('order_id', order.id)
          .eq('assignment_type', 'pickup')
          .in('status', ['assigned', 'picked_up']);

        if (activeAssignments && activeAssignments.length > 0) {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            pickupDate: order.pickup_date,
            pickupTimeSlot: order.pickup_time_slot,
            currentTimeWib: nowIso,
            result: 'skipped',
            reason: 'ACTIVE_PICKUP_ASSIGNMENT_EXISTS',
          });
          continue;
        }

        const isDue = isPickupDispatchWindowDue(order.pickup_date, order.pickup_time_slot, now);
        if (!isDue) {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            pickupDate: order.pickup_date,
            pickupTimeSlot: order.pickup_time_slot,
            currentTimeWib: nowIso,
            result: 'skipped',
            reason: 'PICKUP_WINDOW_NOT_DUE',
          });
          continue;
        }

        summary.eligible++;
        try {
          const result = await this.dispatchOrderAsync(order.id, 'pickup', 'system_cron', db);
          if (result.hasActiveDispatch && (result as any).isNewBatch !== false) {
            summary.dispatched++;
            summary.details.push({
              orderId: order.id,
              pickupDate: order.pickup_date,
              pickupTimeSlot: order.pickup_time_slot,
              currentTimeWib: nowIso,
              result: 'dispatched',
            });
          } else {
            summary.skipped++;
            summary.details.push({
              orderId: order.id,
              pickupDate: order.pickup_date,
              pickupTimeSlot: order.pickup_time_slot,
              currentTimeWib: nowIso,
              result: 'skipped',
              reason: result.message || 'ACTIVE_DISPATCH_BATCH_EXISTS',
            });
          }
        } catch (err: any) {
          summary.failed++;
          summary.details.push({
            orderId: order.id,
            pickupDate: order.pickup_date,
            pickupTimeSlot: order.pickup_time_slot,
            currentTimeWib: nowIso,
            result: 'failed',
            reason: err.message,
          });
        }
      }

      console.log(`[PICKUP_SCHEDULER] scanned=${summary.scanned} eligible=${summary.eligible} dispatched=${summary.dispatched} skipped=${summary.skipped} failed=${summary.failed}`);
      return summary;
    }

    // Mock Store Mode
    const { orderService } = await import('./orderService');
    const allMockOrders = orderService.getOrders();
    const candidateOrders = allMockOrders.filter(
      (o) => o.status === 'pending' && o.paymentStatus === 'paid'
    );

    summary.scanned = candidateOrders.length;

    for (const order of candidateOrders) {
      const dispatchStatus = await this.getDispatchStatusAsync(order.id);
      if (dispatchStatus.hasActiveDispatch) {
        summary.skipped++;
        summary.details.push({
          orderId: order.id,
          pickupDate: order.pickupDate,
          pickupTimeSlot: order.pickupTimeSlot,
          currentTimeWib: nowIso,
          result: 'skipped',
          reason: 'ACTIVE_DISPATCH_BATCH_EXISTS',
        });
        continue;
      }

      const isDue = isPickupDispatchWindowDue(order.pickupDate, order.pickupTimeSlot, now);
      if (!isDue) {
        summary.skipped++;
        summary.details.push({
          orderId: order.id,
          pickupDate: order.pickupDate,
          pickupTimeSlot: order.pickupTimeSlot,
          currentTimeWib: nowIso,
          result: 'skipped',
          reason: 'PICKUP_WINDOW_NOT_DUE',
        });
        continue;
      }

      summary.eligible++;
      try {
        const result = await this.dispatchOrderAsync(order.id, 'pickup', 'system_cron');
        if (result.hasActiveDispatch && (result as any).isNewBatch !== false) {
          summary.dispatched++;
          summary.details.push({
            orderId: order.id,
            pickupDate: order.pickupDate,
            pickupTimeSlot: order.pickupTimeSlot,
            currentTimeWib: nowIso,
            result: 'dispatched',
          });
        } else {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            pickupDate: order.pickupDate,
            pickupTimeSlot: order.pickupTimeSlot,
            currentTimeWib: nowIso,
            result: 'skipped',
            reason: result.message || 'ACTIVE_DISPATCH_BATCH_EXISTS',
          });
        }
      } catch (err: any) {
        summary.failed++;
        summary.details.push({
          orderId: order.id,
          pickupDate: order.pickupDate,
          pickupTimeSlot: order.pickupTimeSlot,
          currentTimeWib: nowIso,
          result: 'failed',
          reason: err.message,
        });
      }
    }

    console.log(`[PICKUP_SCHEDULER] scanned=${summary.scanned} eligible=${summary.eligible} dispatched=${summary.dispatched} skipped=${summary.skipped} failed=${summary.failed}`);
    return summary;
  },

  /**
   * Automated Delivery Dispatch Scheduler: Scans all orders in `ready_for_delivery`
   * whose scheduled delivery window has arrived (`isDeliveryDispatchWindowDue` = true)
   * and triggers their initial delivery dispatch via canonical `dispatchOrderAsync()`.
   */
  async processScheduledDeliveriesAsync(client?: any): Promise<DeliverySchedulerSummary> {
    const db = getDbClient(client);
    const now = new Date();
    const nowIso = now.toISOString();

    const summary: DeliverySchedulerSummary = {
      scanned: 0,
      eligible: 0,
      dispatched: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    if (isSupabaseConfigured && db) {
      // Fetch candidate orders from Supabase Live DB
      const { data: candidates, error } = await (db.from('orders') as any)
        .select('id, status, payment_status, delivery_date, delivery_time_slot, laundry_id, courier_id')
        .eq('status', 'ready_for_delivery')
        .eq('payment_status', 'paid');

      if (error || !candidates) {
        if (error) console.error('[DELIVERY_SCHEDULER_DB_ERROR]', error.message);
        return summary;
      }

      summary.scanned = candidates.length;

      for (const order of candidates) {
        // 1. Check existing active dispatch batch
        const dispatchStatus = await this.getDispatchStatusAsync(order.id, db);
        if (dispatchStatus.hasActiveDispatch) {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            deliveryDate: order.delivery_date,
            deliveryTimeSlot: order.delivery_time_slot,
            currentTimeWib: nowIso,
            result: 'skipped',
            reason: 'ACTIVE_DISPATCH_BATCH_EXISTS',
          });
          continue;
        }

        // 2. Check existing active/accepted delivery assignment
        if (order.courier_id) {
          const { data: activeAssignments } = await (db.from('courier_assignments') as any)
            .select('id, status, assignment_type')
            .eq('order_id', order.id)
            .eq('assignment_type', 'delivery')
            .in('status', ['offered', 'assigned', 'out_for_delivery']);

          if (activeAssignments && activeAssignments.length > 0) {
            summary.skipped++;
            summary.details.push({
              orderId: order.id,
              deliveryDate: order.delivery_date,
              deliveryTimeSlot: order.delivery_time_slot,
              currentTimeWib: nowIso,
              result: 'skipped',
              reason: 'ACTIVE_DELIVERY_ASSIGNMENT_EXISTS',
            });
            continue;
          }
        }

        // 3. Check delivery scheduling window due
        const isDue = isDeliveryDispatchWindowDue(order.delivery_date, order.delivery_time_slot, now);
        if (!isDue) {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            deliveryDate: order.delivery_date,
            deliveryTimeSlot: order.delivery_time_slot,
            currentTimeWib: nowIso,
            result: 'skipped',
            reason: 'DELIVERY_WINDOW_NOT_DUE',
          });
          continue;
        }

        // 4. Eligible -> Trigger canonical dispatch path
        summary.eligible++;
        try {
          const result = await this.dispatchOrderAsync(order.id, 'delivery', 'system_cron', db);
          if (result.hasActiveDispatch && (result as any).isNewBatch !== false) {
            summary.dispatched++;
            summary.details.push({
              orderId: order.id,
              deliveryDate: order.delivery_date,
              deliveryTimeSlot: order.delivery_time_slot,
              currentTimeWib: nowIso,
              result: 'dispatched',
            });
          } else {
            summary.skipped++;
            summary.details.push({
              orderId: order.id,
              deliveryDate: order.delivery_date,
              deliveryTimeSlot: order.delivery_time_slot,
              currentTimeWib: nowIso,
              result: 'skipped',
              reason: result.message || 'ACTIVE_DISPATCH_BATCH_EXISTS',
            });
          }
        } catch (err: any) {
          summary.failed++;
          summary.details.push({
            orderId: order.id,
            deliveryDate: order.delivery_date,
            deliveryTimeSlot: order.delivery_time_slot,
            currentTimeWib: nowIso,
            result: 'failed',
            reason: err.message,
          });
        }
      }

      return summary;
    }

    // Mock Store Mode
    const { orderService } = await import('./orderService');
    const allMockOrders = orderService.getOrders();
    const candidateOrders = allMockOrders.filter(
      (o) => o.status === 'ready_for_delivery' && o.paymentStatus === 'paid'
    );

    summary.scanned = candidateOrders.length;

    for (const order of candidateOrders) {
      const dispatchStatus = await this.getDispatchStatusAsync(order.id);
      if (dispatchStatus.hasActiveDispatch) {
        summary.skipped++;
        summary.details.push({
          orderId: order.id,
          deliveryDate: order.deliveryDate,
          deliveryTimeSlot: order.deliveryTimeSlot,
          currentTimeWib: nowIso,
          result: 'skipped',
          reason: 'ACTIVE_DISPATCH_BATCH_EXISTS',
        });
        continue;
      }

      const isDue = isDeliveryDispatchWindowDue(order.deliveryDate, order.deliveryTimeSlot, now);
      if (!isDue) {
        summary.skipped++;
        summary.details.push({
          orderId: order.id,
          deliveryDate: order.deliveryDate,
          deliveryTimeSlot: order.deliveryTimeSlot,
          currentTimeWib: nowIso,
          result: 'skipped',
          reason: 'DELIVERY_WINDOW_NOT_DUE',
        });
        continue;
      }

      summary.eligible++;
      try {
        const result = await this.dispatchOrderAsync(order.id, 'delivery', 'system_cron');
        if (result.hasActiveDispatch && (result as any).isNewBatch !== false) {
          summary.dispatched++;
          summary.details.push({
            orderId: order.id,
            deliveryDate: order.deliveryDate,
            deliveryTimeSlot: order.deliveryTimeSlot,
            currentTimeWib: nowIso,
            result: 'dispatched',
          });
        } else {
          summary.skipped++;
          summary.details.push({
            orderId: order.id,
            deliveryDate: order.deliveryDate,
            deliveryTimeSlot: order.deliveryTimeSlot,
            currentTimeWib: nowIso,
            result: 'skipped',
            reason: result.message || 'ACTIVE_DISPATCH_BATCH_EXISTS',
          });
        }
      } catch (err: any) {
        summary.failed++;
        summary.details.push({
          orderId: order.id,
          deliveryDate: order.deliveryDate,
          deliveryTimeSlot: order.deliveryTimeSlot,
          currentTimeWib: nowIso,
          result: 'failed',
          reason: err.message,
        });
      }
    }

    return summary;
  },
};
