-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 007_restrict_customer_order_creation.sql
-- Description: Restrict customer order creation on public.orders & public.order_items
--              to authenticated users with 'customer' role ONLY.
-- Author: Antigravity AI Architecture Team
-- Date: 2026-08-15
-- Status: HARDENED & AUDITED (Idempotent & Production Ready)
-- =============================================================================

-- 1. RESTRICT ORDERS INSERT POLICY
-- Operational roles (courier, laundry_owner, laundry_staff, platform_admin)
-- are prohibited from inserting customer orders.
DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can create own orders" ON public.orders;

CREATE POLICY "Customers can create own orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND public.get_my_role() = 'customer'::user_role
  );

-- 2. RESTRICT ORDER ITEMS INSERT POLICY
DROP POLICY IF EXISTS "Customers can insert order items" ON public.order_items;

CREATE POLICY "Customers can insert order items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'customer'::user_role
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()
    )
  );

-- 3. HARDEN ATOMIC RPC FUNCTION TO PREVENT SECURITY DEFINER BYPASS
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

GRANT EXECUTE ON FUNCTION public.create_order_with_items_atomic TO authenticated, service_role;

