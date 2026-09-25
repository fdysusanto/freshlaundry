-- =============================================================================
-- FRESHWASH / FRESHLAUNDRY MARKETPLACE
-- Migration: 057_service_photos.sql
-- Description: Phase 2D-K.1 — Dynamic Service Photos
--              1. Adds image_url and storage_path columns to public.services.
--              2. Updates RPC public.admin_mutate_partner_service_atomic to accept
--                 p_image_url and p_storage_path for CREATE & UPDATE actions.
--              3. Preserves all existing validations, multi-tenant isolation,
--                 price safety, and immutable audit logs.
-- Author: Antigravity AI Architecture Team
-- Status: IDEMPOTENT & PRODUCTION HARDENED
-- =============================================================================

BEGIN;

-- 1. ADD COLUMNS TO public.services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS image_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS storage_path TEXT NULL;

COMMENT ON COLUMN public.services.image_url IS 'Public HTTPS URL foto layanan yang di-host di Supabase Storage atau fallback CDN';
COMMENT ON COLUMN public.services.storage_path IS 'Internal storage relative path (services/{laundry_id}/{filename}) untuk keperluan replacement dan deletion cleanup';

-- 2. REPLACE RPC admin_mutate_partner_service_atomic (DROP 14-PARAM OVERLOAD FROM MIGRATION 055)
DROP FUNCTION IF EXISTS public.admin_mutate_partner_service_atomic(
  TEXT,
  UUID,
  UUID,
  TEXT,
  TEXT,
  public.service_type,
  TEXT,
  TEXT,
  NUMERIC,
  TEXT,
  NUMERIC,
  INTEGER,
  TEXT,
  BOOLEAN
);

CREATE OR REPLACE FUNCTION public.admin_mutate_partner_service_atomic(
  p_action TEXT,
  p_laundry_id UUID,
  p_service_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_code service_type DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_pricing_type TEXT DEFAULT NULL,
  p_price_per_unit NUMERIC DEFAULT NULL,
  p_unit TEXT DEFAULT NULL,
  p_min_weight NUMERIC DEFAULT NULL,
  p_estimated_hours INTEGER DEFAULT NULL,
  p_icon_name TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_storage_path TEXT DEFAULT NULL
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
  v_old_service RECORD;
  v_new_service RECORD;
  v_trimmed_name TEXT;
  v_trimmed_desc TEXT;
  v_pricing_type TEXT;
  v_unit TEXT;
  v_icon TEXT;
  v_action_upper TEXT;
  v_min_weight NUMERIC;
  v_image_url TEXT;
  v_storage_path TEXT;
BEGIN
  -- 1. Verify Caller Authentication
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Pengguna tidak terautentikasi.';
  END IF;

  -- 2. Verify platform_admin Role
  SELECT role INTO v_admin_role FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_role IS NULL OR v_admin_role != 'platform_admin' THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya platform_admin yang berwenang mengelola katalog layanan partner.';
  END IF;

  -- 3. Verify Laundry Existence
  SELECT * INTO v_laundry FROM public.laundries WHERE id = p_laundry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner laundry tidak ditemukan.';
  END IF;

  v_action_upper := UPPER(TRIM(p_action));

  -- 4. Branch Action: CREATE, UPDATE, ACTIVATE, DEACTIVATE
  IF v_action_upper = 'CREATE' THEN
    -- Validation: Name
    v_trimmed_name := TRIM(COALESCE(p_name, ''));
    IF LENGTH(v_trimmed_name) < 3 THEN
      RAISE EXCEPTION 'Validasi Gagal: Nama layanan wajib diisi minimal 3 karakter.';
    END IF;

    -- Validation: Code
    IF p_code IS NULL THEN
      RAISE EXCEPTION 'Validasi Gagal: Kode tipe layanan (service_type) wajib ditentukan.';
    END IF;

    -- Validation: Price
    IF p_price_per_unit IS NULL OR p_price_per_unit <= 0 THEN
      RAISE EXCEPTION 'Validasi Gagal: Tarif harga layanan harus lebih besar dari Rp 0.';
    END IF;

    -- Validation: Estimated Hours
    IF p_estimated_hours IS NULL OR p_estimated_hours < 1 THEN
      RAISE EXCEPTION 'Validasi Gagal: Estimasi pengerjaan minimal 1 jam.';
    END IF;

    -- Unit & Pricing Type Normalization
    v_unit := LOWER(TRIM(COALESCE(p_unit, 'kg')));
    IF v_unit NOT IN ('kg', 'pcs') THEN
      RAISE EXCEPTION 'Validasi Gagal: Satuan layanan harus "kg" atau "pcs".';
    END IF;

    v_pricing_type := LOWER(TRIM(COALESCE(p_pricing_type, CASE WHEN v_unit = 'pcs' THEN 'per_item' ELSE 'per_kg' END)));
    IF v_pricing_type NOT IN ('per_kg', 'per_item', 'fixed') THEN
      RAISE EXCEPTION 'Validasi Gagal: Tipe penagihan harus "per_kg", "per_item", atau "fixed".';
    END IF;

    -- Minimum Weight Validation
    IF v_unit = 'kg' THEN
      IF p_min_weight IS NOT NULL AND p_min_weight <= 0 THEN
        RAISE EXCEPTION 'Validasi Gagal: Minimum order berat (kg) harus lebih besar dari 0.';
      END IF;
      v_min_weight := p_min_weight;
    ELSE
      v_min_weight := NULL;
    END IF;

    -- Category Validation
    IF p_category IS NOT NULL AND p_category NOT IN ('Pakaian', 'Sepatu & Sandal', 'Tas', 'Karpet', 'Sofa') THEN
      RAISE EXCEPTION 'Validasi Gagal: Kategori "%" tidak valid. Pilihan: Pakaian, Sepatu & Sandal, Tas, Karpet, Sofa.', p_category;
    END IF;

    -- Duplicate Check against UNIQUE(laundry_id, code, name)
    IF EXISTS (
      SELECT 1 FROM public.services
      WHERE laundry_id = p_laundry_id
        AND code = p_code
        AND LOWER(TRIM(name)) = LOWER(v_trimmed_name)
    ) THEN
      RAISE EXCEPTION 'Duplikasi Layanan: Layanan dengan kode "%" dan nama "%" sudah terdaftar pada toko laundry ini.', p_code, v_trimmed_name;
    END IF;

    v_trimmed_desc := TRIM(COALESCE(p_description, 'Layanan ' || v_trimmed_name));
    v_icon := COALESCE(NULLIF(TRIM(p_icon_name), ''), CASE WHEN v_unit = 'pcs' THEN 'Sparkles' ELSE 'ShoppingBag' END);

    -- Insert Service with optional photo
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
      icon_name,
      category,
      is_active,
      image_url,
      storage_path
    ) VALUES (
      p_laundry_id,
      p_code,
      v_trimmed_name,
      v_trimmed_desc,
      v_pricing_type,
      p_price_per_unit,
      v_unit,
      v_min_weight,
      p_estimated_hours,
      v_icon,
      p_category,
      COALESCE(p_is_active, true),
      NULLIF(TRIM(p_image_url), ''),
      NULLIF(TRIM(p_storage_path), '')
    ) RETURNING * INTO v_new_service;

    -- Insert Audit Log
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
      'SERVICE_CREATED',
      'partner',
      p_laundry_id,
      NULL,
      to_jsonb(v_new_service),
      'Penambahan layanan baru oleh Platform Ops Admin',
      jsonb_build_object(
        'service_id', v_new_service.id,
        'service_name', v_new_service.name,
        'service_code', v_new_service.code,
        'category', v_new_service.category,
        'image_url', v_new_service.image_url
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'action', 'CREATE',
      'service', to_jsonb(v_new_service),
      'message', 'Layanan berhasil ditambahkan.'
    );

  ELSIF v_action_upper = 'UPDATE' THEN
    IF p_service_id IS NULL THEN
      RAISE EXCEPTION 'Validasi Gagal: service_id wajib ditentukan untuk aksi UPDATE.';
    END IF;

    SELECT * INTO v_old_service
    FROM public.services
    WHERE id = p_service_id AND laundry_id = p_laundry_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Layanan tidak ditemukan pada partner laundry ini.';
    END IF;

    -- Validations on updated values if provided
    IF p_name IS NOT NULL THEN
      v_trimmed_name := TRIM(p_name);
      IF LENGTH(v_trimmed_name) < 3 THEN
        RAISE EXCEPTION 'Validasi Gagal: Nama layanan wajib diisi minimal 3 karakter.';
      END IF;
    ELSE
      v_trimmed_name := v_old_service.name;
    END IF;

    IF p_price_per_unit IS NOT NULL AND p_price_per_unit <= 0 THEN
      RAISE EXCEPTION 'Validasi Gagal: Tarif harga layanan harus lebih besar dari Rp 0.';
    END IF;

    IF p_estimated_hours IS NOT NULL AND p_estimated_hours < 1 THEN
      RAISE EXCEPTION 'Validasi Gagal: Estimasi pengerjaan minimal 1 jam.';
    END IF;

    v_unit := LOWER(TRIM(COALESCE(p_unit, v_old_service.unit)));
    IF v_unit NOT IN ('kg', 'pcs') THEN
      RAISE EXCEPTION 'Validasi Gagal: Satuan layanan harus "kg" atau "pcs".';
    END IF;

    IF p_pricing_type IS NOT NULL THEN
      v_pricing_type := LOWER(TRIM(p_pricing_type));
      IF v_pricing_type NOT IN ('per_kg', 'per_item', 'fixed') THEN
        RAISE EXCEPTION 'Validasi Gagal: Tipe penagihan harus "per_kg", "per_item", atau "fixed".';
      END IF;
    ELSE
      v_pricing_type := CASE WHEN v_unit = 'pcs' THEN 'per_item' ELSE v_old_service.pricing_type END;
    END IF;

    IF v_unit = 'kg' THEN
      IF p_min_weight IS NOT NULL THEN
        IF p_min_weight <= 0 THEN
          RAISE EXCEPTION 'Validasi Gagal: Minimum order berat (kg) harus lebih besar dari 0.';
        END IF;
        v_min_weight := p_min_weight;
      ELSE
        v_min_weight := v_old_service.min_weight;
      END IF;
    ELSE
      v_min_weight := NULL;
    END IF;

    IF p_category IS NOT NULL AND p_category NOT IN ('Pakaian', 'Sepatu & Sandal', 'Tas', 'Karpet', 'Sofa') THEN
      RAISE EXCEPTION 'Validasi Gagal: Kategori "%" tidak valid.', p_category;
    END IF;

    -- Duplicate check on name change
    IF p_name IS NOT NULL AND (LOWER(v_trimmed_name) != LOWER(v_old_service.name) OR (p_code IS NOT NULL AND p_code != v_old_service.code)) THEN
      IF EXISTS (
        SELECT 1 FROM public.services
        WHERE laundry_id = p_laundry_id
          AND code = COALESCE(p_code, v_old_service.code)
          AND LOWER(TRIM(name)) = LOWER(v_trimmed_name)
          AND id != p_service_id
      ) THEN
        RAISE EXCEPTION 'Duplikasi Layanan: Layanan dengan nama "%" sudah terdaftar pada toko laundry ini.', v_trimmed_name;
      END IF;
    END IF;

    v_trimmed_desc := CASE WHEN p_description IS NOT NULL THEN TRIM(p_description) ELSE v_old_service.description END;
    v_icon := CASE WHEN p_icon_name IS NOT NULL THEN NULLIF(TRIM(p_icon_name), '') ELSE v_old_service.icon_name END;

    -- Image replacement / removal handling
    IF p_image_url = '__REMOVE__' THEN
      v_image_url := NULL;
      v_storage_path := NULL;
    ELSIF p_image_url IS NOT NULL THEN
      v_image_url := NULLIF(TRIM(p_image_url), '');
      v_storage_path := NULLIF(TRIM(p_storage_path), '');
    ELSE
      v_image_url := v_old_service.image_url;
      v_storage_path := v_old_service.storage_path;
    END IF;

    UPDATE public.services
    SET
      name = v_trimmed_name,
      description = v_trimmed_desc,
      code = COALESCE(p_code, code),
      category = COALESCE(p_category, category),
      pricing_type = v_pricing_type,
      price_per_unit = COALESCE(p_price_per_unit, price_per_unit),
      unit = v_unit,
      min_weight = v_min_weight,
      estimated_hours = COALESCE(p_estimated_hours, estimated_hours),
      icon_name = COALESCE(v_icon, icon_name),
      is_active = COALESCE(p_is_active, is_active),
      image_url = v_image_url,
      storage_path = v_storage_path
    WHERE id = p_service_id AND laundry_id = p_laundry_id
    RETURNING * INTO v_new_service;

    -- Audit Log
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
      'SERVICE_UPDATED',
      'partner',
      p_laundry_id,
      to_jsonb(v_old_service),
      to_jsonb(v_new_service),
      'Pembaruan katalog layanan oleh Platform Ops Admin',
      jsonb_build_object(
        'service_id', v_new_service.id,
        'service_name', v_new_service.name,
        'image_url_changed', v_old_service.image_url IS DISTINCT FROM v_new_service.image_url
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'action', 'UPDATE',
      'service', to_jsonb(v_new_service),
      'message', 'Layanan berhasil diperbarui.'
    );

  ELSIF v_action_upper IN ('ACTIVATE', 'DEACTIVATE') THEN
    IF p_service_id IS NULL THEN
      RAISE EXCEPTION 'Validasi Gagal: service_id wajib ditentukan untuk aksi %.', v_action_upper;
    END IF;

    SELECT * INTO v_old_service
    FROM public.services
    WHERE id = p_service_id AND laundry_id = p_laundry_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Layanan tidak ditemukan pada partner laundry ini.';
    END IF;

    UPDATE public.services
    SET is_active = (v_action_upper = 'ACTIVATE')
    WHERE id = p_service_id AND laundry_id = p_laundry_id
    RETURNING * INTO v_new_service;

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
      CASE WHEN v_action_upper = 'ACTIVATE' THEN 'SERVICE_ACTIVATED' ELSE 'SERVICE_DEACTIVATED' END,
      'partner',
      p_laundry_id,
      to_jsonb(v_old_service),
      to_jsonb(v_new_service),
      'Perubahan status operasional layanan oleh Platform Ops Admin',
      jsonb_build_object('service_id', v_new_service.id, 'is_active', v_new_service.is_active)
    );

    RETURN jsonb_build_object(
      'success', true,
      'action', v_action_upper,
      'service', to_jsonb(v_new_service),
      'message', CASE WHEN v_action_upper = 'ACTIVATE' THEN 'Layanan berhasil diaktifkan kembali.' ELSE 'Layanan berhasil dinonaktifkan.' END
    );

  ELSE
    RAISE EXCEPTION 'Validasi Gagal: Aksi "%" tidak dikenali. Pilihan: CREATE, UPDATE, ACTIVATE, DEACTIVATE.', p_action;
  END IF;

END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_mutate_partner_service_atomic(
  TEXT,
  UUID,
  UUID,
  TEXT,
  TEXT,
  public.service_type,
  TEXT,
  TEXT,
  NUMERIC,
  TEXT,
  NUMERIC,
  INTEGER,
  TEXT,
  BOOLEAN,
  TEXT,
  TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_mutate_partner_service_atomic(
  TEXT,
  UUID,
  UUID,
  TEXT,
  TEXT,
  public.service_type,
  TEXT,
  TEXT,
  NUMERIC,
  TEXT,
  NUMERIC,
  INTEGER,
  TEXT,
  BOOLEAN,
  TEXT,
  TEXT
) TO authenticated, service_role;

COMMIT;
