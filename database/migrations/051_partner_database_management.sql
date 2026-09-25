-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 051_partner_database_management.sql
-- Description: Platform Ops Admin - Partner Database Management, Lifecycle Statuses,
--              Owner-less Partner Listings, Immutable Audit Logs, and RPC Security.
-- Author: Antigravity AI Architecture Team
-- Status: IDEMPOTENT & PRODUCTION HARDENED
-- =============================================================================

BEGIN;

-- 1. Schema Extensions on public.laundries
-- Make owner_id nullable to support UNCLAIMED / LISTED listings before owner onboarding
ALTER TABLE public.laundries ALTER COLUMN owner_id DROP NOT NULL;

ALTER TABLE public.laundries
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'listed',
ADD COLUMN IF NOT EXISTS claim_status VARCHAR(20) DEFAULT 'unclaimed',
ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(20) DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS legal_name TEXT,
ADD COLUMN IF NOT EXISTS business_email TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- 2. Constraints for Status Validation
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_laundries_status') THEN
    ALTER TABLE public.laundries
    ADD CONSTRAINT chk_laundries_status
    CHECK (status IN ('unclaimed', 'listed', 'claimed', 'onboarding', 'active', 'suspended', 'inactive'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_laundries_claim_status') THEN
    ALTER TABLE public.laundries
    ADD CONSTRAINT chk_laundries_claim_status
    CHECK (claim_status IN ('unclaimed', 'claimed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_laundries_onboarding_status') THEN
    ALTER TABLE public.laundries
    ADD CONSTRAINT chk_laundries_onboarding_status
    CHECK (onboarding_status IN ('not_started', 'in_progress', 'completed', 'rejected'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_laundries_latitude') THEN
    ALTER TABLE public.laundries
    ADD CONSTRAINT chk_laundries_latitude
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_laundries_longitude') THEN
    ALTER TABLE public.laundries
    ADD CONSTRAINT chk_laundries_longitude
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;
END $$;

-- 3. Deterministic Backfill for Legacy Laundry Records
UPDATE public.laundries
SET status = 'active',
    claim_status = 'claimed',
    onboarding_status = 'completed'
WHERE is_active = true
  AND verification_status = 'verified'
  AND owner_id IS NOT NULL
  AND (status IS NULL OR status = 'listed');

UPDATE public.laundries
SET status = 'onboarding',
    claim_status = 'claimed',
    onboarding_status = 'in_progress'
WHERE verification_status = 'pending'
  AND owner_id IS NOT NULL
  AND (status IS NULL OR status = 'listed');

UPDATE public.laundries
SET status = 'inactive',
    claim_status = 'claimed'
WHERE is_active = false
  AND owner_id IS NOT NULL
  AND (status IS NULL OR status = 'listed');

-- 4. Create Immutable Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  before_value JSONB,
  after_value JSONB,
  reason TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Platform admins can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can insert audit logs" ON public.audit_logs;
CREATE POLICY "Platform admins can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

-- Notice: NO UPDATE or DELETE policies are granted on public.audit_logs to enforce strict immutability.

-- 5. RPC Function: create_partner_listing_atomic
DROP FUNCTION IF EXISTS public.create_partner_listing_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_partner_listing_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_partner_listing_atomic;

CREATE OR REPLACE FUNCTION public.create_partner_listing_atomic(
  p_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_city_name TEXT DEFAULT NULL,
  p_district_name TEXT DEFAULT NULL,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_legal_name TEXT DEFAULT NULL,
  p_business_email TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_role user_role;
  v_laundry_code TEXT;
  v_new_laundry_id UUID;
  v_new_record JSONB;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terautentikasi.';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role IS NULL OR v_admin_role != 'platform_admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya platform_admin yang dapat membuat listing mitra.';
  END IF;

  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Nama bisnis laundry wajib diisi.';
  END IF;

  IF p_latitude IS NOT NULL AND (p_latitude < -90 OR p_latitude > 90) THEN
    RAISE EXCEPTION 'Validasi Gagal: Latitude harus berada dalam rentang -90 hingga 90.';
  END IF;

  IF p_longitude IS NOT NULL AND (p_longitude < -180 OR p_longitude > 180) THEN
    RAISE EXCEPTION 'Validasi Gagal: Longitude harus berada dalam rentang -180 hingga 180.';
  END IF;

  LOOP
    v_laundry_code := 'LND-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.laundries WHERE code = v_laundry_code);
  END LOOP;

  INSERT INTO public.laundries (
    code,
    name,
    owner_id,
    phone,
    address,
    city_name,
    district_name,
    latitude,
    longitude,
    legal_name,
    business_email,
    status,
    claim_status,
    onboarding_status,
    is_open,
    is_active,
    verification_status,
    created_by,
    updated_by
  ) VALUES (
    v_laundry_code,
    TRIM(p_name),
    NULL,
    COALESCE(p_phone, '-'),
    COALESCE(p_address, '-'),
    p_city_name,
    p_district_name,
    p_latitude,
    p_longitude,
    p_legal_name,
    p_business_email,
    'listed',
    'unclaimed',
    'not_started',
    false,
    false,
    'pending',
    v_admin_id,
    v_admin_id
  )
  RETURNING id INTO v_new_laundry_id;

  SELECT to_jsonb(l.*) INTO v_new_record FROM public.laundries l WHERE l.id = v_new_laundry_id;

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
    'PARTNER_CREATE',
    'partner',
    v_new_laundry_id,
    NULL,
    v_new_record,
    COALESCE(p_notes, 'Pembuatan listing mitra baru oleh Platform Ops Admin'),
    jsonb_build_object('code', v_laundry_code, 'name', p_name)
  );

  RETURN jsonb_build_object(
    'success', true,
    'laundry_id', v_new_laundry_id,
    'code', v_laundry_code,
    'status', 'listed',
    'claim_status', 'unclaimed',
    'message', 'Listing partner berhasil dibuat dalam status LISTED / UNCLAIMED.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_partner_listing_atomic TO authenticated, service_role;

-- 6. RPC Function: update_partner_status_atomic
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

  -- Validate Lifecycle Transition Matrix:
  -- UNCLAIMED -> LISTED
  -- LISTED -> CLAIMED
  -- CLAIMED -> ONBOARDING
  -- ONBOARDING -> ACTIVE
  -- ACTIVE -> SUSPENDED, INACTIVE
  -- SUSPENDED -> ACTIVE, INACTIVE
  -- INACTIVE -> ACTIVE
  IF v_old.status = 'unclaimed' AND p_target_status NOT IN ('listed', 'claimed') THEN
    RAISE EXCEPTION 'Transisi status tidak valid: Partner UNCLAIMED hanya dapat bertransisi ke LISTED atau CLAIMED.';
  ELSIF v_old.status = 'listed' AND p_target_status NOT IN ('unclaimed', 'claimed') THEN
    RAISE EXCEPTION 'Transisi status tidak valid: Partner LISTED hanya dapat bertransisi ke CLAIMED atau UNCLAIMED.';
  ELSIF v_old.status = 'claimed' AND p_target_status NOT IN ('onboarding', 'active') THEN
    RAISE EXCEPTION 'Transisi status tidak valid: Partner CLAIMED harus melalui ONBOARDING.';
  ELSIF v_old.status = 'onboarding' AND p_target_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Transisi status tidak valid: Partner ONBOARDING harus diselesaikan atau dinonaktifkan.';
  ELSIF p_target_status = 'suspended' THEN
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

COMMIT;
