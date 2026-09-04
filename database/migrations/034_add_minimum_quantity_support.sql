-- Migration 034: Ensure min_weight column in public.services table for dynamic minimum charge
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS min_weight NUMERIC(6, 2) DEFAULT 1;

-- Backfill NULL min_weight values to 1 for 100% backward compatibility
UPDATE public.services SET min_weight = 1 WHERE min_weight IS NULL OR min_weight <= 0;
