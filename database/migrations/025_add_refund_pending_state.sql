-- Migration: 025_add_refund_pending_state.sql
-- Description: Adds 'refund_pending' to payment_status ENUM to support safe auto-cancellation and idempotency.

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refund_pending';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
