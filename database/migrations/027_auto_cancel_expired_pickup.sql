-- Migration: 027_auto_cancel_expired_pickup.sql
-- Description: Implement Auto-Cancel Expired Pickup + Refund Pending logic inside atomic acceptance RPC.

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
  v_batch_expires_at TIMESTAMPTZ;
  v_pickup_date DATE;
  v_pickup_time_slot TEXT;
  v_delivery_date DATE;
  v_delivery_time_slot TEXT;
  v_slot_end_time TEXT;
  v_slot_end_tz TIMESTAMPTZ;
  v_customer_id UUID;
  v_payment_id UUID;
BEGIN
  -- Set transaction-local session context to bypass courier_id trigger check for atomic acceptance
  PERFORM set_config('app.courier_assignment', 'true', true);

  -- 1. Security Audit Check
  IF auth.uid() IS NOT NULL AND auth.uid() != p_courier_id AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Akses Ditolak: Anda tidak dapat menerima penugasan milik kurir lain.';
  END IF;

  -- 2. Lock Courier Profile FOR UPDATE
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

  -- 4. Lock and validate dispatch batch
  IF v_batch_id IS NOT NULL THEN
    SELECT status, expires_at INTO v_batch_status, v_batch_expires_at
    FROM public.dispatch_batches
    WHERE id = v_batch_id
    FOR UPDATE;

    IF FOUND AND v_batch_status != 'active' THEN
      RAISE EXCEPTION 'Batch penawaran sudah berakhir atau tidak aktif (status batch: %).', v_batch_status;
    END IF;
  END IF;

  -- 5. Lock and validate order
  SELECT status, payment_status, pickup_date, pickup_time_slot, delivery_date, delivery_time_slot, customer_id
  INTO v_order_status, v_payment_status, v_pickup_date, v_pickup_time_slot, v_delivery_date, v_delivery_time_slot, v_customer_id
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

    -- BUSINESS RULE: Auto-Cancel on expired time slot OR batch expiration
    v_slot_end_tz := NULL;
    IF v_pickup_date IS NOT NULL AND v_pickup_time_slot IS NOT NULL AND v_pickup_time_slot != '' THEN
      v_slot_end_time := split_part(v_pickup_time_slot, '-', 2);
      IF v_slot_end_time != '' THEN
        v_slot_end_tz := (v_pickup_date::text || ' ' || v_slot_end_time || ':00')::timestamp AT TIME ZONE 'Asia/Jakarta';
      END IF;
    END IF;

    IF (v_slot_end_tz IS NOT NULL AND NOW() >= v_slot_end_tz) OR (v_batch_id IS NOT NULL AND v_batch_expires_at <= NOW()) THEN
      -- Proceed with Auto Cancellation
      -- First, check if there is a paid payment attempt to refund
      SELECT id INTO v_payment_id FROM public.payment_attempts WHERE order_id = v_order_id AND status = 'paid' FOR UPDATE;
      
      -- Update Orders
      UPDATE public.orders
      SET status = 'cancelled',
          payment_status = CASE WHEN v_payment_id IS NOT NULL THEN 'refund_pending'::payment_status ELSE payment_status END,
          updated_at = NOW()
      WHERE id = v_order_id;

      -- Update Payment Attempt
      IF v_payment_id IS NOT NULL THEN
        UPDATE public.payment_attempts SET status = 'refund_pending' WHERE id = v_payment_id;
      END IF;

      -- Update Courier Assignments
      IF v_batch_id IS NOT NULL THEN
        UPDATE public.courier_assignments SET status = 'expired' WHERE batch_id = v_batch_id AND status = 'offered';
        UPDATE public.dispatch_batches SET status = 'expired' WHERE id = v_batch_id;
      ELSE
        UPDATE public.courier_assignments SET status = 'expired' WHERE id = p_assignment_id;
      END IF;

      -- Audit Log (Fallback to customer_id as system actor)
      INSERT INTO public.order_status_logs (order_id, status, notes, updated_by)
      VALUES (v_order_id, 'cancelled', 'Dibatalkan otomatis oleh sistem karena batas waktu pickup penawaran telah berakhir dan belum ada kurir yang menerima pesanan.', v_customer_id);

      RETURN jsonb_build_object(
        'success', false,
        'order_id', v_order_id,
        'assignment_type', v_assignment_type,
        'cancelled', true,
        'reason', 'pickup_deadline_expired',
        'refund_pending', (v_payment_id IS NOT NULL)
      );
    END IF;

    -- Standard Acceptance
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

    -- Batch Expiration Check
    IF v_batch_id IS NOT NULL AND v_batch_expires_at <= NOW() THEN
      RAISE EXCEPTION 'Penawaran kurir sudah kedaluwarsa.';
    END IF;

    -- Time slot check
    IF v_delivery_date IS NOT NULL AND v_delivery_time_slot IS NOT NULL AND v_delivery_time_slot != '' THEN
      v_slot_end_time := split_part(v_delivery_time_slot, '-', 2);
      IF v_slot_end_time != '' THEN
        v_slot_end_tz := (v_delivery_date::text || ' ' || v_slot_end_time || ':00')::timestamp AT TIME ZONE 'Asia/Jakarta';
        IF NOW() >= v_slot_end_tz THEN
          RAISE EXCEPTION 'Batas waktu pengantaran sudah terlewat.';
        END IF;
      END IF;
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
