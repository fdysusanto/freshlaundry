-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 031_fix_slot_claim_date_type.sql
-- Description: Fixes PostgreSQL Error 42883 (operator does not exist: date = text)
--              in public.claim_slot_job_batch_atomic() by applying explicit
--              parameter date cast (p_job_date::date).
-- Author: Antigravity AI Architecture Team
-- Date: 2026-09-03
-- Status: IDEMPOTENT & PRODUCTION HARDENED
-- =============================================================================

BEGIN;

-- ATOMIC SLOT CLAIM RPC FUNCTION (RECREATED WITH EXPLICIT DATE CASTING)
CREATE OR REPLACE FUNCTION public.claim_slot_job_batch_atomic(
  p_courier_id UUID,
  p_job_date TEXT,
  p_job_type TEXT,
  p_time_slot TEXT,
  p_max_capacity INTEGER DEFAULT 5,
  p_now_input TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_role TEXT;
  v_slot_start TIMESTAMPTZ;
  v_claim_lock_time TIMESTAMPTZ;
  v_existing_count INTEGER := 0;
  v_quota_remaining INTEGER := 0;
  v_claimed_ids UUID[] := ARRAY[]::UUID[];
  v_rec RECORD;
BEGIN
  -- 1. SECURITY & CALLER IDENTITY AUTHORIZATION
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL AND v_caller_id != p_courier_id AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Akses Ditolak: Anda tidak dapat melakukan klaim atas nama kurir lain.';
  END IF;

  -- Verify courier role in profiles
  SELECT role INTO v_role FROM public.profiles WHERE id = p_courier_id;
  IF NOT FOUND OR v_role != 'courier' THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya akun dengan peran Courier yang dapat melakukan claim slot job.';
  END IF;

  -- 2. VALIDATE JOB TYPE
  IF p_job_type NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Tipe pekerjaan % tidak valid. Harus pickup atau delivery.', p_job_type;
  END IF;

  -- 3. CLAIM WINDOW VALIDATION (15 Minutes Before Slot Start)
  v_slot_start := public.parse_wib_slot_start(p_job_date, p_time_slot);
  IF v_slot_start IS NULL THEN
    RAISE EXCEPTION 'Format tanggal % atau slot waktu % tidak valid.', p_job_date, p_time_slot;
  END IF;

  v_claim_lock_time := v_slot_start - INTERVAL '15 minutes';

  IF p_now_input < v_claim_lock_time THEN
    RAISE EXCEPTION 'SLOT_CLAIM_NOT_YET_OPEN: Waktu klaim untuk slot % (%) belum dibuka. Klaim baru dibuka pada % (15 menit sebelum slot dimulai).', p_time_slot, p_job_date, v_claim_lock_time;
  END IF;

  -- 4. CAPACITY ISOLATION: Calculate existing claimed orders for courier on (date + job_type + time_slot)
  IF p_job_type = 'pickup' THEN
    SELECT COUNT(1) INTO v_existing_count
    FROM public.orders
    WHERE courier_id = p_courier_id
      AND pickup_date = p_job_date::date
      AND pickup_time_slot = p_time_slot
      AND status IN ('assigned', 'picked_up', 'in_washing', 'ready_for_delivery', 'out_for_delivery', 'delivered');
  ELSE
    SELECT COUNT(1) INTO v_existing_count
    FROM public.orders
    WHERE courier_id = p_courier_id
      AND delivery_date = p_job_date::date
      AND delivery_time_slot = p_time_slot
      AND status IN ('out_for_delivery', 'delivered');
  END IF;

  v_quota_remaining := p_max_capacity - v_existing_count;
  IF v_quota_remaining <= 0 THEN
    RAISE EXCEPTION 'MAX_CAPACITY_REACHED: Kurir telah mencapai batas maksimum % order untuk slot waktu % (%).', p_max_capacity, p_time_slot, p_job_date;
  END IF;

  -- Set transaction context flag to bypass tamper trigger during atomic claim
  PERFORM set_config('app.courier_assignment', 'true', true);

  -- 5. ATOMIC ROW LOCKING & CLAIM EXECUTION WITH FOR UPDATE SKIP LOCKED
  IF p_job_type = 'pickup' THEN
    FOR v_rec IN
      SELECT id FROM public.orders
      WHERE pickup_date = p_job_date::date
        AND pickup_time_slot = p_time_slot
        AND payment_status = 'paid'
        AND status = 'pending'
        AND courier_id IS NULL
      ORDER BY created_at ASC
      LIMIT v_quota_remaining
      FOR UPDATE SKIP LOCKED
    LOOP
      UPDATE public.orders
      SET courier_id = p_courier_id,
          status = 'assigned',
          updated_at = NOW()
      WHERE id = v_rec.id;

      INSERT INTO public.order_status_logs (order_id, status, notes, updated_by)
      VALUES (v_rec.id, 'assigned', 'Kurir melakukan claim slot penjemputan (pickup).', p_courier_id);

      v_claimed_ids := array_append(v_claimed_ids, v_rec.id);
    END LOOP;
  ELSE
    FOR v_rec IN
      SELECT id FROM public.orders
      WHERE delivery_date = p_job_date::date
        AND delivery_time_slot = p_time_slot
        AND payment_status = 'paid'
        AND status = 'ready_for_delivery'
        AND courier_id IS NULL
      ORDER BY created_at ASC
      LIMIT v_quota_remaining
      FOR UPDATE SKIP LOCKED
    LOOP
      UPDATE public.orders
      SET courier_id = p_courier_id,
          status = 'out_for_delivery',
          updated_at = NOW()
      WHERE id = v_rec.id;

      INSERT INTO public.order_status_logs (order_id, status, notes, updated_by)
      VALUES (v_rec.id, 'out_for_delivery', 'Kurir melakukan claim slot pengantaran (delivery).', p_courier_id);

      v_claimed_ids := array_append(v_claimed_ids, v_rec.id);
    END LOOP;
  END IF;

  -- 6. RETURN RESULT METADATA (NO PII RETURNED)
  RETURN jsonb_build_object(
    'success', true,
    'claimed_count', coalesce(array_length(v_claimed_ids, 1), 0),
    'claimed_order_ids', to_jsonb(v_claimed_ids),
    'job_date', p_job_date,
    'job_type', p_job_type,
    'time_slot', p_time_slot,
    'courier_id', p_courier_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.claim_slot_job_batch_atomic(UUID, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ) TO authenticated, service_role;

COMMIT;
