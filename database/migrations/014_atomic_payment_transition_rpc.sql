-- =============================================================================
-- FRESHLAUNDRY MARKETPLACE
-- Migration: 014_atomic_payment_transition_rpc.sql
-- Purpose: Atomic Payment State Transition RPC & Secure Webhook Authorization Path
-- Scope: Database RPC & Trigger Hardening
-- Status: IDEMPOTENT & PRODUCTION READY
-- =============================================================================

-- 1. CREATE ATOMIC PAYMENT TRANSITION RPC FUNCTION
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

  -- 4. Idempotency Check: If already in target_status, sync order payment_status if needed
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

  -- 5. Validate State Machine Graph Transition
  CASE v_payment_attempt.status
    WHEN 'unpaid' THEN
      v_allowed := (p_target_status = 'pending');
    WHEN 'pending' THEN
      v_allowed := (p_target_status IN ('paid', 'failed', 'expired'));
    WHEN 'paid' THEN
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
      v_order.status, -- Preserves existing order status (e.g. 'pending')
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


-- 2. RESTRICT RPC EXECUTION PRIVILEGES STRICTLY TO SERVICE_ROLE & POSTGRES
REVOKE EXECUTE ON FUNCTION public.transition_payment_status_atomic(UUID, payment_status, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_payment_status_atomic(UUID, payment_status, TEXT) TO service_role, postgres;


-- 3. UPDATE PREVENT_ORDER_COLUMN_TAMPERING TRIGGER FUNCTION TO HONOR ATOMIC PAYMENT PATH
CREATE OR REPLACE FUNCTION public.prevent_order_column_tampering()
RETURNS TRIGGER AS $$
BEGIN
  -- 0. Honor atomic payment RPC transaction context
  IF current_setting('app.payment_processing', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- 1. Platform Admin has unrestricted update privileges
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  -- 2. Tenant & Customer Identity Protection: Laundry ID, Customer ID, Tracking Number are IMMUTABLE
  IF NEW.laundry_id IS DISTINCT FROM OLD.laundry_id THEN
    RAISE EXCEPTION 'Security Error: Transferring orders between laundry tenants is prohibited.';
  END IF;

  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
    RAISE EXCEPTION 'Security Error: Modifying order customer identity is prohibited.';
  END IF;

  IF NEW.tracking_number IS DISTINCT FROM OLD.tracking_number THEN
    RAISE EXCEPTION 'Security Error: Modifying order tracking number is prohibited.';
  END IF;

  -- 3. Laundry Owner privileges (Operational & Pricing/Notes management)
  IF public.is_laundry_owner(OLD.laundry_id) THEN
    RETURN NEW;
  END IF;

  -- 4. Laundry Staff privileges (Operational Status only - CANNOT edit pricing/financials)
  IF public.is_laundry_staff(OLD.laundry_id) THEN
    IF NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
       NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee OR
       NEW.platform_fee IS DISTINCT FROM OLD.platform_fee OR
       NEW.discount IS DISTINCT FROM OLD.discount OR
       NEW.total_price IS DISTINCT FROM OLD.total_price OR
       NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      RAISE EXCEPTION 'Security Error: Laundry staff are not authorized to modify financial order fields.';
    END IF;
    RETURN NEW;
  END IF;

  -- 5. Courier privileges (Delivery Status & Notes only - CANNOT edit addresses, weight, or prices)
  IF public.is_assigned_courier(OLD.id) THEN
    IF NEW.service_type IS DISTINCT FROM OLD.service_type OR
       NEW.estimated_weight_kg IS DISTINCT FROM OLD.estimated_weight_kg OR
       NEW.pickup_address IS DISTINCT FROM OLD.pickup_address OR
       NEW.delivery_address IS DISTINCT FROM OLD.delivery_address OR
       NEW.pickup_date IS DISTINCT FROM OLD.pickup_date OR
       NEW.pickup_time_slot IS DISTINCT FROM OLD.pickup_time_slot OR
       NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
       NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee OR
       NEW.platform_fee IS DISTINCT FROM OLD.platform_fee OR
       NEW.discount IS DISTINCT FROM OLD.discount OR
       NEW.total_price IS DISTINCT FROM OLD.total_price OR
       NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      RAISE EXCEPTION 'Security Error: Couriers are only authorized to update order status and notes.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Security Error: Unauthorized order update attempt.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public VOLATILE;
