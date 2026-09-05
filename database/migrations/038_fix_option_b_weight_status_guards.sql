-- Migration: 038_fix_option_b_weight_status_guards.sql
-- Description: Hardens Option B Weight Flow RPC status guards.
-- 1. save_courier_preliminary_weight_atomic: Allows status 'assigned' and 'picked_up' ONLY.
-- 2. finalize_laundry_weight_atomic: Allows status 'picked_up' ONLY.

BEGIN;

-- 1. Courier Preliminary Weigh Atomic RPC Status Guard Update
CREATE OR REPLACE FUNCTION public.save_courier_preliminary_weight_atomic(
  p_order_id UUID,
  p_courier_weight_kg NUMERIC,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_actor_id UUID;
  v_log_notes TEXT;
  v_is_admin BOOLEAN := FALSE;
  v_is_courier BOOLEAN := FALSE;
BEGIN
  -- 1. Sanity Validation (> 0 kg and <= 50 kg)
  IF p_courier_weight_kg IS NULL OR p_courier_weight_kg <= 0 THEN
    RAISE EXCEPTION 'Validasi Berat Gagal: Berat preliminary harus lebih besar dari 0 kg.';
  END IF;

  IF p_courier_weight_kg > 50.0 THEN
    RAISE EXCEPTION 'Validasi Berat Gagal: Berat preliminary maksimal adalah 50 kg.';
  END IF;

  -- 2. Actor Authentication Check
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Security Error: User tidak terautentikasi (auth.uid() missing).';
  END IF;

  v_is_admin := public.is_platform_admin();
  v_is_courier := public.is_assigned_courier(p_order_id);

  IF NOT (v_is_courier OR v_is_admin) THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya kurir terarsip/assigned yang dapat memasukkan berat preliminary.';
  END IF;

  -- 3. Lock Order FOR UPDATE
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan dengan ID % tidak ditemukan.', p_order_id;
  END IF;

  -- 4. Strict Status Guard: Allowed ONLY in 'assigned' or 'picked_up'
  IF v_order.status NOT IN ('assigned', 'picked_up') THEN
    RAISE EXCEPTION 'Penimbangan Ditolak: Berat awal kurir hanya dapat dicatat setelah kurir ditugaskan atau pakaian telah dijemput.';
  END IF;

  -- 5. Immutability check: Block if Laundry has already finalized weight
  IF v_order.weight_finalized_at IS NOT NULL AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Penimbangan Ditolak: Berat sudah difinalisasi oleh pihak laundry.';
  END IF;

  -- 6. Update Orders Table (ONLY courier_weight_kg, updated_at)
  UPDATE public.orders
  SET courier_weight_kg = p_courier_weight_kg,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- 7. Audit Log Entry
  v_log_notes := COALESCE(p_notes, 'Kurir menimbang berat preliminary: ' || p_courier_weight_kg || ' kg (menunggu verifikasi laundry)');

  INSERT INTO public.order_status_logs (order_id, status, notes, updated_by)
  VALUES (
    p_order_id,
    v_order.status,
    v_log_notes,
    v_actor_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'courier_weight_kg', p_courier_weight_kg
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_courier_preliminary_weight_atomic(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_courier_preliminary_weight_atomic(UUID, NUMERIC, TEXT) TO authenticated, service_role;


-- 2. Laundry Finalize Weight Atomic RPC Status Guard Update
CREATE OR REPLACE FUNCTION public.finalize_laundry_weight_atomic(
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
  v_log_notes TEXT;
  v_is_admin BOOLEAN := FALSE;
  v_is_laundry_member BOOLEAN := FALSE;
BEGIN
  -- 1. Sanity Validation (> 0 kg and <= 50 kg)
  IF p_final_weight_kg IS NULL OR p_final_weight_kg <= 0 THEN
    RAISE EXCEPTION 'Validasi Berat Gagal: Berat aktual harus lebih besar dari 0 kg.';
  END IF;

  IF p_final_weight_kg > 50.0 THEN
    RAISE EXCEPTION 'Validasi Berat Gagal: Berat aktual maksimal adalah 50 kg.';
  END IF;

  -- 2. Actor Authentication Check
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Security Error: User tidak terautentikasi (auth.uid() missing).';
  END IF;

  v_is_admin := public.is_platform_admin();

  -- 3. Lock Order FOR UPDATE
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan dengan ID % tidak ditemukan.', p_order_id;
  END IF;

  v_is_laundry_member := public.is_laundry_member(v_order.laundry_id);

  IF NOT (v_is_laundry_member OR v_is_admin) THEN
    RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang laundry untuk memfinalisasi berat pesanan ini.';
  END IF;

  -- 4. Strict Status Guard: Finalization allowed ONLY when status = 'picked_up'
  IF v_order.status <> 'picked_up' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Penimbangan Ditolak: Finalisasi berat laundry hanya dapat dilakukan setelah pakaian dijemput kurir dan diterima untuk proses verifikasi.';
  END IF;

  -- 5. Immutability Lock: Block modification if Payment Adjustment is already PAID (unless Admin)
  IF NOT v_is_admin AND EXISTS (
    SELECT 1 FROM public.payment_attempts
    WHERE order_id = p_order_id
      AND adjustment_type = 'weight_increase'
      AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Penimbangan Ditolak: Berat final tidak dapat diubah karena penyesuaian pembayaran telah dibayar.';
  END IF;

  v_old_total_price := COALESCE(v_order.total_price, 0);

  -- 6. Atomic Order Items Update & Price Recalculation (with Minimum Charge Floor)
  UPDATE public.order_items oi
  SET actual_weight = p_final_weight_kg,
      quantity = p_final_weight_kg,
      subtotal = ROUND(
        GREATEST(
          p_final_weight_kg,
          COALESCE(
            oi.min_weight_snapshot,
            (SELECT GREATEST(COALESCE(min_weight, 1), 1) FROM public.services WHERE id = oi.service_id),
            1
          )
        ) * COALESCE(oi.price_snapshot, 0)
      )
  WHERE oi.order_id = p_order_id;

  -- Compute new subtotal from order_items
  SELECT COALESCE(SUM(subtotal), 0) INTO v_new_subtotal
  FROM public.order_items
  WHERE order_id = p_order_id;

  -- Compute new total price
  v_new_total_price := GREATEST(
    0,
    v_new_subtotal + COALESCE(v_order.delivery_fee, 0) + COALESCE(v_order.platform_fee, 0) - COALESCE(v_order.discount, 0)
  );

  v_price_delta := v_new_total_price - v_old_total_price;

  -- 7. Scoped Local Transaction Bypass for Column Tampering Trigger
  PERFORM set_config('app.payment_processing', 'true', true);

  -- 8. Update Orders Table
  UPDATE public.orders
  SET final_weight_kg = p_final_weight_kg,
      weight_finalized_at = NOW(),
      weight_finalized_by = v_actor_id,
      subtotal = v_new_subtotal,
      total_price = v_new_total_price,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- 9. Audit Log Entry
  v_log_notes := COALESCE(p_notes, 'Pihak laundry memfinalisasi berat: ' || p_final_weight_kg || ' kg (Selisih harga: Rp ' || v_price_delta || ')');

  INSERT INTO public.order_status_logs (order_id, status, notes, updated_by)
  VALUES (
    p_order_id,
    v_order.status,
    v_log_notes,
    v_actor_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'final_weight_kg', p_final_weight_kg,
    'subtotal', v_new_subtotal,
    'total_price', v_new_total_price,
    'price_delta', v_price_delta
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_laundry_weight_atomic(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_laundry_weight_atomic(UUID, NUMERIC, TEXT) TO authenticated, service_role;

COMMIT;
