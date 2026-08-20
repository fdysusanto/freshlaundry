-- Migration 015: Harden RLS policies for dispatch_batches table
-- Purpose: Grant FOR INSERT and FOR UPDATE permissions on public.dispatch_batches 
-- to authenticated Laundry Members (Owners/Staff) and Platform Admins.

-- 1. Enable RLS (Idempotent safety)
ALTER TABLE public.dispatch_batches ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies on dispatch_batches if they exist to prevent duplicates
DROP POLICY IF EXISTS "Dispatch batches viewable by laundry members or admin" ON public.dispatch_batches;
DROP POLICY IF EXISTS "Laundry members can insert dispatch batches" ON public.dispatch_batches;
DROP POLICY IF EXISTS "Laundry members can update dispatch batches" ON public.dispatch_batches;
DROP POLICY IF EXISTS "Admins can manage dispatch batches" ON public.dispatch_batches;

-- 3. SELECT Policy: Laundry Members (Owner/Staff) and Platform Admins can view dispatch batches
CREATE POLICY "Dispatch batches viewable by laundry members or admin" 
ON public.dispatch_batches FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = dispatch_batches.order_id
      AND (public.is_laundry_member(o.laundry_id) OR public.is_platform_admin())
  )
);

-- 4. INSERT Policy: Laundry Members (Owner/Staff) and Platform Admins can insert dispatch batches for orders belonging to their laundry
CREATE POLICY "Laundry members can insert dispatch batches" 
ON public.dispatch_batches FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = dispatch_batches.order_id
      AND (public.is_laundry_member(o.laundry_id) OR public.is_platform_admin())
  )
);

-- 5. UPDATE Policy: Laundry Members (Owner/Staff) and Platform Admins can update dispatch batches (e.g. expiring/completing batches)
CREATE POLICY "Laundry members can update dispatch batches" 
ON public.dispatch_batches FOR UPDATE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = dispatch_batches.order_id
      AND (public.is_laundry_member(o.laundry_id) OR public.is_platform_admin())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = dispatch_batches.order_id
      AND (public.is_laundry_member(o.laundry_id) OR public.is_platform_admin())
  )
);

-- 6. ALL Policy for Platform Admins
CREATE POLICY "Admins can manage dispatch batches" 
ON public.dispatch_batches FOR ALL TO authenticated 
USING (public.is_platform_admin());
