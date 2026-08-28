-- Migration: 026_update_payment_transition_rpc.sql
-- Description: Updates transition_payment_status_atomic to allow safe transitions to/from refund_pending.

CREATE OR REPLACE FUNCTION public.transition_payment_status_atomic(
  p_payment_id UUID,
  p_target_status payment_status,
  p_notes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_attempt public.payment_attempts%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_allowed BOOLEAN := FALSE;
BEGIN
  -- 1. Set local transaction configuration parameter for trigger authorization bypass
  PERFORM set_config('app.payment_processing', 'true', true);

  -- 2. Lock & Fetch Payment Attempt (FOR UPDATE)
  SELECT * INTO v_payment_attempt
  FROM public.payment_attempts
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment attempt dengan ID % tidak ditemukan.', p_payment_id;
  END IF;

  -- 3. Lock & Fetch Associated Order (FOR UPDATE)
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_payment_attempt.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order terkait % tidak ditemukan.', v_payment_attempt.order_id;
  END IF;

  -- 4. Idempotency Check
  IF v_payment_attempt.status = p_target_status THEN
    IF v_order.payment_status <> p_target_status THEN
      UPDATE public.orders
      SET payment_status = p_target_status,
          updated_at = v_now
      WHERE id = v_order.id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'payment_id', v_payment_attempt.id,
      'order_id', v_order.id,
      'status', p_target_status,
      'order_status', v_order.status
    );
  END IF;

  -- 5. Validate State Machine Graph Transition (Updated for refund_pending)
  CASE v_payment_attempt.status
    WHEN 'unpaid' THEN
      v_allowed := (p_target_status = 'pending');
    WHEN 'pending' THEN
      v_allowed := (p_target_status IN ('paid', 'failed', 'expired'));
    WHEN 'paid' THEN
      v_allowed := (p_target_status IN ('refund_pending', 'refunded'));
    WHEN 'refund_pending' THEN
      v_allowed := (p_target_status = 'refunded');
    ELSE
      v_allowed := FALSE;
  END CASE;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transisi status pembayaran tidak valid: % -> %', v_payment_attempt.status, p_target_status;
  END IF;

  -- 6. Atomic Update 1: payment_attempts
  UPDATE public.payment_attempts
  SET status = p_target_status,
      paid_at = CASE WHEN p_target_status = 'paid' THEN v_now ELSE paid_at END,
      updated_at = v_now
  WHERE id = v_payment_attempt.id;

  -- 7. Atomic Update 2: orders.payment_status (CRITICAL: orders.status MUST REMAIN UNCHANGED!)
  UPDATE public.orders
  SET payment_status = p_target_status,
      updated_at = v_now
  WHERE id = v_order.id;

  -- 8. Audit Log Entry: order_status_logs
  IF p_target_status = 'paid' THEN
    INSERT INTO public.order_status_logs (
      order_id,
      status,
      notes,
      updated_by
    ) VALUES (
      v_order.id,
      v_order.status,
      CASE WHEN p_notes IS NULL OR p_notes = '' THEN 'Pembayaran terverifikasi lunas oleh Payment Gateway.' ELSE p_notes END,
      v_payment_attempt.customer_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'payment_id', v_payment_attempt.id,
    'order_id', v_order.id,
    'status', p_target_status,
    'order_status', v_order.status
  );
END;
$$;
