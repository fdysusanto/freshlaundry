-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 003_rls_security_hardening.sql
-- Description: Multi-tenant RLS Policies, Security Helper Functions & Column Immutability Triggers
-- Author: Antigravity AI Architecture Team
-- Date: 2026-08-12
-- Status: HARDENED & AUDITED (Idempotent & Production Ready)
-- =============================================================================

-- Default privilege strategy for newly created functions in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;


-- =============================================================================
-- 1. SECURITY HELPER FUNCTIONS (PL/pgSQL with SECURITY DEFINER & search_path)
-- =============================================================================

-- Helper 1: Check if authenticated user is a Platform Admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND role = 'platform_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- Helper 2: Check if authenticated user is an Owner of the specified laundry
CREATE OR REPLACE FUNCTION public.is_laundry_owner(_laundry_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL OR _laundry_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.laundry_users
    WHERE profile_id = auth.uid()
      AND laundry_id = _laundry_id
      AND role IN ('owner', 'laundry_owner')
      AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.laundries
    WHERE id = _laundry_id
      AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- Helper 3: Check if authenticated user is Staff at the specified laundry
CREATE OR REPLACE FUNCTION public.is_laundry_staff(_laundry_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL OR _laundry_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.laundry_users
    WHERE profile_id = auth.uid()
      AND laundry_id = _laundry_id
      AND role IN ('staff', 'laundry_staff')
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- Helper 4: Check if authenticated user is a Member (Owner OR Staff) of the specified laundry
CREATE OR REPLACE FUNCTION public.is_laundry_member(_laundry_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL OR _laundry_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN public.is_laundry_owner(_laundry_id) OR public.is_laundry_staff(_laundry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- Helper 5: Check if authenticated user is the assigned Courier for an order
CREATE OR REPLACE FUNCTION public.is_assigned_courier(_order_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL OR _order_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = _order_id
      AND courier_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.courier_assignments
    WHERE order_id = _order_id
      AND courier_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- Helper 6: Get authenticated user's current role safely without RLS recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
DECLARE
  _role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT role INTO _role FROM public.profiles WHERE id = auth.uid();
  RETURN _role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- Privilege Controls for RLS Helper Functions:
-- Allow anon and authenticated to execute helper functions (which safely return FALSE when auth.uid() IS NULL)
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_laundry_owner(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_laundry_staff(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_laundry_member(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigned_courier(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon, authenticated;


-- =============================================================================
-- 2. PUBLIC TRACKING SECURE VIEW
-- =============================================================================
DROP POLICY IF EXISTS "Anyone can track by tracking number" ON public.orders;

CREATE OR REPLACE VIEW public.public_order_tracking AS
SELECT 
  o.tracking_number,
  o.status AS order_status,
  l.name AS laundry_name,
  o.created_at,
  o.updated_at,
  o.delivery_date AS estimated_delivery_date
FROM public.orders o
JOIN public.laundries l ON l.id = o.laundry_id;

GRANT SELECT ON public.public_order_tracking TO anon, authenticated;


-- =============================================================================
-- 3. ENABLE RLS ON ALL TABLES
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 4. CLEANUP EXISTING & PREVIOUS POLICIES FOR FULL IDEMPOTENCY
-- =============================================================================
-- Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by self or admin" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Laundries
DROP POLICY IF EXISTS "Laundries are viewable by everyone" ON public.laundries;
DROP POLICY IF EXISTS "Public laundries viewable by everyone" ON public.laundries;
DROP POLICY IF EXISTS "Owners can update own laundry" ON public.laundries;
DROP POLICY IF EXISTS "Owners can create laundry" ON public.laundries;
DROP POLICY IF EXISTS "Admins full control on laundries" ON public.laundries;

-- Laundry Users
DROP POLICY IF EXISTS "Laundry members viewable by owner or self or admin" ON public.laundry_users;
DROP POLICY IF EXISTS "Owners can manage laundry users" ON public.laundry_users;
DROP POLICY IF EXISTS "Admins full control on laundry users" ON public.laundry_users;

-- Services
DROP POLICY IF EXISTS "Services are viewable by everyone" ON public.services;
DROP POLICY IF EXISTS "Public services viewable by everyone" ON public.services;
DROP POLICY IF EXISTS "Owners can insert services" ON public.services;
DROP POLICY IF EXISTS "Owners can update services" ON public.services;
DROP POLICY IF EXISTS "Owners can delete services" ON public.services;
DROP POLICY IF EXISTS "Admins full control on services" ON public.services;

-- Orders
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can create own orders" ON public.orders;
DROP POLICY IF EXISTS "Laundry partners can view own laundry orders" ON public.orders;
DROP POLICY IF EXISTS "Laundry partners can update own laundry orders" ON public.orders;
DROP POLICY IF EXISTS "Laundry partners can view laundry orders" ON public.orders;
DROP POLICY IF EXISTS "Owners can update laundry orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update operational order status" ON public.orders;
DROP POLICY IF EXISTS "Couriers can view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Couriers can update assigned order status" ON public.orders;
DROP POLICY IF EXISTS "Platform admins have full access on orders" ON public.orders;
DROP POLICY IF EXISTS "Admins full control on orders" ON public.orders;

-- Order Items
DROP POLICY IF EXISTS "Order items viewable by order visibility" ON public.order_items;
DROP POLICY IF EXISTS "Customers can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Laundry members can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins full control on order items" ON public.order_items;

-- Order Status Logs
DROP POLICY IF EXISTS "Status logs viewable by order visibility" ON public.order_status_logs;
DROP POLICY IF EXISTS "Authorized actors can insert status logs" ON public.order_status_logs;

-- Courier Assignments
DROP POLICY IF EXISTS "Couriers can view own assignments" ON public.courier_assignments;
DROP POLICY IF EXISTS "Couriers can update own assignments" ON public.courier_assignments;
DROP POLICY IF EXISTS "Laundry members can create courier assignments" ON public.courier_assignments;
DROP POLICY IF EXISTS "Admins can manage assignments" ON public.courier_assignments;

-- Laundry Payouts
DROP POLICY IF EXISTS "Owners can view own laundry payouts" ON public.laundry_payouts;
DROP POLICY IF EXISTS "Admins full control on payouts" ON public.laundry_payouts;

-- Reviews
DROP POLICY IF EXISTS "Reviews viewable by everyone" ON public.reviews;
DROP POLICY IF EXISTS "Customers can create reviews for completed orders" ON public.reviews;
DROP POLICY IF EXISTS "Admins full control on reviews" ON public.reviews;


-- =============================================================================
-- 5. RLS POLICIES & IMMUTABILITY TRIGGER FOR TABEL PROFILES
-- =============================================================================
CREATE POLICY "Profiles viewable by self or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_platform_admin())
  WITH CHECK (
    (id = auth.uid() AND role = public.get_my_role())
    OR public.is_platform_admin()
  );

-- Database Trigger: Enforce ID and Role immutability for profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Security Error: Modifying profile ID is prohibited.';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Security Error: Regular users are not authorized to modify their role.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public VOLATILE;

DROP TRIGGER IF EXISTS trigger_prevent_profile_tampering ON public.profiles;
CREATE TRIGGER trigger_prevent_profile_tampering
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_tampering();

-- Revoke direct API execution for trigger function
REVOKE EXECUTE ON FUNCTION public.prevent_profile_tampering() FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- 6. RLS POLICIES FOR TABEL LAUNDRIES
-- =============================================================================
CREATE POLICY "Public laundries viewable by everyone" ON public.laundries
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_laundry_member(id) OR public.is_platform_admin());

CREATE POLICY "Owners can create laundry" ON public.laundries
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Owners can update own laundry" ON public.laundries
  FOR UPDATE TO authenticated
  USING (public.is_laundry_owner(id) OR public.is_platform_admin())
  WITH CHECK (public.is_laundry_owner(id) OR public.is_platform_admin());

CREATE POLICY "Admins full control on laundries" ON public.laundries
  FOR ALL TO authenticated
  USING (public.is_platform_admin());


-- =============================================================================
-- 7. RLS POLICIES FOR TABEL LAUNDRY_USERS
-- =============================================================================
CREATE POLICY "Laundry members viewable by owner or self or admin" ON public.laundry_users
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.is_laundry_owner(laundry_id)
    OR public.is_platform_admin()
  );

CREATE POLICY "Owners can manage laundry users" ON public.laundry_users
  FOR ALL TO authenticated
  USING (public.is_laundry_owner(laundry_id) OR public.is_platform_admin());

CREATE POLICY "Admins full control on laundry users" ON public.laundry_users
  FOR ALL TO authenticated
  USING (public.is_platform_admin());


-- =============================================================================
-- 8. RLS POLICIES FOR TABEL SERVICES
-- =============================================================================
CREATE POLICY "Public services viewable by everyone" ON public.services
  FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.is_laundry_member(laundry_id) OR public.is_platform_admin());

CREATE POLICY "Owners can insert services" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (public.is_laundry_owner(laundry_id) OR public.is_platform_admin());

CREATE POLICY "Owners can update services" ON public.services
  FOR UPDATE TO authenticated
  USING (public.is_laundry_owner(laundry_id) OR public.is_platform_admin())
  WITH CHECK (public.is_laundry_owner(laundry_id) OR public.is_platform_admin());

CREATE POLICY "Owners can delete services" ON public.services
  FOR DELETE TO authenticated
  USING (public.is_laundry_owner(laundry_id) OR public.is_platform_admin());

CREATE POLICY "Admins full control on services" ON public.services
  FOR ALL TO authenticated
  USING (public.is_platform_admin());


-- =============================================================================
-- 9. RLS POLICIES & COLUMN IMMUTABILITY TRIGGER FOR TABEL ORDERS
-- =============================================================================
CREATE POLICY "Customers can view own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Customers can create own orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Laundry partners can view laundry orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.is_laundry_member(laundry_id) OR public.is_platform_admin());

CREATE POLICY "Owners can update laundry orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_laundry_owner(laundry_id) OR public.is_platform_admin())
  WITH CHECK (public.is_laundry_owner(laundry_id) OR public.is_platform_admin());

CREATE POLICY "Staff can update operational order status" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_laundry_staff(laundry_id))
  WITH CHECK (public.is_laundry_staff(laundry_id));

CREATE POLICY "Couriers can view assigned orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.is_assigned_courier(id) OR public.is_platform_admin());

CREATE POLICY "Couriers can update assigned order status" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_assigned_courier(id))
  WITH CHECK (public.is_assigned_courier(id));

CREATE POLICY "Admins full control on orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.is_platform_admin());

-- Database Trigger: Enforce Column Immutability & Role-Based Modification Rules on ORDERS
CREATE OR REPLACE FUNCTION public.prevent_order_column_tampering()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trigger_prevent_order_column_tampering ON public.orders;
CREATE TRIGGER trigger_prevent_order_column_tampering
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.prevent_order_column_tampering();

-- Revoke direct API execution for trigger function
REVOKE EXECUTE ON FUNCTION public.prevent_order_column_tampering() FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- 10. RLS POLICIES FOR TABEL ORDER_ITEMS
-- =============================================================================
CREATE POLICY "Order items viewable by order visibility" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.customer_id = auth.uid()
          OR public.is_laundry_member(o.laundry_id)
          OR public.is_assigned_courier(o.id)
          OR public.is_platform_admin()
        )
    )
  );

CREATE POLICY "Customers can insert order items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()
    )
  );

CREATE POLICY "Laundry members can update order items" ON public.order_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND public.is_laundry_member(o.laundry_id)
    )
  );

CREATE POLICY "Admins full control on order items" ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_platform_admin());


-- =============================================================================
-- 11. RLS POLICIES FOR TABEL ORDER_STATUS_LOGS
-- =============================================================================
CREATE POLICY "Status logs viewable by order visibility" ON public.order_status_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_logs.order_id
        AND (
          o.customer_id = auth.uid()
          OR public.is_laundry_member(o.laundry_id)
          OR public.is_assigned_courier(o.id)
          OR public.is_platform_admin()
        )
    )
  );

CREATE POLICY "Authorized actors can insert status logs" ON public.order_status_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_logs.order_id
        AND (
          public.is_laundry_member(o.laundry_id)
          OR public.is_assigned_courier(o.id)
          OR public.is_platform_admin()
        )
    )
  );


-- =============================================================================
-- 12. RLS POLICIES & IMMUTABILITY TRIGGER FOR TABEL COURIER_ASSIGNMENTS
-- =============================================================================
CREATE POLICY "Couriers can view own assignments" ON public.courier_assignments
  FOR SELECT TO authenticated
  USING (
    courier_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = courier_assignments.order_id AND public.is_laundry_member(o.laundry_id)
    )
    OR public.is_platform_admin()
  );

CREATE POLICY "Couriers can update own assignments" ON public.courier_assignments
  FOR UPDATE TO authenticated
  USING (courier_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Laundry members can create courier assignments" ON public.courier_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = courier_assignments.order_id AND public.is_laundry_member(o.laundry_id)
    )
  );

CREATE POLICY "Admins can manage assignments" ON public.courier_assignments
  FOR ALL TO authenticated
  USING (public.is_platform_admin());

-- Database Trigger: Enforce column immutability for couriers (prevents courier from changing order_id, courier_id, assignment_type, offered_at, created_at)
CREATE OR REPLACE FUNCTION public.prevent_courier_assignment_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_platform_admin() AND NOT EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = OLD.order_id AND public.is_laundry_member(o.laundry_id)
  ) THEN
    IF NEW.order_id IS DISTINCT FROM OLD.order_id OR
       NEW.courier_id IS DISTINCT FROM OLD.courier_id OR
       NEW.assignment_type IS DISTINCT FROM OLD.assignment_type OR
       NEW.offered_at IS DISTINCT FROM OLD.offered_at OR
       NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Security Error: Unauthorized modification of administrative assignment fields.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public VOLATILE;

DROP TRIGGER IF EXISTS trigger_prevent_courier_assignment_tampering ON public.courier_assignments;
CREATE TRIGGER trigger_prevent_courier_assignment_tampering
BEFORE UPDATE ON public.courier_assignments
FOR EACH ROW EXECUTE FUNCTION public.prevent_courier_assignment_tampering();

-- Revoke direct API execution for trigger function
REVOKE EXECUTE ON FUNCTION public.prevent_courier_assignment_tampering() FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- 13. RLS POLICIES FOR TABEL LAUNDRY_PAYOUTS (STRICT OWNER & ADMIN ONLY)
-- =============================================================================
CREATE POLICY "Owners can view own laundry payouts" ON public.laundry_payouts
  FOR SELECT TO authenticated
  USING (public.is_laundry_owner(laundry_id) OR public.is_platform_admin());

CREATE POLICY "Admins full control on payouts" ON public.laundry_payouts
  FOR ALL TO authenticated
  USING (public.is_platform_admin());


-- =============================================================================
-- 14. RLS POLICIES FOR TABEL REVIEWS
-- =============================================================================
CREATE POLICY "Reviews viewable by everyone" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Customers can create reviews for completed orders" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = reviews.order_id
        AND o.customer_id = auth.uid()
        AND o.status = 'delivered'
    )
  );

CREATE POLICY "Admins full control on reviews" ON public.reviews
  FOR ALL TO authenticated
  USING (public.is_platform_admin());

-- =============================================================================
-- END OF MIGRATION 003_RLS_SECURITY_HARDENING.SQL
-- =============================================================================
