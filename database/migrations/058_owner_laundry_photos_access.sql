-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 058_owner_laundry_photos_access.sql
-- Description: Extend laundry_photos RLS and set_primary_laundry_photo RPC to Laundry Owners
-- Author: Antigravity AI Architecture Team
-- Date: 2026-09-25
-- Status: PRODUCTION-READY (Idempotent & Multi-Tenant Safe)
-- =============================================================================

-- 1. EXTEND ATOMIC RPC FUNCTION TO ALLOW PLATFORM ADMIN AND LAUNDRY OWNER
CREATE OR REPLACE FUNCTION public.set_primary_laundry_photo(
  p_laundry_id UUID,
  p_photo_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_photo_exists BOOLEAN;
BEGIN
  -- Verify caller authorization: Platform Admin OR Owner of target laundry
  IF NOT (public.is_platform_admin() OR public.is_laundry_owner(p_laundry_id)) THEN
    RAISE EXCEPTION 'Akses Ditolak: Anda tidak memiliki wewenang untuk mengubah foto utama outlet ini.';
  END IF;

  -- Verify target photo exists and belongs to p_laundry_id
  SELECT EXISTS(
    SELECT 1 FROM public.laundry_photos
    WHERE id = p_photo_id AND laundry_id = p_laundry_id
  ) INTO v_photo_exists;

  IF NOT v_photo_exists THEN
    RAISE EXCEPTION 'Foto tidak ditemukan atau tidak terdaftar pada outlet laundry ini.';
  END IF;

  -- 1. Unset current primary photo for target laundry
  UPDATE public.laundry_photos
  SET is_primary = false, updated_at = NOW()
  WHERE laundry_id = p_laundry_id AND is_primary = true;

  -- 2. Set target photo as primary
  UPDATE public.laundry_photos
  SET is_primary = true, updated_at = NOW()
  WHERE id = p_photo_id AND laundry_id = p_laundry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public VOLATILE;

-- Grant EXECUTE permission to authenticated users (authorization verified inside function)
GRANT EXECUTE ON FUNCTION public.set_primary_laundry_photo(UUID, UUID) TO authenticated;

-- 2. EXTEND ROW LEVEL SECURITY (RLS) POLICIES ON public.laundry_photos
-- Ensure RLS is enabled
ALTER TABLE public.laundry_photos ENABLE ROW LEVEL SECURITY;

-- Clean up existing mutation policies
DROP POLICY IF EXISTS "Admins can insert laundry photos" ON public.laundry_photos;
DROP POLICY IF EXISTS "Admins can update laundry photos" ON public.laundry_photos;
DROP POLICY IF EXISTS "Admins can delete laundry photos" ON public.laundry_photos;
DROP POLICY IF EXISTS "Admins and Owners can insert laundry photos" ON public.laundry_photos;
DROP POLICY IF EXISTS "Admins and Owners can update laundry photos" ON public.laundry_photos;
DROP POLICY IF EXISTS "Admins and Owners can delete laundry photos" ON public.laundry_photos;

-- Public / Customer Read Access (Preserved)
-- Note: "Laundry photos viewable by everyone" remains unchanged.

-- Insert Policy: Platform Admin OR Laundry Owner
CREATE POLICY "Admins and Owners can insert laundry photos"
  ON public.laundry_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin() OR public.is_laundry_owner(laundry_id)
  );

-- Update Policy: Platform Admin OR Laundry Owner
CREATE POLICY "Admins and Owners can update laundry photos"
  ON public.laundry_photos
  FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin() OR public.is_laundry_owner(laundry_id)
  )
  WITH CHECK (
    public.is_platform_admin() OR public.is_laundry_owner(laundry_id)
  );

-- Delete Policy: Platform Admin OR Laundry Owner
CREATE POLICY "Admins and Owners can delete laundry photos"
  ON public.laundry_photos
  FOR DELETE TO authenticated
  USING (
    public.is_platform_admin() OR public.is_laundry_owner(laundry_id)
  );
