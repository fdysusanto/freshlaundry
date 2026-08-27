-- Migration 020: Add Delivery Scheduling (delivery_time_slot and indexing)
-- Purpose: Support customer delivery scheduling and operational grouping in FreshLaundry

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_time_slot TEXT;

-- Create index for operational grouping & dispatch query by delivery schedule
CREATE INDEX IF NOT EXISTS idx_orders_delivery_schedule 
ON public.orders (delivery_date, delivery_time_slot, status) 
WHERE delivery_date IS NOT NULL;
