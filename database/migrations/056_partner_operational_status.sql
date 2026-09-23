-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 056_partner_operational_status.sql
-- Description: Phase 2D-K.2 — Operational Availability (Buka/Tutup) Management
--              1. Provides atomic RPC public.admin_set_partner_operational_status_atomic
--                 allowing Platform Ops Admin to explicitly toggle laundries.is_open.
--              2. Preserves partner lifecycle status and is_active untouched.
--              3. Enforces platform_admin role via authenticated context (auth.uid()).
--              4. Records immutable audit log PARTNER_OPERATIONAL_STATUS_CHANGED only upon state change.
--              5. Strengthens create_order_with_items_atomic RPC to reject orders
--                 when laundry is_open = false with clear user error.
-- Author: Antigravity AI Architecture Team
-- Status: IDEMPOTENT & PRODUCTION HARDENED
-- =============================================================================

BEGIN;

-- 1. Operational Status Mutation RPC: admin_set_partner_operational_status_atomic
CREATE OR REPLACE FUNCTION public.admin_set_partner_operational_status_atomic(
  p_laundry_id UUID,
  p_is_open BOOLEAN,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role user_role;
  v_laundry RECORD;
BEGIN
  -- A. Authenticated Caller Check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terautentikasi.';
  END IF;

  -- B. Authoritative Platform Admin Role Verification (prevent trusting client p_admin_id)
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role != 'platform_admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya platform_admin yang berwenang mengubah status operasional toko partner.';
  END IF;

  -- C. Validate Laundry Exists
  SELECT * INTO v_laundry FROM public.laundries WHERE id = p_laundry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner laundry tidak ditemukan.';
  END IF;

  -- D. Idempotency Check: No unnecessary update or audit log if state unchanged
  IF v_laundry.is_open = p_is_open THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'laundry_id', p_laundry_id,
      'is_open', v_laundry.is_open,
      'status', v_laundry.status,
      'is_active', v_laundry.is_active,
      'message', 'Status operasional partner sudah ' || CASE WHEN v_laundry.is_open THEN 'BUKA' ELSE 'TUTUP' END
    );
  END IF;

  -- E. Atomic Update: ONLY mutate is_open, updated_by, updated_at
  -- PRESERVE: status, is_active, owner_id, claim_status, onboarding_status
  UPDATE public.laundries
  SET is_open = p_is_open,
      updated_by = v_caller_id,
      updated_at = NOW()
  WHERE id = p_laundry_id;

  -- F. Immutable Audit Log Insertion
  INSERT INTO public.audit_logs (
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    reason,
    metadata
  ) VALUES (
    v_caller_id,
    'platform_admin',
    'PARTNER_OPERATIONAL_STATUS_CHANGED',
    'partner',
    p_laundry_id,
    jsonb_build_object('is_open', v_laundry.is_open),
    jsonb_build_object('is_open', p_is_open),
    'Perubahan status operasional toko (' || CASE WHEN p_is_open THEN 'BUKA' ELSE 'TUTUP' END || ') oleh Platform Ops Admin',
    jsonb_build_object(
      'before', jsonb_build_object('is_open', v_laundry.is_open),
      'after', jsonb_build_object('is_open', p_is_open),
      'partner_status', v_laundry.status,
      'is_active', v_laundry.is_active
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'laundry_id', p_laundry_id,
    'previous_is_open', v_laundry.is_open,
    'is_open', p_is_open,
    'status', v_laundry.status,
    'is_active', v_laundry.is_active,
    'message', 'Status operasional partner berhasil diubah menjadi ' || CASE WHEN p_is_open THEN 'BUKA' ELSE 'TUTUP' END
  );
END;
$$;

-- Security Enforcement: Grant to authenticated and service_role, revoke from PUBLIC and anon
REVOKE EXECUTE ON FUNCTION public.admin_set_partner_operational_status_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_partner_operational_status_atomic TO authenticated, service_role;


-- 2. Strengthen create_order_with_items_atomic with is_open check
CREATE OR REPLACE FUNCTION public.create_order_with_items_atomic(
  p_tracking_number TEXT,
  p_customer_id UUID,
  p_laundry_id UUID,
  p_service_type service_type,
  p_estimated_weight_kg NUMERIC,
  p_pickup_address TEXT,
  p_delivery_address TEXT,
  p_pickup_date DATE,
  p_pickup_time_slot TEXT,
  p_notes TEXT,
  p_subtotal NUMERIC,
  p_delivery_fee NUMERIC,
  p_platform_fee NUMERIC,
  p_discount NUMERIC,
  p_total_price NUMERIC,
  p_idempotency_key TEXT,
  p_items_json JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role user_role;
  v_existing_order_id UUID;
  v_order_id UUID;
  v_result JSONB;
  v_item JSONB;
  v_laundry_active BOOLEAN;
  v_laundry_status TEXT;
  v_laundry_is_open BOOLEAN;
BEGIN
  -- A. Authenticated caller check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Akses Ditolak: Pengguna tidak terautentikasi.';
  END IF;

  -- B. Customer Identity ownership check
  IF v_caller_id IS DISTINCT FROM p_customer_id THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya dapat membuat order atas nama akun sendiri.';
  END IF;

  -- C. Role authorization check
  v_caller_role := public.get_my_role();
  IF v_caller_role IS NULL OR v_caller_role != 'customer'::user_role THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya akun dengan peran Customer yang dapat membuat pesanan.';
  END IF;

  -- D. Partner Active, Status & Operational Availability (is_open) Check
  SELECT is_active, status, is_open
  INTO v_laundry_active, v_laundry_status, v_laundry_is_open
  FROM public.laundries
  WHERE id = p_laundry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laundry partner tidak ditemukan.';
  END IF;

  -- D.1. Lifecycle & Platform Visibility Guard
  IF NOT COALESCE(v_laundry_active, false) OR COALESCE(v_laundry_status, '') NOT IN ('order_ready', 'supplier', 'active', 'partner') THEN
    RAISE EXCEPTION 'Akses Ditolak: Toko laundry ini sedang tidak aktif atau belum siap menerima pesanan (Status: %).', COALESCE(v_laundry_status, 'unknown');
  END IF;

  -- D.2. Operational Availability Guard (is_open)
  IF NOT COALESCE(v_laundry_is_open, false) THEN
    RAISE EXCEPTION 'Akses Ditolak: Toko laundry sedang tutup dan belum dapat menerima pesanan.';
  END IF;

  -- Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_order_id
    FROM public.orders
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_order_id IS NOT NULL THEN
      SELECT jsonb_build_object(
        'is_duplicate', true,
        'order_id', o.id,
        'tracking_number', o.tracking_number,
        'status', o.status,
        'payment_status', o.payment_status,
        'total_price', o.total_price,
        'created_at', o.created_at
      ) INTO v_result
      FROM public.orders o
      WHERE o.id = v_existing_order_id;

      RETURN v_result;
    END IF;
  END IF;

  -- Insert Order
  INSERT INTO public.orders (
    tracking_number,
    customer_id,
    laundry_id,
    service_type,
    estimated_weight_kg,
    pickup_address,
    delivery_address,
    pickup_date,
    pickup_time_slot,
    notes,
    subtotal,
    delivery_fee,
    platform_fee,
    discount,
    total_price,
    status,
    payment_status,
    idempotency_key
  ) VALUES (
    p_tracking_number,
    p_customer_id,
    p_laundry_id,
    p_service_type,
    p_estimated_weight_kg,
    p_pickup_address,
    p_delivery_address,
    p_pickup_date,
    p_pickup_time_slot,
    p_notes,
    p_subtotal,
    p_delivery_fee,
    p_platform_fee,
    p_discount,
    p_total_price,
    'pending',
    'pending',
    p_idempotency_key
  ) RETURNING id INTO v_order_id;

  -- Insert Order Items
  IF p_items_json IS NOT NULL AND jsonb_array_length(p_items_json) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_json)
    LOOP
      INSERT INTO public.order_items (
        order_id,
        item_name,
        category,
        quantity,
        price_per_unit,
        subtotal
      ) VALUES (
        v_order_id,
        v_item->>'item_name',
        v_item->>'category',
        (v_item->>'quantity')::INTEGER,
        (v_item->>'price_per_unit')::NUMERIC,
        (v_item->>'subtotal')::NUMERIC
      );
    END LOOP;
  END IF;

  -- Insert Initial Order Status Log
  INSERT INTO public.order_status_logs (
    order_id,
    status,
    actor_id,
    actor_role,
    notes
  ) VALUES (
    v_order_id,
    'pending',
    v_caller_id,
    'customer',
    'Pesanan baru dibuat oleh pelanggan'
  );

  RETURN jsonb_build_object(
    'is_duplicate', false,
    'order_id', v_order_id,
    'tracking_number', p_tracking_number,
    'status', 'pending',
    'payment_status', 'pending',
    'total_price', p_total_price
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items_atomic TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
