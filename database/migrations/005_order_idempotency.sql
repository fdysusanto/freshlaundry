-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 005_order_idempotency.sql
-- Description: Add idempotency_key to orders table & Atomic RPC Order Creation Function
-- Author: Antigravity AI Architecture Team
-- Date: 2026-08-14
-- Status: IDEMPOTENT & PRODUCTION READY
-- =============================================================================

-- 1. ADD IDEMPOTENCY_KEY COLUMN TO ORDERS TABLE
DO $$ BEGIN
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2. CREATE INDEX FOR FAST IDEMPOTENCY LOOKUPS
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON public.orders(idempotency_key);


-- 3. CREATE ATOMIC POSTGRESQL RPC FUNCTION FOR ORDER + ORDER_ITEMS INSERTION
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
AS $$
DECLARE
  v_existing_order_id UUID;
  v_order_id UUID;
  v_result JSONB;
  v_item JSONB;
BEGIN
  -- Idempotency Check: If order with this idempotency_key already exists, return it!
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

  -- 1. Insert Order
  INSERT INTO public.orders (
    tracking_number,
    customer_id,
    laundry_id,
    service_type,
    status,
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
    payment_status,
    idempotency_key
  ) VALUES (
    p_tracking_number,
    p_customer_id,
    p_laundry_id,
    p_service_type,
    'pending'::order_status,
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
    'unpaid'::payment_status,
    p_idempotency_key
  )
  RETURNING id INTO v_order_id;

  -- 2. Insert Order Items from JSON Array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_json)
  LOOP
    INSERT INTO public.order_items (
      order_id,
      service_id,
      service_name_snapshot,
      price_snapshot,
      estimated_weight,
      quantity,
      subtotal
    ) VALUES (
      v_order_id,
      (v_item->>'service_id')::UUID,
      v_item->>'service_name_snapshot',
      (v_item->>'price_snapshot')::NUMERIC,
      (v_item->>'estimated_weight')::NUMERIC,
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'subtotal')::NUMERIC
    );
  END LOOP;

  -- 3. Insert Initial Order Status Log
  INSERT INTO public.order_status_logs (
    order_id,
    status,
    notes,
    updated_by
  ) VALUES (
    v_order_id,
    'pending'::order_status,
    'Pesanan baru berhasil dibuat melalui Order Checkout Engine',
    p_customer_id
  );

  -- Return Result Summary JSON
  RETURN jsonb_build_object(
    'is_duplicate', false,
    'order_id', v_order_id,
    'tracking_number', p_tracking_number,
    'status', 'pending',
    'payment_status', 'unpaid',
    'total_price', p_total_price,
    'created_at', NOW()
  );
END;
$$;

-- 4. GRANT EXECUTE PERMISSION TO AUTHENTICATED USERS
GRANT EXECUTE ON FUNCTION public.create_order_with_items_atomic TO authenticated, service_role;
