-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 052_partner_security_hardening.sql
-- Description: Independent Deep Security Audit Fixes & Hardening for
--              Platform Ops Admin Partner Management:
--              1. Create public.partner_invitations table with single-use token checks.
--              2. RPC invite_partner_owner_atomic & claim_partner_listing_atomic.
--              3. Strictly complete lifecycle state transition matrix in update_partner_status_atomic.
--              4. Guard create_order_with_items_atomic against inactive/suspended/unclaimed laundries.
--              5. Harden public.audit_logs RLS against actor_user_id spoofing.
-- Author: Antigravity AI Architecture Team
-- Status: IDEMPOTENT & PRODUCTION HARDENED
-- =============================================================================

BEGIN;

-- 1. Create Partner Invitations Table
CREATE TABLE IF NOT EXISTS public.partner_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laundry_id UUID NOT NULL REFERENCES public.laundries(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_invitations_token ON public.partner_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_partner_invitations_laundry ON public.partner_invitations(laundry_id);

ALTER TABLE public.partner_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins full control on invitations" ON public.partner_invitations;
CREATE POLICY "Platform admins full control on invitations" ON public.partner_invitations
  FOR ALL TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Authenticated users view active invitations" ON public.partner_invitations;
CREATE POLICY "Authenticated users view active invitations" ON public.partner_invitations
  FOR SELECT TO authenticated
  USING (is_used = false AND expires_at > NOW());


-- 2. Harden public.audit_logs RLS Policy against Actor Identity Spoofing
DROP POLICY IF EXISTS "Platform admins can insert audit logs" ON public.audit_logs;
CREATE POLICY "Platform admins can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin()
    AND (actor_user_id IS NULL OR actor_user_id = auth.uid())
  );


-- 3. Update update_partner_status_atomic RPC with Complete State Transition Matrix
CREATE OR REPLACE FUNCTION public.update_partner_status_atomic(
  p_laundry_id UUID,
  p_target_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_role user_role;
  v_old RECORD;
  v_trimmed_reason TEXT;
  v_is_active BOOLEAN;
  v_suspended_at TIMESTAMPTZ := NULL;
  v_suspension_reason TEXT := NULL;
  v_valid_transition BOOLEAN := FALSE;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terautentikasi.';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role IS NULL OR v_admin_role != 'platform_admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya platform_admin yang dapat memperbarui status partner.';
  END IF;

  SELECT * INTO v_old FROM public.laundries WHERE id = p_laundry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner laundry tidak ditemukan.';
  END IF;

  IF v_old.status = p_target_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'status', p_target_status,
      'message', 'Status partner sudah ' || p_target_status
    );
  END IF;

  -- Strictly Complete Lifecycle State Transition Matrix Validation:
  -- unclaimed -> listed, claimed
  -- listed    -> unclaimed, claimed
  -- claimed   -> onboarding, active
  -- onboarding-> active, inactive, rejected
  -- active    -> suspended, inactive
  -- suspended -> active, inactive
  -- inactive  -> active, onboarding
  CASE v_old.status
    WHEN 'unclaimed' THEN
      v_valid_transition := p_target_status IN ('listed', 'claimed');
    WHEN 'listed' THEN
      v_valid_transition := p_target_status IN ('unclaimed', 'claimed');
    WHEN 'claimed' THEN
      v_valid_transition := p_target_status IN ('onboarding', 'active');
    WHEN 'onboarding' THEN
      v_valid_transition := p_target_status IN ('active', 'inactive');
    WHEN 'active' THEN
      v_valid_transition := p_target_status IN ('suspended', 'inactive');
    WHEN 'suspended' THEN
      v_valid_transition := p_target_status IN ('active', 'inactive');
    WHEN 'inactive' THEN
      v_valid_transition := p_target_status IN ('active', 'onboarding');
    ELSE
      v_valid_transition := FALSE;
  END CASE;

  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'Transisi status tidak valid: Partner dengan status "%" tidak dapat bertransisi ke "%".', v_old.status, p_target_status;
  END IF;

  IF p_target_status = 'suspended' THEN
    v_trimmed_reason := TRIM(COALESCE(p_reason, ''));
    IF LENGTH(v_trimmed_reason) < 5 THEN
      RAISE EXCEPTION 'Alasan penghentian sementara (suspend) wajib diisi minimal 5 karakter.';
    END IF;
    v_suspended_at := NOW();
    v_suspension_reason := v_trimmed_reason;
  END IF;

  v_is_active := (p_target_status = 'active');

  UPDATE public.laundries
  SET status = p_target_status,
      is_active = v_is_active,
      suspended_at = v_suspended_at,
      suspension_reason = v_suspension_reason,
      updated_by = v_admin_id,
      updated_at = NOW()
  WHERE id = p_laundry_id;

  INSERT INTO public.audit_logs (
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    reason,
    metadata
  ) VALUES (
    v_admin_id,
    'platform_admin',
    'PARTNER_STATUS_UPDATE',
    'partner',
    p_laundry_id,
    jsonb_build_object('status', v_old.status, 'is_active', v_old.is_active),
    jsonb_build_object('status', p_target_status, 'is_active', v_is_active),
    p_reason,
    jsonb_build_object('previous_status', v_old.status, 'new_status', p_target_status)
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'previous_status', v_old.status,
    'new_status', p_target_status,
    'message', 'Status partner berhasil diperbarui menjadi ' || p_target_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_partner_status_atomic TO authenticated, service_role;


-- 4. RPC Function: invite_partner_owner_atomic
CREATE OR REPLACE FUNCTION public.invite_partner_owner_atomic(
  p_laundry_id UUID,
  p_owner_email TEXT,
  p_expires_in_hours INT DEFAULT 48
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_role user_role;
  v_laundry RECORD;
  v_invite_token TEXT;
  v_expires_at TIMESTAMPTZ;
  v_invitation_id UUID;
  v_trimmed_email TEXT;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terautentikasi.';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role IS NULL OR v_admin_role != 'platform_admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya platform_admin yang dapat mengundang pemilik partner.';
  END IF;

  v_trimmed_email := LOWER(TRIM(p_owner_email));
  IF v_trimmed_email IS NULL OR v_trimmed_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Alamat email pemilik tidak valid.';
  END IF;

  SELECT * INTO v_laundry FROM public.laundries WHERE id = p_laundry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner laundry tidak ditemukan.';
  END IF;

  v_expires_at := NOW() + (COALESCE(p_expires_in_hours, 48) || ' hours')::INTERVAL;

  LOOP
    v_invite_token := 'inv_' || REPLACE(gen_random_uuid()::TEXT, '-', '');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.partner_invitations WHERE invite_token = v_invite_token);
  END LOOP;

  INSERT INTO public.partner_invitations (
    laundry_id,
    owner_email,
    invite_token,
    invited_by,
    expires_at
  ) VALUES (
    p_laundry_id,
    v_trimmed_email,
    v_invite_token,
    v_admin_id,
    v_expires_at
  )
  RETURNING id INTO v_invitation_id;

  INSERT INTO public.audit_logs (
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    reason,
    metadata
  ) VALUES (
    v_admin_id,
    'platform_admin',
    'PARTNER_INVITE_OWNER',
    'partner',
    p_laundry_id,
    NULL,
    jsonb_build_object('invitation_id', v_invitation_id, 'owner_email', v_trimmed_email, 'expires_at', v_expires_at),
    'Undangan klaim pemilik dibuat oleh Platform Ops Admin',
    jsonb_build_object('invitation_id', v_invitation_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'laundry_id', p_laundry_id,
    'owner_email', v_trimmed_email,
    'invite_token', v_invite_token,
    'expires_at', v_expires_at,
    'message', 'Undangan pemilik partner berhasil dibuat.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_partner_owner_atomic TO authenticated, service_role;


-- 5. RPC Function: claim_partner_listing_atomic
CREATE OR REPLACE FUNCTION public.claim_partner_listing_atomic(
  p_invite_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_invitation RECORD;
  v_laundry RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terautentikasi.';
  END IF;

  IF p_invite_token IS NULL OR TRIM(p_invite_token) = '' THEN
    RAISE EXCEPTION 'Token klaim bisnis wajib diisi.';
  END IF;

  SELECT * INTO v_invitation
  FROM public.partner_invitations
  WHERE invite_token = TRIM(p_invite_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token undangan klaim tidak ditemukan atau tidak valid.';
  END IF;

  IF v_invitation.is_used THEN
    RAISE EXCEPTION 'Token undangan klaim ini sudah pernah digunakan sebelumnya.';
  END IF;

  IF v_invitation.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Token undangan klaim telah kadaluwarsa.';
  END IF;

  SELECT * INTO v_laundry
  FROM public.laundries
  WHERE id = v_invitation.laundry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner laundry terkait tidak ditemukan.';
  END IF;

  IF v_laundry.owner_id IS NOT NULL AND v_laundry.owner_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'Partner laundry ini sudah diklaim oleh pemilik lain.';
  END IF;

  -- 1. Mark invitation as used
  UPDATE public.partner_invitations
  SET is_used = true,
      used_at = NOW(),
      used_by = v_caller_id
  WHERE id = v_invitation.id;

  -- 2. Update laundry ownership & status
  UPDATE public.laundries
  SET owner_id = v_caller_id,
      status = 'claimed',
      claim_status = 'claimed',
      onboarding_status = 'in_progress',
      updated_at = NOW()
  WHERE id = v_laundry.id;

  -- 3. Upgrade user role in profiles if customer
  UPDATE public.profiles
  SET role = 'laundry_owner'
  WHERE id = v_caller_id AND role = 'customer';

  -- 4. Insert laundry_users membership
  INSERT INTO public.laundry_users (
    laundry_id,
    profile_id,
    role,
    is_active
  ) VALUES (
    v_laundry.id,
    v_caller_id,
    'owner',
    true
  )
  ON CONFLICT (laundry_id, profile_id) DO UPDATE SET is_active = true;

  -- 5. Audit Log Entry
  INSERT INTO public.audit_logs (
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    reason,
    metadata
  ) VALUES (
    v_caller_id,
    'laundry_owner',
    'PARTNER_CLAIM',
    'partner',
    v_laundry.id,
    jsonb_build_object('status', v_laundry.status, 'owner_id', v_laundry.owner_id),
    jsonb_build_object('status', 'claimed', 'owner_id', v_caller_id),
    'Partner berhasil diklaim oleh pemilik menggunakan token undangan resmi',
    jsonb_build_object('invitation_id', v_invitation.id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'laundry_id', v_laundry.id,
    'laundry_name', v_laundry.name,
    'status', 'claimed',
    'message', 'Partner laundry berhasil diklaim!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_partner_listing_atomic TO authenticated, service_role;


-- 6. Guard create_order_with_items_atomic Against Inactive/Suspended/Unclaimed Laundries
CREATE OR REPLACE FUNCTION public.create_order_with_items_atomic(
  p_tracking_number TEXT,
  p_customer_id UUID,
  p_laundry_id UUID,
  p_service_type service_type,
  p_estimated_weight_kg NUMERIC,
  p_pickup_address TEXT,
  p_delivery_address TEXT,
  p_pickup_date DATE,
  p_pickup_time_slot TEXT,
  p_notes TEXT,
  p_subtotal NUMERIC,
  p_delivery_fee NUMERIC,
  p_platform_fee NUMERIC,
  p_discount NUMERIC,
  p_total_price NUMERIC,
  p_idempotency_key TEXT,
  p_items_json JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role user_role;
  v_existing_order_id UUID;
  v_order_id UUID;
  v_result JSONB;
  v_item JSONB;
  v_laundry_active BOOLEAN;
  v_laundry_status TEXT;
BEGIN
  -- A. Authenticated caller check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Akses Ditolak: Pengguna tidak terautentikasi.';
  END IF;

  -- B. Customer Identity ownership check
  IF v_caller_id IS DISTINCT FROM p_customer_id THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya dapat membuat order atas nama akun sendiri.';
  END IF;

  -- C. Role authorization check
  v_caller_role := public.get_my_role();
  IF v_caller_role IS NULL OR v_caller_role != 'customer'::user_role THEN
    RAISE EXCEPTION 'Akses Ditolak: Hanya akun dengan peran Customer yang dapat membuat pesanan.';
  END IF;

  -- D. Partner Active & Status Check
  SELECT is_active, status INTO v_laundry_active, v_laundry_status
  FROM public.laundries
  WHERE id = p_laundry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Laundry partner tidak ditemukan.';
  END IF;

  IF NOT COALESCE(v_laundry_active, false) OR COALESCE(v_laundry_status, '') != 'active' THEN
    RAISE EXCEPTION 'Akses Ditolak: Toko laundry ini sedang tidak aktif atau belum siap menerima pesanan (Status: %).', COALESCE(v_laundry_status, 'unknown');
  END IF;

  -- Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_order_id
    FROM public.orders
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_order_id IS NOT NULL THEN
      SELECT jsonb_build_object(
        'is_duplicate', true,
        'order_id', o.id,
        'tracking_number', o.tracking_number,
        'status', o.status,
        'payment_status', o.payment_status,
        'total_price', o.total_price,
        'created_at', o.created_at
      ) INTO v_result
      FROM public.orders o
      WHERE o.id = v_existing_order_id;

      RETURN v_result;
    END IF;
  END IF;

  -- Insert Order
  INSERT INTO public.orders (
    tracking_number,
    customer_id,
    laundry_id,
    service_type,
    status,
    estimated_weight_kg,
    pickup_address,
    delivery_address,
    pickup_date,
    pickup_time_slot,
    notes,
    subtotal,
    delivery_fee,
    platform_fee,
    discount,
    total_price,
    payment_status,
    idempotency_key
  ) VALUES (
    p_tracking_number,
    p_customer_id,
    p_laundry_id,
    p_service_type,
    'pending'::order_status,
    p_estimated_weight_kg,
    p_pickup_address,
    p_delivery_address,
    p_pickup_date,
    p_pickup_time_slot,
    p_notes,
    p_subtotal,
    p_delivery_fee,
    p_platform_fee,
    p_discount,
    p_total_price,
    'unpaid'::payment_status,
    p_idempotency_key
  )
  RETURNING id INTO v_order_id;

  -- Insert Order Items
  IF p_items_json IS NOT NULL AND jsonb_array_length(p_items_json) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items_json)
    LOOP
      INSERT INTO public.order_items (
        order_id,
        service_id,
        service_name_snapshot,
        price_snapshot,
        estimated_weight,
        quantity,
        subtotal
      ) VALUES (
        v_order_id,
        (v_item->>'service_id')::UUID,
        v_item->>'service_name',
        (v_item->>'price')::NUMERIC,
        (v_item->>'estimated_weight')::NUMERIC,
        COALESCE((v_item->>'quantity')::NUMERIC, 1),
        (v_item->>'subtotal')::NUMERIC
      );
    END LOOP;
  END IF;

  -- Initial Audit Log
  INSERT INTO public.order_status_logs (
    order_id,
    status,
    notes,
    updated_by
  ) VALUES (
    v_order_id,
    'pending'::order_status,
    'Pesanan baru berhasil dibuat oleh pelanggan',
    v_caller_id
  );

  RETURN jsonb_build_object(
    'is_duplicate', false,
    'order_id', v_order_id,
    'tracking_number', p_tracking_number,
    'status', 'pending',
    'payment_status', 'unpaid',
    'total_price', p_total_price
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_with_items_atomic TO authenticated, service_role;

COMMIT;
