-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 004_payment_attempts_and_state_machine.sql
-- Description: Payment Status Enum Expansion, Payment Attempts Table & Idempotency Rules
-- Author: Antigravity AI Architecture Team
-- Date: 2026-08-14
-- Status: IDEMPOTENT & PRODUCTION READY
-- =============================================================================

-- 1. EXPAND PAYMENT_STATUS ENUM SAFELY
DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'pending';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'failed';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'expired';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded';
EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- 2. CREATE PAYMENT_ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  provider TEXT NOT NULL DEFAULT 'mock',
  provider_reference TEXT UNIQUE,
  payment_method TEXT NOT NULL DEFAULT 'qris',
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  status payment_status NOT NULL DEFAULT 'pending',
  idempotency_key TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDEXES FOR PERFORMANCE & IDEMPOTENCY
CREATE INDEX IF NOT EXISTS idx_payment_attempts_order_id ON public.payment_attempts(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_customer_id ON public.payment_attempts(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON public.payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_provider_ref ON public.payment_attempts(provider_reference);

-- 4. AUTOMATIC UPDATED_AT TRIGGER FOR PAYMENT_ATTEMPTS
DROP TRIGGER IF EXISTS trigger_payment_attempts_updated_at ON public.payment_attempts;
CREATE TRIGGER trigger_payment_attempts_updated_at
BEFORE UPDATE ON public.payment_attempts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own payment attempts" ON public.payment_attempts;
CREATE POLICY "Customers can view own payment attempts" ON public.payment_attempts
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins full control on payment attempts" ON public.payment_attempts;
CREATE POLICY "Platform admins full control on payment attempts" ON public.payment_attempts
  FOR ALL TO authenticated
  USING (public.is_platform_admin());
