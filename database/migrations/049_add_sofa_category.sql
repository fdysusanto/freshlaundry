-- =============================================================================
-- CUCIYAN LAUNDRY MARKETPLACE
-- Migration: 049_add_sofa_category.sql
-- Description: Update category CHECK constraints to include 'Sofa'
-- Author: Antigravity AI Architecture Team
-- Date: 2026-09-19
-- Status: IDEMPOTENT & TRANSACTIONAL
-- =============================================================================

BEGIN;

-- 1. Update CHECK constraint on public.services to include 'Sofa'
DO $$
BEGIN
  -- Drop existing constraint if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_services_category'
  ) THEN
    ALTER TABLE public.services DROP CONSTRAINT chk_services_category;
  END IF;

  -- Add updated constraint including 'Sofa'
  ALTER TABLE public.services ADD CONSTRAINT chk_services_category 
    CHECK (category IS NULL OR category IN ('Pakaian', 'Sepatu & Sandal', 'Tas', 'Karpet', 'Sofa'));
END $$;

-- 2. Update CHECK constraint on public.partner_application_services to include 'Sofa'
DO $$
BEGIN
  -- Drop existing constraint if present
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_partner_app_services_category'
  ) THEN
    ALTER TABLE public.partner_application_services DROP CONSTRAINT chk_partner_app_services_category;
  END IF;

  -- Add updated constraint including 'Sofa'
  ALTER TABLE public.partner_application_services ADD CONSTRAINT chk_partner_app_services_category 
    CHECK (category IS NULL OR category IN ('Pakaian', 'Sepatu & Sandal', 'Tas', 'Karpet', 'Sofa'));
END $$;

COMMIT;
