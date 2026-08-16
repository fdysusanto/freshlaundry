-- =============================================================================
-- VERIFICATION SCRIPT: 010_fix_approve_partner_application_profiles_schema
-- Jalankan di Supabase SQL Editor untuk memverifikasi perbaikan RPC function
-- dan memastikan 100% kompatibilitas skema database.
-- =============================================================================

-- 1. Audit Rujukan Kolom dalam Definisi Function approve_partner_application
-- Memastikan TIDAK ADA rujukan kolom non-existent (profiles.updated_at, partner_applications.approved_laundry_id, services.price)
-- Memastikan TETAP ADA rujukan kolom resmi (profiles.role, services.price_per_unit, services.pricing_type)
SELECT 
  p.proname AS function_name,
  -- Check Invalid References (Harus FALSE)
  (pg_get_functiondef(p.oid) LIKE '%profiles%updated_at%') AS contains_profiles_updated_at_bug,
  (pg_get_functiondef(p.oid) LIKE '%approved_laundry_id%') AS contains_approved_laundry_id_bug,
  (pg_get_functiondef(p.oid) LIKE '%description, price,%' OR pg_get_functiondef(p.oid) LIKE '%services%price,%') AS contains_services_price_bug,
  -- Check Required Valid References (Harus TRUE)
  (pg_get_functiondef(p.oid) LIKE '%role = ''laundry_owner''%') AS contains_profiles_role_upgrade,
  (pg_get_functiondef(p.oid) LIKE '%price_per_unit%') AS contains_services_price_per_unit,
  (pg_get_functiondef(p.oid) LIKE '%pricing_type%') AS contains_services_pricing_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'approve_partner_application';

-- 2. Audit Skema Kolom public.profiles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 3. Audit Skema Kolom public.partner_applications
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'partner_applications'
ORDER BY ordinal_position;

-- 4. Transaksi & Orphan Record Check (Berdasarkan skema aktual tanpa approved_laundry_id)
-- A. Cek pengajuan mitra yang masih pending
SELECT id, user_id, status, laundry_name, created_at
FROM public.partner_applications
WHERE status = 'pending';

-- B. Cek apakah ada record laundries terbuat untuk user pengaju yang aplikasinya masih pending
SELECT l.id AS laundry_id, l.code, l.name, l.owner_id, l.created_at
FROM public.laundries l
JOIN public.partner_applications pa ON l.owner_id = pa.user_id
WHERE pa.status = 'pending';

-- C. Cek apakah ada record laundry_users terbuat untuk user pengaju yang aplikasinya masih pending
SELECT lu.id, lu.laundry_id, lu.profile_id, lu.role
FROM public.laundry_users lu
JOIN public.partner_applications pa ON lu.profile_id = pa.user_id
WHERE pa.status = 'pending';

-- 5. Tampilkan Full Definition Function approve_partner_application untuk Peninjauan Visual
SELECT pg_get_functiondef(p.oid) AS full_function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'approve_partner_application';
