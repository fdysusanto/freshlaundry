-- Migration: 028_create_refunds_table.sql
-- Description: Creates the refunds table to support manual platform refund audit trailing.

CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_attempt_id UUID NOT NULL UNIQUE REFERENCES public.payment_attempts(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  destination_bank TEXT,
  destination_account TEXT,
  destination_name TEXT,
  processed_by UUID REFERENCES public.profiles(id),
  processed_at TIMESTAMPTZ,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_attempt_id ON public.refunds(payment_attempt_id);

-- Updated_at trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_refunds') THEN
        CREATE TRIGGER set_updated_at_refunds
        BEFORE UPDATE ON public.refunds
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END
$$;

-- RLS Setup
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- 1. Platform Admin: FULL ACCESS
CREATE POLICY "Platform Admin has full access to refunds" ON public.refunds
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
);

-- 2. Customer: SELECT ONLY for their own orders
CREATE POLICY "Customers can view their own refunds" ON public.refunds
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = refunds.order_id AND orders.customer_id = auth.uid())
);

-- 3. Laundry Owner: SELECT ONLY for their laundry's orders
CREATE POLICY "Laundry partners can view their laundry refunds" ON public.refunds
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.laundry_users lu ON o.laundry_id = lu.laundry_id
    WHERE o.id = refunds.order_id AND lu.profile_id = auth.uid()
  )
);
