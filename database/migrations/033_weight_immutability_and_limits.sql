-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 033_weight_immutability_and_limits.sql
-- Description: Hardens update_order_actual_weight_atomic RPC with:
--              1. Server-side Max Weight Limit (<= 50.0 kg).
--              2. Immutability Lock once Payment Adjustment is PAID.
--              3. Courier Primary Authority Lock (blocks Laundry from overwriting Courier weight).
--              4. Order Status Immutability Lock ('in_washing' and later locked).
--              5. Admin Override Preservation.
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
  v_is_admin BOOLEAN := FALSE;
  v_is_courier BOOLEAN := FALSE;
BEGIN
  -- 1. Input Weight Sanity Validation (> 0 kg and <= 50 kg)
  IF p_final_weight_kg IS NULL OR p_final_weight_kg <= 0 THEN
    RAISE EXCEPTION 'Validasi Berat Gagal: Berat aktual harus berupa angka lebih besar dari 0 kg.';
  END IF;

  IF p_final_weight_kg > 50.0 THEN
    RAISE EXCEPTION 'Validasi Berat Gagal: Berat aktual maksimal adalah 50 kg per pesanan.';
  END IF;

  -- 2. Authenticated Actor Check (auth.uid() identity enforcement)
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Security Error: User tidak terautentikasi (auth.uid() missing).';
  END IF;

  -- Determine caller administrative privileges
  v_is_admin := public.is_platform_admin();
  v_is_courier := public.is_assigned_courier(p_order_id);

  -- 3. Lock Order FOR UPDATE to prevent race conditions
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan dengan ID % tidak ditemukan.', p_order_id;
  END IF;

  -- 4. Multi-Role Authorization & Primary Authority Lock
  -- If order has an assigned courier and weight has already been set by courier, block laundry modification
  IF v_order.courier_id IS NOT NULL AND v_order.final_weight_kg IS NOT NULL AND NOT v_is_courier AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Akses Ditolak: Pihak Laundry tidak dapat mengubah berat aktual yang telah ditimbang oleh Kurir.';
  END IF;

  -- Allow Assigned Courier, Unassigned Laundry Member, or Platform Admin
  IF NOT (
    v_is_courier OR
    (v_order.courier_id IS NULL AND public.is_laundry_member(v_order.laundry_id)) OR
    v_is_admin
  ) THEN
    RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang untuk menimbang atau mengubah berat aktual pesanan ini.';
  END IF;

  -- 5. Order State Machine Immutability Validation (Allowed only in 'pending', 'assigned', 'picked_up')
  IF v_order.status NOT IN ('pending', 'assigned', 'picked_up') THEN
    RAISE EXCEPTION 'Penimbangan Ditolak: Pesanan sudah dalam pencucian atau selesai (status order saat ini: %).', v_order.status;
  END IF;

  -- 6. Immutability Lock: Block modification if Payment Adjustment is already PAID (unless Admin)
  IF NOT v_is_admin AND EXISTS (
    SELECT 1 FROM public.payment_attempts
    WHERE order_id = p_order_id
      AND adjustment_type = 'weight_increase'
      AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Penimbangan Ditolak: Berat aktual tidak dapat diubah karena penyesuaian pembayaran telah dibayar.';
  END IF;

  -- 7. Idempotency Check: Return early if final weight is identical
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

  -- 8. Atomic Order Items Update & Price Recalculation (Database Source of Truth)
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

  -- 9. Scoped Local Transaction Bypass for Column Tampering Trigger
  PERFORM set_config('app.payment_processing', 'true', true);

  -- 10. Update Orders Table
  UPDATE public.orders
  SET final_weight_kg = p_final_weight_kg,
      subtotal = v_new_subtotal,
      total_price = v_new_total_price,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- 11. Audit Log Entry (using auth.uid() as updated_by)
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
