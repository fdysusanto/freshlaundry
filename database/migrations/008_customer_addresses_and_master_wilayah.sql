-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 008_customer_addresses_and_master_wilayah.sql
-- Description: Add Administrative Master Regions (Kota Cirebon V1), Customer Addresses Table,
--              Order Address Snapshots, Partner Application & Laundry Region Details,
--              Single Default Address Trigger, and Hardened RLS Security.
-- Author: Antigravity AI Architecture Team
-- Date: 2026-08-15
-- Status: IDEMPOTENT & AUDITED
-- =============================================================================

-- 1. MASTER ADMINISTRATIVE REGIONS TABLE (NORMALIZED REFERENCE DATA)
CREATE TABLE IF NOT EXISTS public.administrative_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province_code TEXT NOT NULL,
  province_name TEXT NOT NULL,
  city_code TEXT NOT NULL,
  city_name TEXT NOT NULL,
  city_type TEXT NOT NULL DEFAULT 'Kota',
  district_code TEXT NOT NULL,
  district_name TEXT NOT NULL,
  village_code TEXT NOT NULL,
  village_name TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_admin_region_village_code UNIQUE (village_code)
);

CREATE INDEX IF NOT EXISTS idx_admin_regions_lookup 
ON public.administrative_regions (province_code, city_code, district_code);

-- RLS: Master Regions are public read-only reference data
ALTER TABLE public.administrative_regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for administrative regions" ON public.administrative_regions;
CREATE POLICY "Public read access for administrative regions" 
ON public.administrative_regions FOR SELECT TO PUBLIC USING (true);


-- 2. SEED MASTER REGIONS DATA: KOTA CIREBON (JAWA BARAT - CODE 32.74)
-- Idempotent UPSERT into public.administrative_regions
INSERT INTO public.administrative_regions (
  province_code, province_name, city_code, city_name, city_type,
  district_code, district_name, village_code, village_name, postal_code
) VALUES
  -- Kecamatan Harjamukti (327401)
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327401', 'Harjamukti', '3274011001', 'Harjamukti', '45143'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327401', 'Harjamukti', '3274011002', 'Kalijaga', '45144'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327401', 'Harjamukti', '3274011003', 'Argasunya', '45145'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327401', 'Harjamukti', '3274011004', 'Larangan', '45142'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327401', 'Harjamukti', '3274011005', 'Kebonmanis', '45141'),

  -- Kecamatan Lemahwungkuk (327402)
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327402', 'Lemahwungkuk', '3274021001', 'Lemahwungkuk', '45111'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327402', 'Lemahwungkuk', '3274021002', 'Panjunan', '45112'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327402', 'Lemahwungkuk', '3274021003', 'Pegambiran', '45113'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327402', 'Lemahwungkuk', '3274021004', 'Kasepuhan', '45114'),

  -- Kecamatan Kejaksan (327403)
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327403', 'Kejaksan', '3274031001', 'Kejaksan', '45123'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327403', 'Kejaksan', '3274031002', 'Kesenden', '45121'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327403', 'Kejaksan', '3274031003', 'Sukapura', '45122'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327403', 'Kejaksan', '3274031004', 'Kebonbaru', '45124'),

  -- Kecamatan Kesambi (327404)
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327404', 'Kesambi', '3274041001', 'Kesambi', '45134'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327404', 'Kesambi', '3274041002', 'Karyamulya', '45135'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327404', 'Kesambi', '3274041003', 'Sunyaragi', '45132'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327404', 'Kesambi', '3274041004', 'Drajat', '45133'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327404', 'Kesambi', '3274041005', 'Pekiringan', '45131'),

  -- Kecamatan Pekalipan (327405)
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327405', 'Pekalipan', '3274051001', 'Pekalipan', '45117'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327405', 'Pekalipan', '3274051002', 'Pekalangan', '45118'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327405', 'Pekalipan', '3274051003', 'Jagasatru', '45115'),
  ('32', 'Jawa Barat', '3274', 'Kota Cirebon', 'Kota', '327405', 'Pekalipan', '3274051004', 'Pulasaren', '45116')
ON CONFLICT (village_code) DO UPDATE SET
  province_name = EXCLUDED.province_name,
  city_name = EXCLUDED.city_name,
  district_name = EXCLUDED.district_name,
  village_name = EXCLUDED.village_name,
  postal_code = EXCLUDED.postal_code;


-- 3. CUSTOMER ADDRESSES TABLE
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Rumah',
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  province_code TEXT NOT NULL,
  province_name TEXT NOT NULL,
  city_code TEXT NOT NULL,
  city_name TEXT NOT NULL,
  district_code TEXT NOT NULL,
  district_name TEXT NOT NULL,
  village_code TEXT NOT NULL,
  village_name TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  address_detail TEXT NOT NULL,
  rt TEXT,
  rw TEXT,
  latitude NUMERIC NULL,
  longitude NUMERIC NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id 
ON public.customer_addresses (customer_id) WHERE is_active = true;

-- Enable RLS on customer_addresses
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can view own addresses" ON public.customer_addresses
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can insert own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can insert own addresses" ON public.customer_addresses
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid() AND public.get_my_role() = 'customer'::user_role);

DROP POLICY IF EXISTS "Customers can update own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can update own addresses" ON public.customer_addresses
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can delete own addresses" ON public.customer_addresses;
CREATE POLICY "Customers can delete own addresses" ON public.customer_addresses
  FOR DELETE TO authenticated
  USING (customer_id = auth.uid());


-- 4. SINGLE DEFAULT ADDRESS TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_single_default_customer_address()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count INT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- If this is the first active address for the customer, force is_default = true
    SELECT COUNT(*) INTO v_active_count
    FROM public.customer_addresses
    WHERE customer_id = NEW.customer_id AND is_active = true;

    IF v_active_count = 0 THEN
      NEW.is_default := true;
    END IF;
  END IF;

  -- If setting is_default = true, unset default on all other active addresses of this customer
  IF NEW.is_default = true THEN
    UPDATE public.customer_addresses
    SET is_default = false, updated_at = NOW()
    WHERE customer_id = NEW.customer_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_default_customer_address ON public.customer_addresses;
CREATE TRIGGER trg_single_default_customer_address
  BEFORE INSERT OR UPDATE OF is_default, is_active ON public.customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_single_default_customer_address();


-- 5. ADD SNAPSHOT & REGION COLUMNS TO EXISTING TABLES (ADDITIVE & BACKWARD COMPATIBLE)

-- Orders Snapshot Columns
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS pickup_address_snapshot JSONB,
ADD COLUMN IF NOT EXISTS delivery_address_snapshot JSONB;

-- Partner Applications Region Columns
ALTER TABLE public.partner_applications
ADD COLUMN IF NOT EXISTS province_code TEXT,
ADD COLUMN IF NOT EXISTS province_name TEXT,
ADD COLUMN IF NOT EXISTS city_code TEXT,
ADD COLUMN IF NOT EXISTS city_name TEXT,
ADD COLUMN IF NOT EXISTS district_code TEXT,
ADD COLUMN IF NOT EXISTS district_name TEXT,
ADD COLUMN IF NOT EXISTS village_code TEXT,
ADD COLUMN IF NOT EXISTS village_name TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS rt TEXT,
ADD COLUMN IF NOT EXISTS rw TEXT,
ADD COLUMN IF NOT EXISTS address_detail TEXT;

-- Laundries Profile Region Columns
ALTER TABLE public.laundries
ADD COLUMN IF NOT EXISTS province_code TEXT,
ADD COLUMN IF NOT EXISTS province_name TEXT,
ADD COLUMN IF NOT EXISTS city_code TEXT,
ADD COLUMN IF NOT EXISTS city_name TEXT,
ADD COLUMN IF NOT EXISTS district_code TEXT,
ADD COLUMN IF NOT EXISTS district_name TEXT,
ADD COLUMN IF NOT EXISTS village_code TEXT,
ADD COLUMN IF NOT EXISTS village_name TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS rt TEXT,
ADD COLUMN IF NOT EXISTS rw TEXT,
ADD COLUMN IF NOT EXISTS address_detail TEXT;


-- 6. ORDER CREATION RPC (PRESERVE EXISTING 17-PARAMETER PRODUCTION RPC UNTOUCHED)
-- Production uses public.create_order_with_items_atomic(17 parameters) from Migration 007.
-- Address snapshots (pickup_address_snapshot, delivery_address_snapshot) are persisted directly
-- as JSONB columns on public.orders table via REST API without altering RPC signatures.


-- 7. UPDATE APPROVE PARTNER APPLICATION RPC TO PROVISION REGION DETAILS TO LAUNDRIES
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

  -- D. Idempotency Check
  IF v_app.status = 'approved' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_approved', true,
      'application_id', p_application_id,
      'laundry_id', v_app.approved_laundry_id,
      'message', 'Pengajuan ini sudah disetujui sebelumnya.'
    );
  END IF;

  -- E. Status Check
  IF v_app.status = 'rejected' THEN
    RAISE EXCEPTION 'Pengajuan yang ditolak tidak dapat disetujui secara langsung. Pengguna harus melakukan revisi terlebih dahulu.';
  END IF;

  IF v_app.status != 'pending' THEN
    RAISE EXCEPTION 'Hanya pengajuan berstatus pending yang dapat disetujui.';
  END IF;

  -- F. Generate Laundry Code
  v_laundry_code := 'LND-' || UPPER(SUBSTRING(COALESCE(v_app.city, 'WSH') FROM 1 FOR 3)) || '-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 4));

  -- G. Step 1 Provisioning: Insert into public.laundries with region details
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

  -- H. Step 2 Provisioning: Insert laundry_users (Owner)
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

  -- I. Step 3 Provisioning: Copy services from partner_application_services to services
  INSERT INTO public.services (
    laundry_id,
    code,
    name,
    description,
    price,
    unit,
    is_active
  )
  SELECT
    v_new_laundry_id,
    pas.code,
    pas.name,
    'Layanan resmi dari pengajuan mitra laundry',
    pas.price_per_unit,
    pas.unit,
    true
  FROM public.partner_application_services pas
  WHERE pas.application_id = p_application_id;

  GET DIAGNOSTICS v_service_count = ROW_COUNT;

  -- J. Step 4 Provisioning: Update user role in public.profiles to laundry_owner
  UPDATE public.profiles
  SET role = 'laundry_owner'::user_role, updated_at = NOW()
  WHERE id = v_app.user_id;

  -- K. Step 5 Provisioning: Update status in partner_applications
  UPDATE public.partner_applications
  SET
    status = 'approved',
    approved_laundry_id = v_new_laundry_id,
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

-- 8. NOTIFY POSTGREST TO RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';


