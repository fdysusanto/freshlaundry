-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 054_simplified_partner_lifecycle.sql
-- Description: Phase 2D-I — Simplified Partner Onboarding & Supply Lifecycle
--              1. Update chk_laundries_status CHECK constraint to include 'order_ready' & 'supplier'.
--              2. Update update_partner_status_atomic RPC with expanded state transition matrix.
--              3. Update create_order_with_items_atomic RPC to allow orders for 'order_ready', 'supplier', and 'active'/'partner' laundries.
-- Author: Antigravity AI Architecture Team
-- Status: IDEMPOTENT & PRODUCTION HARDENED
-- =============================================================================

BEGIN;

-- 1. Update Constraint for Status Validation
ALTER TABLE public.laundries DROP CONSTRAINT IF EXISTS chk_laundries_status;

ALTER TABLE public.laundries
ADD CONSTRAINT chk_laundries_status
CHECK (status IN ('unclaimed', 'listed', 'order_ready', 'supplier', 'claimed', 'onboarding', 'active', 'partner', 'suspended', 'inactive'));

-- 2. Update RPC Function: update_partner_status_atomic
CREATE OR REPLACE FUNCTION public.update_partner_status_atomic(
  p_laundry_id UUID,
  p_target_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_role user_role;
  v_old RECORD;
  v_trimmed_reason TEXT;
  v_is_active BOOLEAN;
  v_suspended_at TIMESTAMPTZ := NULL;
  v_suspension_reason TEXT := NULL;
  v_valid_transition BOOLEAN := FALSE;
  v_service_provisioned BOOLEAN := FALSE;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terautentikasi.';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role IS NULL OR v_admin_role != 'platform_admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya platform_admin yang dapat memperbarui status partner.';
  END IF;

  SELECT * INTO v_old FROM public.laundries WHERE id = p_laundry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner laundry tidak ditemukan.';
  END IF;

  IF v_old.status = p_target_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'status', p_target_status,
      'message', 'Status partner sudah ' || p_target_status
    );
  END IF;

  -- Lifecycle State Transition Matrix Validation:
  -- listed      -> order_ready, unclaimed, claimed
  -- unclaimed   -> listed, order_ready, claimed
  -- order_ready -> supplier, active, suspended, inactive
  -- supplier    -> active, suspended, inactive
  -- claimed     -> onboarding, order_ready, supplier, active
  -- onboarding  -> order_ready, supplier, active, inactive
  -- active      -> suspended, inactive
  -- suspended   -> order_ready, supplier, active, inactive
  -- inactive    -> order_ready, supplier, active, onboarding
  CASE v_old.status
    WHEN 'unclaimed' THEN
      v_valid_transition := p_target_status IN ('listed', 'order_ready', 'claimed');
    WHEN 'listed' THEN
      v_valid_transition := p_target_status IN ('order_ready', 'unclaimed', 'claimed');
    WHEN 'order_ready' THEN
      v_valid_transition := p_target_status IN ('supplier', 'active', 'suspended', 'inactive');
    WHEN 'supplier' THEN
      v_valid_transition := p_target_status IN ('active', 'suspended', 'inactive');
    WHEN 'claimed' THEN
      v_valid_transition := p_target_status IN ('onboarding', 'order_ready', 'supplier', 'active');
    WHEN 'onboarding' THEN
      v_valid_transition := p_target_status IN ('order_ready', 'supplier', 'active', 'inactive');
    WHEN 'active' THEN
      v_valid_transition := p_target_status IN ('suspended', 'inactive');
    WHEN 'suspended' THEN
      v_valid_transition := p_target_status IN ('order_ready', 'supplier', 'active', 'inactive');
    WHEN 'inactive' THEN
      v_valid_transition := p_target_status IN ('order_ready', 'supplier', 'active', 'onboarding');
    ELSE
      v_valid_transition := FALSE;
  END CASE;

  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'Transisi status tidak valid: Partner dengan status "%" tidak dapat bertransisi ke "%".', v_old.status, p_target_status;
  END IF;

  IF p_target_status = 'suspended' THEN
    v_trimmed_reason := TRIM(COALESCE(p_reason, ''));
    IF LENGTH(v_trimmed_reason) < 5 THEN
      RAISE EXCEPTION 'Alasan penghentian sementara (suspend) wajib diisi minimal 5 karakter.';
    END IF;
    v_suspended_at := NOW();
    v_suspension_reason := v_trimmed_reason;
  END IF;

  -- Active flag set to true for order_ready, supplier, active, partner
  v_is_active := (p_target_status IN ('order_ready', 'supplier', 'active', 'partner'));

  -- Phase 2D-I.4: Atomic Default Service Provisioning for ORDER_READY
  IF p_target_status = 'order_ready' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.services
      WHERE laundry_id = p_laundry_id
        AND is_active = true
    ) THEN
      INSERT INTO public.services (
        laundry_id,
        code,
        name,
        description,
        pricing_type,
        price_per_unit,
        unit,
        min_weight,
        estimated_hours,
        icon_name,
        is_active
      )
      VALUES (
        p_laundry_id,
        'kiloan',
        'Cuci Komplit Kiloan',
        'Layanan standar CUCIYAN untuk pemesanan awal. Harga dan detail layanan dapat disesuaikan setelah laundry dikonfirmasi.',
        'per_kg',
        8000,
        'kg',
        3,
        48,
        'ShoppingBag',
        true
      );
      v_service_provisioned := TRUE;
    END IF;
  END IF;

  UPDATE public.laundries
  SET status = p_target_status,
      is_active = v_is_active,
      suspended_at = v_suspended_at,
      suspension_reason = v_suspension_reason,
      updated_by = v_admin_id,
      updated_at = NOW()
  WHERE id = p_laundry_id;

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
    v_admin_id,
    'platform_admin',
    'PARTNER_STATUS_UPDATE',
    'partner',
    p_laundry_id,
    jsonb_build_object('status', v_old.status, 'is_active', v_old.is_active),
    jsonb_build_object('status', p_target_status, 'is_active', v_is_active),
    COALESCE(v_trimmed_reason, 'Pembaruan status partner oleh Platform Ops Admin'),
    jsonb_build_object(
      'previous_status', v_old.status,
      'new_status', p_target_status,
      'default_service_provisioned', v_service_provisioned
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'laundry_id', p_laundry_id,
    'previous_status', v_old.status,
    'new_status', p_target_status,
    'is_active', v_is_active,
    'default_service_provisioned', v_service_provisioned,
    'message', 'Status partner berhasil diperbarui menjadi ' || UPPER(p_target_status)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_partner_status_atomic TO authenticated, service_role;


-- 3. Update RPC Function: create_order_with_items_atomic
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

  -- D. Partner Active & Status Check (order_ready, supplier, active, partner)
  SELECT is_active, status INTO v_laundry_active, v_laundry_status
  FROM public.laundries
  WHERE id = p_laundry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laundry partner tidak ditemukan.';
  END IF;

  IF NOT COALESCE(v_laundry_active, false) OR COALESCE(v_laundry_status, '') NOT IN ('order_ready', 'supplier', 'active', 'partner') THEN
    RAISE EXCEPTION 'Akses Ditolak: Toko laundry ini sedang tidak aktif atau belum siap menerima pesanan (Status: %).', COALESCE(v_laundry_status, 'unknown');
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
