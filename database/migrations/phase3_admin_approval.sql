-- ========================================================
-- MIGRATION: PHASE 3 ADMIN APPROVAL WORKFLOW & ATOMIC RPC
-- ========================================================

-- 1. Tambahkan kolom approved_laundry_id jika belum ada
ALTER TABLE public.partner_applications
ADD COLUMN IF NOT EXISTS approved_laundry_id UUID REFERENCES public.laundries(id) ON DELETE SET NULL;

-- 2. RPC Function: approve_partner_application (Atomic Provisioning Transaction)
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
    RETURN jsonb_build_object(
      'success', true,
      'already_approved', true,
      'application_id', p_application_id,
      'laundry_id', v_app.approved_laundry_id,
      'message', 'Pengajuan ini sudah disetujui sebelumnya.'
    );
  END IF;

  -- E. Validasi Status: Hanya 'pending' yang dapat disetujui
  IF v_app.status = 'rejected' THEN
    RAISE EXCEPTION 'Pengajuan yang ditolak tidak dapat disetujui secara langsung. Pengguna harus melakukan revisi terlebih dahulu.';
  END IF;

  IF v_app.status != 'pending' THEN
    RAISE EXCEPTION 'Hanya pengajuan berstatus pending yang dapat disetujui.';
  END IF;

  -- F. Generate Kode Laundry Unik (Contoh: LND-CRB-8F12)
  v_laundry_code := 'LND-' || UPPER(SUBSTRING(COALESCE(v_app.city, 'WSH') FROM 1 FOR 3)) || '-' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 4));

  -- G. Step 1 Provisioning: Insert ke public.laundries
  INSERT INTO public.laundries (
    code,
    name,
    owner_id,
    phone,
    address,
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
    v_app.laundry_address || ', ' || v_app.district || ', ' || v_app.city,
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
    'Layanan ' || pas.name || ' oleh ' || v_app.laundry_name,
    CASE WHEN pas.unit = 'pcs' THEN 'per_item' ELSE 'per_kg' END,
    pas.price_per_unit,
    pas.unit,
    true
  FROM public.partner_application_services pas
  WHERE pas.application_id = p_application_id
  ON CONFLICT (laundry_id, code) DO UPDATE SET
    price_per_unit = EXCLUDED.price_per_unit,
    name = EXCLUDED.name;

  GET DIAGNOSTICS v_service_count = ROW_COUNT;

  -- J. Step 4 Provisioning: Upgrade role user di public.profiles dari 'customer' menjadi 'laundry_owner'
  UPDATE public.profiles
  SET role = 'laundry_owner'
  WHERE id = v_app.user_id;

  -- K. Step 5 Provisioning: Update partner_applications record
  UPDATE public.partner_applications
  SET
    status = 'approved',
    reviewed_by = v_admin_id,
    reviewed_at = NOW(),
    rejection_reason = NULL,
    approved_laundry_id = v_new_laundry_id,
    updated_at = NOW()
  WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_approved', false,
    'application_id', p_application_id,
    'laundry_id', v_new_laundry_id,
    'services_copied', v_service_count,
    'message', 'Pengajuan berhasil disetujui dan toko mitra resmi telah diaktifkan.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Gagal memproses approval mitra: %', SQLERRM;
END;
$$;

-- Hak Akses RPC approve_partner_application
REVOKE EXECUTE ON FUNCTION public.approve_partner_application(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_partner_application(UUID) TO authenticated;


-- 3. RPC Function: reject_partner_application
CREATE OR REPLACE FUNCTION public.reject_partner_application(
  p_application_id UUID,
  p_reason TEXT
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
  v_trimmed_reason TEXT;
BEGIN
  -- A. Ambil auth.uid() caller secara internal
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terautentikasi.';
  END IF;

  -- B. Verifikasi caller adalah platform_admin
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role IS NULL OR v_admin_role != 'platform_admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya platform_admin yang dapat menolak pengajuan mitra.';
  END IF;

  -- C. Validasi alasan penolakan
  v_trimmed_reason := TRIM(p_reason);
  IF v_trimmed_reason IS NULL OR LENGTH(v_trimmed_reason) < 5 THEN
    RAISE EXCEPTION 'Alasan penolakan wajib diisi (minimal 5 karakter).';
  END IF;

  -- D. Lock baris partner_applications (FOR UPDATE)
  SELECT * INTO v_app
  FROM public.partner_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengajuan mitra tidak ditemukan.';
  END IF;

  -- E. Idempotensi & Validasi Status
  IF v_app.status = 'rejected' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_rejected', true,
      'application_id', p_application_id,
      'message', 'Pengajuan ini sudah ditolak sebelumnya.'
    );
  END IF;

  IF v_app.status = 'approved' THEN
    RAISE EXCEPTION 'Pengajuan yang sudah disetujui tidak dapat ditolak.';
  END IF;

  -- F. Update status partner_applications menjadi rejected
  UPDATE public.partner_applications
  SET
    status = 'rejected',
    rejection_reason = v_trimmed_reason,
    reviewed_by = v_admin_id,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_rejected', false,
    'application_id', p_application_id,
    'message', 'Pengajuan mitra telah ditolak.'
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Gagal menolak pengajuan mitra: %', SQLERRM;
END;
$$;

-- Hak Akses RPC reject_partner_application
REVOKE EXECUTE ON FUNCTION public.reject_partner_application(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_partner_application(UUID, TEXT) TO authenticated;
