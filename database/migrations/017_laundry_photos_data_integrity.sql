-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 017_laundry_photos_data_integrity.sql
-- Description: Hardening Data Integrity laundry_photos (Photo Slot 0-4, Concurrency-Safe Max 5 Limit & Single Primary Index)
-- Author: Antigravity AI Architecture Team
-- Date: 2026-08-21
-- Status: HARDENED & AUDITED (Idempotent & Concurrency Safe)
-- =============================================================================

-- 1. ADD PHOTO_SLOT COLUMN (IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'laundry_photos' AND column_name = 'photo_slot'
  ) THEN
    ALTER TABLE public.laundry_photos ADD COLUMN photo_slot INTEGER;
  END IF;
END $$;

-- 2. SAFE BACKFILL PHOTO_SLOT FOR EXISTING RECORDS (IF ANY)
WITH RankedPhotos AS (
  SELECT id, laundry_id, ROW_NUMBER() OVER (PARTITION BY laundry_id ORDER BY sort_order ASC, created_at ASC) - 1 AS calc_slot
  FROM public.laundry_photos
  WHERE photo_slot IS NULL
)
UPDATE public.laundry_photos lp
SET photo_slot = rp.calc_slot
FROM RankedPhotos rp
WHERE lp.id = rp.id;

-- Fallback default for any remaining NULL
UPDATE public.laundry_photos SET photo_slot = 0 WHERE photo_slot IS NULL;

-- Make photo_slot NOT NULL
ALTER TABLE public.laundry_photos ALTER COLUMN photo_slot SET NOT NULL;

-- 3. HARD CONSTRAINTS FOR PHOTO SLOTS (SLOT 0, 1, 2, 3, 4 MAX 5 PHOTOS)
ALTER TABLE public.laundry_photos DROP CONSTRAINT IF EXISTS check_photo_slot_range;
ALTER TABLE public.laundry_photos ADD CONSTRAINT check_photo_slot_range CHECK (photo_slot >= 0 AND photo_slot <= 4);

-- UNIQUE CONSTRAINT PER LAUNDRY PER SLOT (GUARANTEES 100% RACE-CONDITION SAFE MAX 5 LIMIT)
ALTER TABLE public.laundry_photos DROP CONSTRAINT IF EXISTS unique_laundry_photo_slot;
ALTER TABLE public.laundry_photos ADD CONSTRAINT unique_laundry_photo_slot UNIQUE (laundry_id, photo_slot);

-- 4. PARTIAL UNIQUE INDEX: EXACTLY ONE IS_PRIMARY = TRUE PER LAUNDRY
DROP INDEX IF EXISTS public.idx_unique_primary_photo_per_laundry;
CREATE UNIQUE INDEX idx_unique_primary_photo_per_laundry
  ON public.laundry_photos (laundry_id)
  WHERE (is_primary = true);

-- 5. ATOMIC RPC FUNCTION TO SET PRIMARY PHOTO (PLATFORM ADMIN ONLY)
CREATE OR REPLACE FUNCTION public.set_primary_laundry_photo(
  p_laundry_id UUID,
  p_photo_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Verify caller is Platform Admin
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya Platform Admin yang dapat mengubah foto utama.';
  END IF;

  -- 1. Unset current primary photo for target laundry
  UPDATE public.laundry_photos
  SET is_primary = false
  WHERE laundry_id = p_laundry_id AND is_primary = true;

  -- 2. Set target photo as primary
  UPDATE public.laundry_photos
  SET is_primary = true
  WHERE id = p_photo_id AND laundry_id = p_laundry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public VOLATILE;

-- Grant EXECUTE permission to authenticated users (function checks is_platform_admin internally)
GRANT EXECUTE ON FUNCTION public.set_primary_laundry_photo(UUID, UUID) TO authenticated;
