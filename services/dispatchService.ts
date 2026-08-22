import { isSupabaseConfigured, supabase, createServiceRoleClient } from './supabase';
import { notificationService } from './notificationService';
import { UserProfile } from '@/types/user';
import { DEMO_USERS } from '@/utils/constants';

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
 * Helper to resolve appropriate Supabase Client instance:
 * 1. Uses explicit `client` if provided (e.g. service_role / adminClient from Webhooks/Cron).
 * 2. Falls back to default `supabase` client (or null in mock mode).
 */
function getDbClient(client?: any) {
  if (!isSupabaseConfigured) return null;
  return client || supabase;
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
   * Server-Side Busy Courier Check: Verifies if courier is currently handling an active order.
   */
  async isCourierBusyAsync(courierId: string, client?: any): Promise<boolean> {
    const db = getDbClient(client);
    if (!isSupabaseConfigured || !db) {
      return false; // Mock fallback
    }

    const { count, error } = await (db.from('orders') as any)
      .select('id', { count: 'exact', head: true })
      .eq('courier_id', courierId)
      .in('status', ['assigned', 'picked_up', 'in_washing', 'ready_for_delivery', 'out_for_delivery']);

    if (error) return false;
    return Boolean(count && count > 0);
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

    if (assignmentType === 'pickup' && existingOrder.status !== 'pending') {
      throw new Error(`Dispatch Pickup Ditolak: Status order harus 'pending' (status saat ini: '${existingOrder.status}').`);
    }

    if (assignmentType === 'delivery' && existingOrder.status !== 'ready_for_delivery') {
      throw new Error(`Dispatch Delivery Ditolak: Status order harus 'ready_for_delivery' (status saat ini: '${existingOrder.status}').`);
    }

    const currentStatus = await this.getDispatchStatusAsync(orderId, db);
    if (currentStatus.hasActiveDispatch) {
      return currentStatus;
    }

    const batchNumber = (currentStatus.batchNumber || 0) + 1;
    let radiusKm = DISPATCH_CONFIG.INITIAL_RADIUS_KM;
    if (batchNumber === 2) radiusKm = DISPATCH_CONFIG.SECOND_RADIUS_KM;
    if (batchNumber >= 3) radiusKm = DISPATCH_CONFIG.MAX_RADIUS_KM;

    // Fetch previous offered courier IDs to prevent duplicate offers
    let previousCourierIds: string[] = [];
    if (isSupabaseConfigured && db) {
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

    if (!isSupabaseConfigured || !db) {
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
  async getDispatchStatusAsync(orderId: string, client?: any): Promise<DispatchStatusResult> {
    const db = getDbClient(client);

    if (!isSupabaseConfigured || !db) {
      const activeMock = mockDispatchBatches.find((b) => b.orderId === orderId && b.status === 'active');
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

    const { data: latestBatch } = await (db.from('dispatch_batches') as any)
      .select('*, courier_assignments(*)')
      .eq('order_id', orderId)
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

    if (isSupabaseConfigured && db) {
      // Expire any stuck active batches safely
      await (db.from('dispatch_batches') as any)
        .update({ status: 'expired' })
        .eq('order_id', orderId)
        .eq('status', 'active');
    }

    return this.dispatchOrderAsync(orderId, assignmentType, actorUserId, db);
  },
};
