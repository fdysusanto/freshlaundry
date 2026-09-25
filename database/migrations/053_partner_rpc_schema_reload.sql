-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 053_partner_rpc_schema_reload.sql
-- Description: Drop legacy create_partner_listing_atomic function signatures,
--              re-create atomic partner listing RPC with exact 10 parameters,
--              enforce security privileges, and send PostgREST schema reload signal.
-- Author: Antigravity AI Architecture Team
-- Status: IDEMPOTENT & PRODUCTION HARDENED
-- =============================================================================

BEGIN;

-- 1. Drop all previous/overloaded signatures of create_partner_listing_atomic
DROP FUNCTION IF EXISTS public.create_partner_listing_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_partner_listing_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_partner_listing_atomic;

-- 2. Re-create create_partner_listing_atomic with exact 10 parameters
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
  -- A. Authentication & Authorization Check
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terautentikasi.';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role IS NULL OR v_admin_role != 'platform_admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya platform_admin yang dapat membuat listing mitra.';
  END IF;

  -- B. Mandatory Field Validation
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Nama bisnis laundry wajib diisi.';
  END IF;

  -- C. Coordinate Bounds Check (-90 <= lat <= 90, -180 <= lng <= 180)
  IF p_latitude IS NOT NULL AND (p_latitude < -90 OR p_latitude > 90) THEN
    RAISE EXCEPTION 'Validasi Gagal: Latitude harus berada dalam rentang -90 hingga 90.';
  END IF;

  IF p_longitude IS NOT NULL AND (p_longitude < -180 OR p_longitude > 180) THEN
    RAISE EXCEPTION 'Validasi Gagal: Longitude harus berada dalam rentang -180 hingga 180.';
  END IF;

  -- D. Unique Partner Code Generation
  LOOP
    v_laundry_code := 'LND-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.laundries WHERE code = v_laundry_code);
  END LOOP;

  -- E. Insert Partner Listing Record (Status: listed, claim_status: unclaimed, owner_id: NULL, is_active: false)
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

  -- F. Insert Immutable Audit Log Record
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
    jsonb_build_object('code', v_laundry_code, 'name', p_name, 'latitude', p_latitude, 'longitude', p_longitude)
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

-- 3. Security Privileges & Grants
REVOKE EXECUTE ON FUNCTION public.create_partner_listing_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_partner_listing_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 4. PostgREST Schema Cache Reload Signal
NOTIFY pgrst, 'reload schema';

COMMIT;
