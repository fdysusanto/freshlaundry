-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 006_order_operations.sql
-- Description: End-to-End Operational Lifecycle Triggers & Security Enhancements
-- Author: Antigravity AI Architecture Team
-- Date: 2026-08-14
-- Status: IDEMPOTENT & PRODUCTION READY
-- =============================================================================

-- 1. VERIFY ORDER STATUS LOGS INDEXES
CREATE INDEX IF NOT EXISTS idx_order_status_logs_order_id_status ON public.order_status_logs(order_id, status);

-- 2. VERIFY COURIER ASSIGNMENT INDEXES
CREATE INDEX IF NOT EXISTS idx_courier_assignments_order_status ON public.courier_assignments(order_id, status);

-- 3. ENSURE RLS POLICIES FOR ORDER OPERATIONAL TRANSITIONS
ALTER TABLE public.order_status_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Order status logs viewable by order participants" ON public.order_status_logs;
CREATE POLICY "Order status logs viewable by order participants" ON public.order_status_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_logs.order_id
      AND (o.customer_id = auth.uid() OR o.courier_id = auth.uid() OR public.is_platform_admin())
    )
  );

DROP POLICY IF EXISTS "Order status logs insertion by authenticated users" ON public.order_status_logs;
CREATE POLICY "Order status logs insertion by authenticated users" ON public.order_status_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = updated_by OR public.is_platform_admin());
