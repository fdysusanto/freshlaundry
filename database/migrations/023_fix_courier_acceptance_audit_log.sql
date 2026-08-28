-- Migration: 023_fix_courier_acceptance_audit_log.sql
-- Description: Fix typo created_by -> updated_by in accept_courier_assignment_atomic RPC.

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
  -- Set transaction-local session context to bypass courier_id trigger check for atomic acceptance
  PERFORM set_config('app.courier_assignment', 'true', true);

  -- 1. Security Audit Check: Enforce caller identity (except service_role)
  IF auth.uid() IS NOT NULL AND auth.uid() != p_courier_id AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Akses Ditolak: Anda tidak dapat menerima penugasan milik kurir lain.';
  END IF;

  -- 2. Lock Courier Profile FOR UPDATE first
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

  -- 6. Server-Side Busy Courier Protection
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

    UPDATE public.courier_assignments
    SET status = 'accepted', responded_at = NOW()
    WHERE id = p_assignment_id;

    UPDATE public.orders
    SET courier_id = p_courier_id, status = 'assigned'
    WHERE id = v_order_id;

    IF v_batch_id IS NOT NULL THEN
      UPDATE public.dispatch_batches
      SET status = 'completed'
      WHERE id = v_batch_id;

      UPDATE public.courier_assignments
      SET status = 'expired'
      WHERE batch_id = v_batch_id AND id != p_assignment_id AND status = 'offered';
    END IF;

    INSERT INTO public.order_status_logs (order_id, status, notes, updated_by)
    VALUES (v_order_id, 'assigned', 'Kurir menerima tugas penjemputan (pickup).', p_courier_id);

  ELSIF v_assignment_type = 'delivery' THEN
    IF v_order_status != 'ready_for_delivery' THEN
      RAISE EXCEPTION 'Pesanan tidak dalam status siap diantar (status order saat ini: %).', v_order_status;
    END IF;

    UPDATE public.courier_assignments
    SET status = 'accepted', responded_at = NOW()
    WHERE id = p_assignment_id;

    UPDATE public.orders
    SET courier_id = p_courier_id, status = 'out_for_delivery'
    WHERE id = v_order_id;

    IF v_batch_id IS NOT NULL THEN
      UPDATE public.dispatch_batches
      SET status = 'completed'
      WHERE id = v_batch_id;

      UPDATE public.courier_assignments
      SET status = 'expired'
      WHERE batch_id = v_batch_id AND id != p_assignment_id AND status = 'offered';
    END IF;

    INSERT INTO public.order_status_logs (order_id, status, notes, updated_by)
    VALUES (v_order_id, 'out_for_delivery', 'Kurir menerima tugas pengantaran (delivery).', p_courier_id);

  ELSE
    RAISE EXCEPTION 'Tipe penugasan % tidak valid.', v_assignment_type;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'assignment_type', v_assignment_type,
    'courier_id', p_courier_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public VOLATILE;
