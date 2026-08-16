-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 010_fix_approve_partner_application_profiles_schema.sql
-- Description: Fix approve_partner_application RPC against actual database schema.
--              Removes non-existent columns profiles.updated_at and
--              partner_applications.approved_laundry_id while maintaining
--              100% strict atomic provisioning logic.
-- Author: Antigravity AI Architecture Team
-- Date: 2026-08-16
-- Status: IDEMPOTENT & AUDITED
-- =============================================================================

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
  -- A. Caller check
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terautentikasi.';
  END IF;

  -- B. Admin role check
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role IS NULL OR v_admin_role != 'platform_admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya platform_admin yang dapat menyetujui pengajuan mitra.';
  END IF;

  -- C. Lock partner_applications row
  SELECT * INTO v_app
  FROM public.partner_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan mitra tidak ditemukan.';
  END IF;

  -- D. Check Idempotensi: Jika sudah approved
  IF v_app.status = 'approved' THEN
    SELECT id INTO v_new_laundry_id
    FROM public.laundries
    WHERE owner_id = v_app.user_id
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'already_approved', true,
      'application_id', p_application_id,
      'laundry_id', v_new_laundry_id,
      'message', 'Pengajuan ini sudah disetujui sebelumnya.'
    );
  END IF;

  -- E. Status Check: Hanya status pending yang diizinkan
  IF v_app.status = 'rejected' THEN
    RAISE EXCEPTION 'Pengajuan yang ditolak tidak dapat disetujui secara langsung. Pengguna harus melakukan revisi terlebih dahulu.';
  END IF;

  IF v_app.status != 'pending' THEN
    RAISE EXCEPTION 'Hanya pengajuan berstatus pending yang dapat disetujui.';
  END IF;

  -- F. Generate Kode Laundry Unik
  v_laundry_code := 'LND-' || UPPER(SUBSTRING(COALESCE(v_app.city, 'WSH') FROM 1 FOR 3)) || '-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 4));

  -- G. Step 1 Provisioning: Insert ke public.laundries beserta rincian wilayah
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

  -- H. Step 2 Provisioning: Insert ke public.laundry_users (Relasi Owner)
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

  -- I. Step 3 Provisioning: Copy services dari partner_application_services ke public.services
  INSERT INTO public.services (
    laundry_id,
    code,
    name,
    description,
    pricing_type,
    price_per_unit,
    unit,
    is_active
  )
  SELECT
    v_new_laundry_id,
    pas.code,
    pas.name,
    'Layanan resmi dari pengajuan mitra laundry',
    'per_kg',
    pas.price_per_unit,
    pas.unit,
    true
  FROM public.partner_application_services pas
  WHERE pas.application_id = p_application_id;

  GET DIAGNOSTICS v_service_count = ROW_COUNT;

  -- J. Step 4 Provisioning: Upgrade role user di public.profiles dari 'customer' menjadi 'laundry_owner'
  -- CATATAN: public.profiles TIDAK memiliki kolom updated_at
  UPDATE public.profiles
  SET role = 'laundry_owner'::user_role
  WHERE id = v_app.user_id;

  -- K. Step 5 Provisioning: Update status di public.partner_applications
  -- CATATAN: public.partner_applications di DB aktual TIDAK memiliki kolom approved_laundry_id
  UPDATE public.partner_applications
  SET
    status = 'approved',
    reviewed_by = v_admin_id,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_approved', false,
    'application_id', p_application_id,
    'laundry_id', v_new_laundry_id,
    'laundry_code', v_laundry_code,
    'services_provisioned', v_service_count,
    'message', 'Pengajuan mitra berhasil disetujui. Toko laundry dan katalog layanan telah diaktifkan secara otomatis.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_partner_application TO authenticated, service_role;

-- NOTIFY POSTGREST TO RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
