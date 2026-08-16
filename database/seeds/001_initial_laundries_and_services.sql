-- =============================================================================
-- SEED DATA: 001_initial_laundries_and_services.sql
-- Description: Idempotent production/test seed for Laundry Test Cirebon & Services
-- =============================================================================

DO $$
DECLARE
  v_owner_id UUID;
  v_laundry_id UUID;
BEGIN
  -- 1. Fetch existing profile or create fallback owner profile
  SELECT id INTO v_owner_id FROM public.profiles LIMIT 1;

  IF v_owner_id IS NULL THEN
    v_owner_id := '00000000-0000-0000-0000-000000000001'::UUID;
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (v_owner_id, 'owner@freshlaundry.com', 'Owner Cirebon', 'laundry_owner')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 2. Insert or Update "Laundry Test Cirebon"
  INSERT INTO public.laundries (
    code,
    name,
    owner_id,
    description,
    phone,
    address,
    is_open,
    is_active,
    verification_status,
    rating,
    total_reviews
  )
  VALUES (
    'LND-CRB-01',
    'Laundry Test Cirebon',
    v_owner_id,
    'Mitra Laundry Resmi Cirebon - Layanan Kiloan, Express & Dry Clean',
    '081234567890',
    'Jl. Siliwangi No. 12, Cirebon',
    true,
    true,
    'verified',
    4.9,
    25
  )
  ON CONFLICT (code) DO UPDATE
  SET
    name = EXCLUDED.name,
    is_active = true,
    is_open = true,
    verification_status = 'verified'
  RETURNING id INTO v_laundry_id;

  IF v_laundry_id IS NULL THEN
    SELECT id INTO v_laundry_id FROM public.laundries WHERE code = 'LND-CRB-01';
  END IF;

  -- 3. Insert Services for Laundry Test Cirebon
  -- Service 1: Cuci Kering (kiloan)
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
    is_active
  )
  VALUES (
    v_laundry_id,
    'kiloan',
    'Cuci Kering',
    'Cuci bersih dan kering standar 24 jam',
    'per_kg',
    10000.00,
    'kg',
    1.00,
    24,
    'Shirt',
    true
  )
  ON CONFLICT (laundry_id, code) DO UPDATE
  SET
    name = EXCLUDED.name,
    price_per_unit = EXCLUDED.price_per_unit,
    estimated_hours = EXCLUDED.estimated_hours,
    is_active = true;

  -- Service 2: Cuci Kering Express (express)
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
    is_active
  )
  VALUES (
    v_laundry_id,
    'express',
    'Cuci Kering Express',
    'Layanan kilat cuci kering selesai 12 jam',
    'per_kg',
    15000.00,
    'kg',
    1.00,
    12,
    'Zap',
    true
  )
  ON CONFLICT (laundry_id, code) DO UPDATE
  SET
    name = EXCLUDED.name,
    price_per_unit = EXCLUDED.price_per_unit,
    estimated_hours = EXCLUDED.estimated_hours,
    is_active = true;

  -- Service 3: Dry Clean (dry_clean)
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
    is_active
  )
  VALUES (
    v_laundry_id,
    'dry_clean',
    'Dry Clean',
    'Pembersihan khusus gaun, jas, & pakaian sensitif',
    'per_item',
    25000.00,
    'pcs',
    1.00,
    48,
    'Sparkles',
    true
  )
  ON CONFLICT (laundry_id, code) DO UPDATE
  SET
    name = EXCLUDED.name,
    price_per_unit = EXCLUDED.price_per_unit,
    estimated_hours = EXCLUDED.estimated_hours,
    is_active = true;

END $$;

-- Verification Queries:
-- SELECT id, name, is_active FROM public.laundries;
-- SELECT id, laundry_id, name, code, price_per_unit, is_active FROM public.services;
