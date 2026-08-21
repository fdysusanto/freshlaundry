-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 016_laundry_photos_table_and_rls.sql
-- Description: Tabel laundry_photos dan Kebijakan RLS (Platform Admin Mutation Only)
-- Author: Antigravity AI Architecture Team
-- Date: 2026-08-21
-- Status: HARDENED & AUDITED (Idempotent & Production Ready)
-- =============================================================================

-- 1. CREATING TABLE LAUNDRY_PHOTOS
CREATE TABLE IF NOT EXISTS public.laundry_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laundry_id UUID NOT NULL REFERENCES public.laundries(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INDEXES UNTUK PERFORMA
CREATE INDEX IF NOT EXISTS idx_laundry_photos_laundry_id ON public.laundry_photos(laundry_id);
CREATE INDEX IF NOT EXISTS idx_laundry_photos_laundry_sort ON public.laundry_photos(laundry_id, sort_order);

-- 3. AUTOMATIC UPDATED_AT TRIGGER
DROP TRIGGER IF EXISTS trigger_laundry_photos_updated_at ON public.laundry_photos;
CREATE TRIGGER trigger_laundry_photos_updated_at
BEFORE UPDATE ON public.laundry_photos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.laundry_photos ENABLE ROW LEVEL SECURITY;

-- Cleanup existing policies for full idempotency
DROP POLICY IF EXISTS "Laundry photos viewable by everyone" ON public.laundry_photos;
DROP POLICY IF EXISTS "Admins can insert laundry photos" ON public.laundry_photos;
DROP POLICY IF EXISTS "Admins can update laundry photos" ON public.laundry_photos;
DROP POLICY IF EXISTS "Admins can delete laundry photos" ON public.laundry_photos;

-- Public & Customer Read Access
CREATE POLICY "Laundry photos viewable by everyone"
  ON public.laundry_photos
  FOR SELECT TO anon, authenticated
  USING (true);

-- Platform Admin Insert Access ONLY
CREATE POLICY "Admins can insert laundry photos"
  ON public.laundry_photos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

-- Platform Admin Update Access ONLY
CREATE POLICY "Admins can update laundry photos"
  ON public.laundry_photos
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Platform Admin Delete Access ONLY
CREATE POLICY "Admins can delete laundry photos"
  ON public.laundry_photos
  FOR DELETE TO authenticated
  USING (public.is_platform_admin());
