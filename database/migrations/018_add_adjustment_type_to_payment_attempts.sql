-- =============================================================================
-- FRESHLAUNDRY MARKETPLACE
-- Migration: 018_add_adjustment_type_to_payment_attempts.sql
-- Description: Add adjustment_type column & index to public.payment_attempts table
-- Author: Antigravity AI Architecture Team
-- Status: IDEMPOTENT, NON-DESTRUCTIVE & PRODUCTION READY
-- =============================================================================

-- 1. ADD ADJUSTMENT_TYPE COLUMN SAFELY
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'payment_attempts' 
      AND column_name = 'adjustment_type'
  ) THEN
    ALTER TABLE public.payment_attempts 
    ADD COLUMN adjustment_type VARCHAR(50) DEFAULT NULL;
  END IF;
END $$;

-- 2. CREATE INDEX FOR PERFORMANCE & FILTERING
CREATE INDEX IF NOT EXISTS idx_payment_attempts_adjustment_type 
ON public.payment_attempts(adjustment_type) 
WHERE adjustment_type IS NOT NULL;

-- 3. COMMENT FOR DOCUMENTATION
COMMENT ON COLUMN public.payment_attempts.adjustment_type IS 'Classification of payment attempt: NULL for initial payment, weight_increase for overweight adjustment';
