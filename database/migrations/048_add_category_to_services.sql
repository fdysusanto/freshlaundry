-- =============================================================================
-- CUCIYAN LAUNDRY MARKETPLACE
-- Migration: 048_add_category_to_services.sql
-- Description: Add category column to services & partner_application_services
-- Author: Antigravity AI Architecture Team
-- Date: 2026-09-19
-- Status: IDEMPOTENT & PRODUCTION HARDENED
-- =============================================================================

BEGIN;

-- 1. Add category column to public.services if not exists with CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.services ADD COLUMN category TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_services_category'
  ) THEN
    ALTER TABLE public.services ADD CONSTRAINT chk_services_category 
      CHECK (category IS NULL OR category IN ('Pakaian', 'Sepatu & Sandal', 'Tas', 'Karpet'));
  END IF;
END $$;

-- 2. Add category column to public.partner_application_services if not exists with CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'partner_application_services' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.partner_application_services ADD COLUMN category TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_partner_app_services_category'
  ) THEN
    ALTER TABLE public.partner_application_services ADD CONSTRAINT chk_partner_app_services_category 
      CHECK (category IS NULL OR category IN ('Pakaian', 'Sepatu & Sandal', 'Tas', 'Karpet'));
  END IF;
END $$;

-- 3. Update approve_partner_application RPC to copy category column
CREATE OR REPLACE FUNCTION public.approve_partner_application(
  p_application_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_role user_role;
  v_app RECORD;
  v_new_laundry_id UUID;
  v_laundry_code TEXT;
  v_service_count INT := 0;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terautentikasi.';
  END IF;

  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role IS NULL OR v_admin_role != 'platform_admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya platform_admin yang dapat menyetujui pengajuan mitra.';
  END IF;

  SELECT * INTO v_app
  FROM public.partner_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan mitra tidak ditemukan.';
  END IF;

  IF v_app.status = 'approved' THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'application_id', p_application_id,
      'laundry_id', v_app.approved_laundry_id,
      'message', 'Pengajuan mitra ini sudah disetujui sebelumnya.'
    );
  END IF;

  IF v_app.status != 'pending' THEN
    RAISE EXCEPTION 'Pengajuan mitra tidak dalam status pending (status saat ini: %).', v_app.status;
  END IF;

  v_laundry_code := 'LND-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));

  INSERT INTO public.laundries (
    code,
    name,
    owner_id,
    phone,
    address,
    province_code,
    province_name,
    city_code,
    city_name,
    district_code,
    district_name,
    village_code,
    village_name,
    postal_code,
    rt,
    rw,
    address_detail,
    latitude,
    longitude,
    opening_time,
    closing_time,
    is_open,
    is_active,
    verification_status
  ) VALUES (
    v_laundry_code,
    v_app.laundry_name,
    v_app.user_id,
    v_app.owner_phone,
    v_app.laundry_address,
    COALESCE(v_app.province_code, '32'),
    COALESCE(v_app.province_name, 'Jawa Barat'),
    COALESCE(v_app.city_code, '3274'),
    COALESCE(v_app.city_name, v_app.city),
    v_app.district_code,
    COALESCE(v_app.district_name, v_app.district),
    v_app.village_code,
    v_app.village_name,
    v_app.postal_code,
    v_app.rt,
    v_app.rw,
    COALESCE(v_app.address_detail, v_app.laundry_address),
    v_app.latitude,
    v_app.longitude,
    COALESCE(v_app.opening_time, '08:00:00'::time),
    COALESCE(v_app.closing_time, '20:00:00'::time),
    true,
    true,
    'verified'
  )
  RETURNING id INTO v_new_laundry_id;

  INSERT INTO public.laundry_users (
    laundry_id,
    profile_id,
    role,
    is_active
  ) VALUES (
    v_new_laundry_id,
    v_app.user_id,
    'owner',
    true
  )
  ON CONFLICT (laundry_id, profile_id) DO NOTHING;

  INSERT INTO public.services (
    laundry_id,
    code,
    name,
    description,
    pricing_type,
    price_per_unit,
    unit,
    min_weight,
    estimated_hours,
    category,
    is_active
  )
  SELECT
    v_new_laundry_id,
    pas.code,
    pas.name,
    'Layanan resmi dari pengajuan mitra laundry',
    CASE WHEN pas.unit = 'pcs' THEN 'per_item' ELSE 'per_kg' END,
    pas.price_per_unit,
    pas.unit,
    CASE WHEN pas.unit = 'kg' THEN pas.min_weight ELSE NULL END,
    CASE
      WHEN pas.estimated_hours IS NOT NULL AND pas.estimated_hours > 0 THEN pas.estimated_hours
      WHEN pas.code = 'express' THEN 6
      WHEN pas.unit = 'pcs' THEN 48
      ELSE 24
    END,
    pas.category,
    true
  FROM public.partner_application_services pas
  WHERE pas.application_id = p_application_id;

  GET DIAGNOSTICS v_service_count = ROW_COUNT;

  UPDATE public.partner_applications
  SET status = 'approved',
      approved_laundry_id = v_new_laundry_id,
      updated_at = NOW()
  WHERE id = p_application_id;

  UPDATE public.profiles
  SET role = 'laundry_owner',
      updated_at = NOW()
  WHERE id = v_app.user_id;

  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    performed_by,
    payload
  ) VALUES (
    'partner_applications',
    p_application_id,
    'APPROVE',
    v_admin_id,
    jsonb_build_object(
      'laundry_id', v_new_laundry_id,
      'laundry_code', v_laundry_code,
      'service_count', v_service_count
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'application_id', p_application_id,
    'laundry_id', v_new_laundry_id,
    'laundry_code', v_laundry_code,
    'service_count', v_service_count,
    'message', 'Pengajuan mitra berhasil disetujui dan toko laundry telah diprovisi.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_partner_application(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_partner_application(UUID) TO authenticated, service_role;

COMMIT;
