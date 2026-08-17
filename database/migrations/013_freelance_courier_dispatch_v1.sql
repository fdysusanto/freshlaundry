-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 013_freelance_courier_dispatch_v1.sql
-- Description: Freelance Courier Dispatch Engine V1 (Dispatch Batches, Courier Online/Heartbeat Status,
--              Location Coordinates, Atomic Winner RPC with Profile Row Lock & Database Safety Net Partial Unique Indexes).
-- Author: Antigravity AI Architecture Team
-- Date: 2026-08-17
-- Status: IDEMPOTENT & PRODUCTION HARDENED
-- =============================================================================

-- 1. EXTEND PROFILES TABLE FOR COURIER DISPATCH & LOCATION HEARTBEAT
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS district_code TEXT,
  ADD COLUMN IF NOT EXISTS village_code TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Indexes for Courier Candidate Lookup
CREATE INDEX IF NOT EXISTS idx_profiles_courier_dispatch 
ON public.profiles (role, is_online, last_seen_at) 
WHERE role = 'courier';

CREATE INDEX IF NOT EXISTS idx_profiles_courier_village 
ON public.profiles (village_code) 
WHERE role = 'courier';

CREATE INDEX IF NOT EXISTS idx_profiles_courier_district 
ON public.profiles (district_code) 
WHERE role = 'courier';


-- 2. DISPATCH BATCHES TABLE (LIFECYCLE TRACKING)
CREATE TABLE IF NOT EXISTS public.dispatch_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('pickup', 'delivery')),
  batch_number INTEGER NOT NULL DEFAULT 1,
  radius_km NUMERIC(6, 2) NOT NULL DEFAULT 3.0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_batches_lookup 
ON public.dispatch_batches (order_id, assignment_type, status);

CREATE INDEX IF NOT EXISTS idx_dispatch_batches_expiry 
ON public.dispatch_batches (status, expires_at) 
WHERE status = 'active';

ALTER TABLE public.dispatch_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dispatch batches viewable by laundry members or admin" ON public.dispatch_batches;
CREATE POLICY "Dispatch batches viewable by laundry members or admin" 
ON public.dispatch_batches FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = dispatch_batches.order_id
      AND (public.is_laundry_member(o.laundry_id) OR public.is_platform_admin())
  )
);


-- 3. EXTEND COURIER ASSIGNMENTS TABLE
ALTER TABLE public.courier_assignments
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.dispatch_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS batch_number INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_courier_assignments_expiry 
ON public.courier_assignments (status, expires_at) 
WHERE status = 'offered';


-- 4. DATABASE SAFETY NET PARTIAL UNIQUE INDEXES (DATABASE ENGINE INVARIANTS)

-- 4.1 Invariant: 1 Courier = Max 1 Active Handling Order
CREATE UNIQUE INDEX IF NOT EXISTS uq_courier_single_active_order
ON public.orders (courier_id)
WHERE status IN ('assigned', 'picked_up', 'in_washing', 'ready_for_delivery', 'out_for_delivery');

-- 4.2 Invariant: 1 Order + Assignment Type = Max 1 Active Dispatch Batch
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_dispatch_batch
ON public.dispatch_batches (order_id, assignment_type)
WHERE status = 'active';

-- 4.3 Invariant: 1 Courier = Max 1 Active Offer per Order
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_courier_offer
ON public.courier_assignments (order_id, courier_id)
WHERE status = 'offered';


-- 5. HARDENED ATOMIC RPC ACCEPTANCE WITH PER-COURIER SERIALIZATION & SEARCH_PATH SECURITY
CREATE OR REPLACE FUNCTION public.accept_courier_assignment_atomic(
  p_assignment_id UUID,
  p_courier_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_assignment_type TEXT;
  v_assignment_status TEXT;
  v_order_status TEXT;
  v_payment_status TEXT;
  v_active_count INTEGER;
  v_batch_id UUID;
  v_batch_status TEXT;
BEGIN
  -- 1. Security Audit Check: Enforce caller identity (except service_role)
  IF auth.uid() IS NOT NULL AND auth.uid() != p_courier_id AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Akses Ditolak: Anda tidak dapat menerima penugasan milik kurir lain.';
  END IF;

  -- 2. CRITICAL CONCURRENCY HARDENING: Lock Courier Profile FOR UPDATE first
  -- Serializes all concurrent acceptance attempts for this specific courier to prevent race conditions.
  PERFORM 1 FROM public.profiles WHERE id = p_courier_id FOR UPDATE;

  -- 3. Lock and validate courier assignment
  SELECT order_id, assignment_type, status, batch_id INTO v_order_id, v_assignment_type, v_assignment_status, v_batch_id
  FROM public.courier_assignments
  WHERE id = p_assignment_id AND courier_id = p_courier_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Penugasan kurir tidak ditemukan atau tidak ditujukan untuk kurir ini.';
  END IF;

  IF v_assignment_status != 'offered' THEN
    RAISE EXCEPTION 'Penugasan kurir sudah tidak berlaku (status penugasan saat ini: %).', v_assignment_status;
  END IF;

  -- 4. Validate dispatch batch status if tied to batch
  IF v_batch_id IS NOT NULL THEN
    SELECT status INTO v_batch_status
    FROM public.dispatch_batches
    WHERE id = v_batch_id
    FOR UPDATE;

    IF FOUND AND v_batch_status != 'active' THEN
      RAISE EXCEPTION 'Batch penawaran sudah berakhir atau tidak aktif (status batch: %).', v_batch_status;
    END IF;
  END IF;

  -- 5. Lock and validate order
  SELECT status, payment_status INTO v_order_status, v_payment_status
  FROM public.orders
  WHERE id = v_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan dengan ID % tidak ditemukan.', v_order_id;
  END IF;

  IF v_payment_status != 'paid' THEN
    RAISE EXCEPTION 'Pesanan belum dibayar (status pembayaran: %).', v_payment_status;
  END IF;

  -- 6. Server-Side Busy Courier Protection (Evaluated AFTER profile row lock): Ensure courier has 0 active handling orders
  SELECT COUNT(1) INTO v_active_count
  FROM public.orders
  WHERE courier_id = p_courier_id
    AND status IN ('assigned', 'picked_up', 'in_washing', 'ready_for_delivery', 'out_for_delivery');

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'Kurir sedang menangani pesanan lain.';
  END IF;

  -- 7. Branch execution based on assignment_type
  IF v_assignment_type = 'pickup' THEN
    IF v_order_status != 'pending' THEN
      RAISE EXCEPTION 'Pesanan tidak dalam status menunggu penugasan (status order saat ini: %).', v_order_status;
    END IF;

    -- Update assignment status to accepted
    UPDATE public.courier_assignments
    SET status = 'accepted', responded_at = NOW()
    WHERE id = p_assignment_id;

    -- Update order status to assigned & set courier_id ONLY ON WINNER ACCEPTANCE
    UPDATE public.orders
    SET courier_id = p_courier_id,
        status = 'assigned',
        updated_at = NOW()
    WHERE id = v_order_id;

    -- Mark batch as completed
    IF v_batch_id IS NOT NULL THEN
      UPDATE public.dispatch_batches
      SET status = 'completed'
      WHERE id = v_batch_id;
    END IF;

    -- Invalidate all other pending offered assignments for this order
    UPDATE public.courier_assignments
    SET status = 'expired'
    WHERE order_id = v_order_id AND id != p_assignment_id AND status = 'offered';

    -- Invalidate all other active offers for this winning courier across other orders
    UPDATE public.courier_assignments
    SET status = 'expired'
    WHERE courier_id = p_courier_id AND id != p_assignment_id AND status = 'offered';

    -- Insert order status log entry
    INSERT INTO public.order_status_logs (order_id, status, notes, updated_by)
    VALUES (v_order_id, 'assigned', 'Kurir menerima tugas penjemputan (pickup).', p_courier_id);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_status', 'assigned', 'assignment_type', 'pickup');

  ELSIF v_assignment_type = 'delivery' THEN
    IF v_order_status != 'ready_for_delivery' THEN
      RAISE EXCEPTION 'Pesanan belum siap untuk diantar (status order saat ini: %).', v_order_status;
    END IF;

    -- Update assignment status to accepted
    UPDATE public.courier_assignments
    SET status = 'accepted', responded_at = NOW()
    WHERE id = p_assignment_id;

    -- Update order status to out_for_delivery & set courier_id
    UPDATE public.orders
    SET courier_id = p_courier_id,
        status = 'out_for_delivery',
        updated_at = NOW()
    WHERE id = v_order_id;

    -- Mark batch as completed
    IF v_batch_id IS NOT NULL THEN
      UPDATE public.dispatch_batches
      SET status = 'completed'
      WHERE id = v_batch_id;
    END IF;

    -- Invalidate all other pending offered delivery assignments for this order
    UPDATE public.courier_assignments
    SET status = 'expired'
    WHERE order_id = v_order_id AND id != p_assignment_id AND status = 'offered';

    -- Invalidate all other active offers for this winning courier across other orders
    UPDATE public.courier_assignments
    SET status = 'expired'
    WHERE courier_id = p_courier_id AND id != p_assignment_id AND status = 'offered';

    -- Insert order status log entry
    INSERT INTO public.order_status_logs (order_id, status, notes, updated_by)
    VALUES (v_order_id, 'out_for_delivery', 'Kurir menerima tugas pengantaran (delivery).', p_courier_id);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_status', 'out_for_delivery', 'assignment_type', 'delivery');

  ELSE
    RAISE EXCEPTION 'Tipe penugasan kurir % tidak dikenal.', v_assignment_type;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.accept_courier_assignment_atomic(UUID, UUID) TO authenticated, service_role;
