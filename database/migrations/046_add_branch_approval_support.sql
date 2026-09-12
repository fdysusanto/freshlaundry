-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 046_add_branch_approval_support.sql
-- Description: Extends partner_applications schema and approve_partner_application RPC
--              to support multi-laundry owner branch additions (application_type = 'add_branch').
-- Features:
--   1. Adds application_type (VARCHAR, default 'new_partner', check IN ('new_partner', 'add_branch')).
--   2. Adds approved_laundry_id (UUID REFERENCES laundries(id)).
--   3. Adds partial unique index ensuring max 1 PENDING add_branch application per owner.
--   4. Backfills approved_laundry_id deterministically for legacy approved applications.
--   5. Updates approve_partner_application RPC to store approved_laundry_id and use it for 100% precise idempotency.
-- Author: Antigravity AI Architecture Team
-- Status: IDEMPOTENT & PRODUCTION HARDENED
-- =============================================================================

BEGIN;

-- 1. Schema Extensions on public.partner_applications
ALTER TABLE public.partner_applications
ADD COLUMN IF NOT EXISTS application_type VARCHAR(20) NOT NULL DEFAULT 'new_partner',
ADD COLUMN IF NOT EXISTS approved_laundry_id UUID REFERENCES public.laundries(id) ON DELETE SET NULL;

-- 2. Application Type Constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_partner_applications_type'
  ) THEN
    ALTER TABLE public.partner_applications
    ADD CONSTRAINT chk_partner_applications_type
    CHECK (application_type IN ('new_partner', 'add_branch'));
  END IF;
END $$;

-- 3. Duplicate Pending Protection Index
-- Ensures ONE owner can have at most ONE pending ADD_BRANCH application at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_add_branch_per_owner
ON public.partner_applications (user_id)
WHERE status = 'pending' AND application_type = 'add_branch';

-- 4. Deterministic Backfill for Legacy Approved Applications
UPDATE public.partner_applications pa
SET approved_laundry_id = l.id
FROM public.laundries l
WHERE pa.status = 'approved'
  AND pa.approved_laundry_id IS NULL
  AND pa.user_id = l.owner_id
  AND (
    SELECT COUNT(*) FROM public.laundries l2 WHERE l2.owner_id = pa.user_id
  ) = 1;

-- 5. RPC Function: approve_partner_application (Updated for Multi-Branch Idempotency)
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
  v_existing_laundry_id UUID;
  v_laundry_code TEXT;
  v_service_count INT := 0;
BEGIN
  -- A. Ambil auth.uid() caller secara internal
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terautentikasi.';
  END IF;

  -- B. Verifikasi caller adalah platform_admin
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role IS NULL OR v_admin_role != 'platform_admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya platform_admin yang dapat menyetujui pengajuan mitra.';
  END IF;

  -- C. Lock baris partner_applications (FOR UPDATE) untuk pencegahan race condition / double submit
  SELECT * INTO v_app
  FROM public.partner_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan mitra tidak ditemukan.';
  END IF;

  -- D. Check Idempotensi: Jika sudah approved
  IF v_app.status = 'approved' THEN
    IF v_app.approved_laundry_id IS NOT NULL THEN
      v_existing_laundry_id := v_app.approved_laundry_id;
    ELSE
      -- Fallback aman untuk data legacy tanpa guessing ambigu:
      -- Hanya ambil laundry jika owner memiliki tepat 1 laundry
      SELECT id
      INTO v_existing_laundry_id
      FROM public.laundries
      WHERE owner_id = v_app.user_id
      AND (SELECT COUNT(*) FROM public.laundries WHERE owner_id = v_app.user_id) = 1;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'application_id', p_application_id,
      'laundry_id', v_existing_laundry_id,
      'message', 'Pengajuan mitra ini sudah disetujui sebelumnya.'
    );
  END IF;

  IF v_app.status != 'pending' THEN
    RAISE EXCEPTION 'Pengajuan mitra tidak dalam status pending (status saat ini: %).', v_app.status;
  END IF;

  -- E. Generate Kode Unique Laundry dengan Loop Collision-Safe
  LOOP
    v_laundry_code := 'LND-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.laundries WHERE code = v_laundry_code);
  END LOOP;

  -- F. Step 1 Provisioning: Insert ke public.laundries
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

  -- G. Step 2 Provisioning: Insert ke public.laundry_users (Relasi Owner)
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

  -- H. Step 3 Provisioning: Copy all services directly from partner_application_services to public.services
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
    is_active
  )
  SELECT
    v_new_laundry_id,
    pas.code,
    pas.name,
    'Layanan resmi dari pengajuan cabang laundry',
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
    true
  FROM public.partner_application_services pas
  WHERE pas.application_id = p_application_id;

  GET DIAGNOSTICS v_service_count = ROW_COUNT;

  -- I. Update Status Partner Application (Simpan approved_laundry_id untuk Idempotensi Presisi)
  UPDATE public.partner_applications
  SET status = 'approved',
      approved_laundry_id = v_new_laundry_id,
      reviewed_by = v_admin_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_application_id;

  -- J. Update Profiles (Safe for NEW_PARTNER & ADD_BRANCH)
  UPDATE public.profiles
  SET role = 'laundry_owner'
  WHERE id = v_app.user_id;

  -- K. Optional Audit Log Event
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE '
      INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        performed_by,
        payload
      ) VALUES (
        $1, $2, $3, $4, $5
      )
    ' USING
      'partner_applications',
      p_application_id,
      'APPROVE',
      v_admin_id,
      jsonb_build_object(
        'application_type', v_app.application_type,
        'laundry_id', v_new_laundry_id,
        'laundry_code', v_laundry_code,
        'service_count', v_service_count
      );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'application_id', p_application_id,
    'laundry_id', v_new_laundry_id,
    'laundry_code', v_laundry_code,
    'service_count', v_service_count,
    'message', 'Pengajuan cabang/mitra berhasil disetujui dan toko laundry telah diprovisi.'
  );
END;
$$;

-- Hak Akses RPC approve_partner_application
REVOKE EXECUTE ON FUNCTION public.approve_partner_application(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_partner_application(UUID) TO authenticated, service_role;

COMMIT;
