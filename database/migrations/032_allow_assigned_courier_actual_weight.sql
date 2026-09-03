-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 032_allow_assigned_courier_actual_weight.sql
-- Description: Extends authorization of update_order_actual_weight_atomic RPC
--              to allow Assigned Couriers (public.is_assigned_courier(order_id))
--              to weigh clothes at customer pickup while preserving Laundry & Admin access.
-- Author: Antigravity AI Architecture Team
-- Date: 2026-09-03
-- Status: IDEMPOTENT & PRODUCTION HARDENED
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.update_order_actual_weight_atomic(
  p_order_id UUID,
  p_final_weight_kg NUMERIC,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_actor_id UUID;
  v_new_subtotal NUMERIC;
  v_new_total_price NUMERIC;
  v_old_total_price NUMERIC;
  v_price_delta NUMERIC;
  v_unit_price NUMERIC;
  v_log_notes TEXT;
BEGIN
  -- 1. Input Weight Validation
  IF p_final_weight_kg IS NULL OR p_final_weight_kg <= 0 THEN
    RAISE EXCEPTION 'Validasi Berat Gagal: Berat aktual harus berupa angka lebih besar dari 0 kg.';
  END IF;

  -- 2. Authenticated Actor Check (auth.uid() identity enforcement)
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Security Error: User tidak terautentikasi (auth.uid() missing).';
  END IF;

  -- 3. Lock Order FOR UPDATE to prevent race conditions
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan dengan ID % tidak ditemukan.', p_order_id;
  END IF;

  -- 4. Multi-Role Authorization: Allow Assigned Courier, Laundry Member, or Platform Admin
  IF NOT (
    public.is_assigned_courier(v_order.id) OR
    public.is_laundry_member(v_order.laundry_id) OR
    public.is_platform_admin()
  ) THEN
    RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang untuk menimbang atau mengubah berat aktual pesanan ini.';
  END IF;

  -- 5. Order State Machine Validation (Allowed in 'pending', 'assigned', 'picked_up')
  IF v_order.status NOT IN ('pending', 'assigned', 'picked_up') THEN
    RAISE EXCEPTION 'Penimbangan Ditolak: Pesanan sudah dalam pencucian atau selesai (status order saat ini: %).', v_order.status;
  END IF;

  -- 6. Idempotency Check: Return early if final weight is identical
  IF v_order.final_weight_kg IS NOT NULL AND v_order.final_weight_kg = p_final_weight_kg THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'order_id', p_order_id,
      'final_weight_kg', p_final_weight_kg,
      'subtotal', v_order.subtotal,
      'total_price', v_order.total_price,
      'price_delta', 0
    );
  END IF;

  v_old_total_price := COALESCE(v_order.total_price, 0);

  -- 7. Atomic Order Items Update & Price Recalculation (Database Source of Truth)
  UPDATE public.order_items
  SET actual_weight = p_final_weight_kg,
      quantity = p_final_weight_kg,
      subtotal = ROUND(p_final_weight_kg * COALESCE(price_snapshot, 0))
  WHERE order_id = p_order_id;

  -- Compute new subtotal from order_items
  SELECT COALESCE(SUM(subtotal), 0) INTO v_new_subtotal
  FROM public.order_items
  WHERE order_id = p_order_id;

  -- Compute new total price: GREATEST(0, subtotal + delivery_fee + platform_fee - discount)
  v_new_total_price := GREATEST(
    0,
    v_new_subtotal + COALESCE(v_order.delivery_fee, 0) + COALESCE(v_order.platform_fee, 0) - COALESCE(v_order.discount, 0)
  );

  v_price_delta := v_new_total_price - v_old_total_price;

  -- 8. Scoped Local Transaction Bypass for Column Tampering Trigger
  PERFORM set_config('app.payment_processing', 'true', true);

  -- 9. Update Orders Table
  UPDATE public.orders
  SET final_weight_kg = p_final_weight_kg,
      subtotal = v_new_subtotal,
      total_price = v_new_total_price,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- 10. Audit Log Entry (using auth.uid() as updated_by)
  v_log_notes := COALESCE(p_notes, 'Verifikasi berat aktual: ' || p_final_weight_kg || ' kg (Selisih harga: Rp ' || v_price_delta || ')');

  INSERT INTO public.order_status_logs (order_id, status, notes, updated_by)
  VALUES (
    p_order_id,
    v_order.status,
    v_log_notes,
    v_actor_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'order_id', p_order_id,
    'final_weight_kg', p_final_weight_kg,
    'subtotal', v_new_subtotal,
    'total_price', v_new_total_price,
    'price_delta', v_price_delta
  );
END;
$$;

-- Security Enforcement: Explicitly Grant to authenticated, revoke from PUBLIC and anon
REVOKE EXECUTE ON FUNCTION public.update_order_actual_weight_atomic(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_order_actual_weight_atomic(UUID, NUMERIC, TEXT) TO authenticated, service_role;

COMMIT;
