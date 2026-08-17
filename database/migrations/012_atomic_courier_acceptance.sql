-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 012_atomic_courier_acceptance.sql
-- Description: Atomic PostgreSQL RPC for Courier Assignment Acceptance (Pickup & Delivery)
-- Author: Antigravity AI Architecture Team
-- Date: 2026-08-17
-- Status: IDEMPOTENT & PRODUCTION READY
-- =============================================================================

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
BEGIN
  -- 1. Lock and validate courier assignment
  SELECT order_id, assignment_type, status INTO v_order_id, v_assignment_type, v_assignment_status
  FROM public.courier_assignments
  WHERE id = p_assignment_id AND courier_id = p_courier_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Penugasan kurir tidak ditemukan atau tidak ditujukan untuk kurir ini.';
  END IF;

  IF v_assignment_status != 'offered' THEN
    RAISE EXCEPTION 'Penugasan kurir sudah tidak berlaku (status penugasan saat ini: %).', v_assignment_status;
  END IF;

  -- 2. Lock and validate order
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

  -- 3. Branch execution based on assignment_type
  IF v_assignment_type = 'pickup' THEN
    IF v_order_status != 'pending' THEN
      RAISE EXCEPTION 'Pesanan tidak dalam status menunggu penugasan (status order saat ini: %).', v_order_status;
    END IF;

    -- Update assignment status to accepted
    UPDATE public.courier_assignments
    SET status = 'accepted', responded_at = NOW()
    WHERE id = p_assignment_id;

    -- Update order status to assigned & set courier_id
    UPDATE public.orders
    SET courier_id = p_courier_id,
        status = 'assigned',
        updated_at = NOW()
    WHERE id = v_order_id;

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

    -- Insert order status log entry
    INSERT INTO public.order_status_logs (order_id, status, notes, updated_by)
    VALUES (v_order_id, 'out_for_delivery', 'Kurir menerima tugas pengantaran (delivery).', p_courier_id);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_status', 'out_for_delivery', 'assignment_type', 'delivery');

  ELSE
    RAISE EXCEPTION 'Tipe penugasan kurir % tidak dikenal.', v_assignment_type;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.accept_courier_assignment_atomic(UUID, UUID) TO authenticated, service_role;
