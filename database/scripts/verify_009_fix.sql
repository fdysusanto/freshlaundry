-- =============================================================================
-- VERIFICATION SCRIPT: 009_fix_approve_partner_application_services_price_mapping
-- Jalankan di Supabase SQL Editor untuk memverifikasi perbaikan RPC function
-- =============================================================================

-- 1. Verifikasi Definisi Function approve_partner_application
SELECT 
  routine_name, 
  routine_type, 
  security_type, 
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'approve_partner_application';

-- 2. Verifikasi Skema Kolom public.services (Memastikan price_per_unit dan pricing_type ada)
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'services'
ORDER BY ordinal_position;

-- 3. Verifikasi Skema Kolom public.partner_application_services
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'partner_application_services'
ORDER BY ordinal_position;

-- 4. Audit Kode Sumber Function: Memastikan TIDAK ADA rujukan "price," dan HANYA "price_per_unit"
SELECT 
  p.proname AS function_name,
  pg_get_functiondef(p.oid) LIKE '%price,%' OR pg_get_functiondef(p.oid) LIKE '%description, price%' AS contains_deprecated_price_column,
  pg_get_functiondef(p.oid) LIKE '%price_per_unit%' AS contains_price_per_unit,
  pg_get_functiondef(p.oid) LIKE '%pricing_type%' AS contains_pricing_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'approve_partner_application';

-- 5. Tampilkan Full Definition Function approve_partner_application untuk Peninjauan Visual
SELECT pg_get_functiondef(p.oid) AS full_function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'approve_partner_application';
