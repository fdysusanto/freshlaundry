-- Migration 022: Fix Courier Active Order Constraint for Two-Leg Dispatch Model
-- Purpose: Refine unique index uq_courier_single_active_order to only lock couriers 
-- during active physical transport states ('assigned', 'picked_up', 'out_for_delivery'), 
-- freeing couriers during 'in_washing' and 'ready_for_delivery'.

BEGIN;

-- 1. Drop outdated unique index from Migration 013
DROP INDEX IF EXISTS public.uq_courier_single_active_order;

-- 2. Re-create unique index with refined active transport predicate
CREATE UNIQUE INDEX uq_courier_single_active_order
ON public.orders (courier_id)
WHERE status IN ('assigned', 'picked_up', 'out_for_delivery');

COMMIT;
