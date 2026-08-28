-- Migration: 029_manual_refund_confirmation_rpc.sql
-- Description: RPC to safely and atomically confirm a manual refund transition.

CREATE OR REPLACE FUNCTION public.confirm_manual_refund_atomic(
  p_order_id UUID,
  p_payment_attempt_id UUID,
  p_amount NUMERIC,
  p_destination_bank TEXT,
  p_destination_account TEXT,
  p_destination_name TEXT,
  p_reference TEXT,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment_attempt public.payment_attempts%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_admin_id UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_refund_id UUID;
BEGIN
  -- 1. Validate Platform Admin Role (Server-side)
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Anda belum login.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_admin_id AND role = 'platform_admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Platform Admin yang dapat mengonfirmasi pengembalian dana manual.';
  END IF;

  IF p_reference IS NULL OR trim(p_reference) = '' THEN
    RAISE EXCEPTION 'Nomor referensi bukti transfer wajib diisi.';
  END IF;

  -- Set transaction-local bypass for standard payment triggers
  PERFORM set_config('app.payment_processing', 'true', true);

  -- 2. Lock & Fetch Payment Attempt (FOR UPDATE)
  SELECT * INTO v_payment_attempt
  FROM public.payment_attempts
  WHERE id = p_payment_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data pembayaran tidak ditemukan.';
  END IF;

  -- 3. Lock & Fetch Associated Order (FOR UPDATE)
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Data pesanan terkait tidak ditemukan.';
  END IF;

  -- Ensure they match
  IF v_payment_attempt.order_id != v_order.id THEN
    RAISE EXCEPTION 'Mismatch antara payment attempt dan order.';
  END IF;

  -- 4. State Validation
  IF v_payment_attempt.status = 'refunded' OR v_order.payment_status = 'refunded' THEN
    RAISE EXCEPTION 'Pengembalian dana untuk pesanan ini sudah berstatus completed/refunded.';
  END IF;

  IF v_payment_attempt.status != 'refund_pending' OR v_order.payment_status != 'refund_pending' THEN
    RAISE EXCEPTION 'Pesanan tidak dalam status menunggu pengembalian dana (refund_pending).';
  END IF;

  -- 5. Amount Validation (Full Refund Only MVP)
  IF p_amount != v_payment_attempt.amount THEN
    RAISE EXCEPTION 'Nominal refund (Rp %) tidak sesuai dengan nominal pembayaran aktual (Rp %).', p_amount, v_payment_attempt.amount;
  END IF;

  -- 6. Insert / Update Refunds Audit Trail
  INSERT INTO public.refunds (
    order_id,
    payment_attempt_id,
    amount,
    status,
    destination_bank,
    destination_account,
    destination_name,
    processed_by,
    processed_at,
    reference,
    notes
  ) VALUES (
    v_order.id,
    v_payment_attempt.id,
    p_amount,
    'completed',
    p_destination_bank,
    p_destination_account,
    p_destination_name,
    v_admin_id,
    v_now,
    p_reference,
    p_notes
  ) RETURNING id INTO v_refund_id;

  -- 7. Atomic Transition
  UPDATE public.payment_attempts
  SET status = 'refunded',
      updated_at = v_now
  WHERE id = v_payment_attempt.id;

  UPDATE public.orders
  SET payment_status = 'refunded',
      updated_at = v_now
  WHERE id = v_order.id;

  -- 8. Audit Log
  INSERT INTO public.order_status_logs (
    order_id,
    status,
    notes,
    updated_by
  ) VALUES (
    v_order.id,
    v_order.status,
    'Pengembalian dana telah berhasil diproses secara manual oleh Platform Admin. (Ref: ' || p_reference || ')',
    v_admin_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'refund_id', v_refund_id,
    'order_id', v_order.id,
    'status', 'refunded'
  );
END;
$$;
