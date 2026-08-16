-- =============================================================================
-- FRESHLAUNDRY
-- Migration: 011_payment_webhook_events.sql
-- Purpose: Payment Webhook Audit Log & Idempotency
-- Scope: Database only
-- Status: Non-destructive / Idempotent
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'xendit',
  event_type TEXT NOT NULL,
  payment_attempt_id UUID REFERENCES public.payment_attempts(id) ON DELETE SET NULL,
  provider_reference TEXT NOT NULL,
  amount NUMERIC(12, 2),
  status TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & audit querying
-- (Note: event_id is automatically indexed by the UNIQUE constraint above)
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_ref ON public.payment_webhook_events(provider_reference);
CREATE INDEX IF NOT EXISTS idx_webhook_events_payment_attempt_id ON public.payment_webhook_events(payment_attempt_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.payment_webhook_events(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- Note on Security & Policies:
-- No policies are granted to 'anon' or 'authenticated' roles.
-- Public and customer access is 100% BLOCKED for SELECT, INSERT, UPDATE, and DELETE.
-- Server-side out-of-band webhook processing executes using 'service_role' (which bypasses RLS).
