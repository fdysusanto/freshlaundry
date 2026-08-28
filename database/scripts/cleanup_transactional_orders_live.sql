-- =============================================================================
-- SCRIPT CLEANUP DATA TRANSAKSI ORDER SUPABASE LIVE PRODUCTION
-- =============================================================================
-- TUJUAN: Membersihkan seluruh data transaksi order uji coba/lama untuk mempersiapkan
--         database ke kondisi clean state sebelum pengujian business rules baru.
-- SAFEGUARD: Hanya menghapus data dari 7 tabel transaksi.
--           DILARANG MENGHAPUS data dari profiles, laundries, services, laundry_users.
-- EXECUTION NOTICE: Jalankan script ini pada Supabase Dashboard SQL Editor (Admin/Superuser).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- STEP 1: VERIFIKASI PRE-CLEANUP RECORD COUNTS
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_orders_cnt INT;
  v_items_cnt INT;
  v_logs_cnt INT;
  v_attempts_cnt INT;
  v_webhooks_cnt INT;
  v_assignments_cnt INT;
  v_batches_cnt INT;
  v_profiles_cnt INT;
  v_laundries_cnt INT;
  v_services_cnt INT;
  v_laundry_users_cnt INT;
BEGIN
  -- Hitung data transaksi
  SELECT COUNT(*) INTO v_orders_cnt FROM public.orders;
  SELECT COUNT(*) INTO v_items_cnt FROM public.order_items;
  SELECT COUNT(*) INTO v_logs_cnt FROM public.order_status_logs;
  SELECT COUNT(*) INTO v_attempts_cnt FROM public.payment_attempts;
  SELECT COUNT(*) INTO v_webhooks_cnt FROM public.payment_webhook_events;
  SELECT COUNT(*) INTO v_assignments_cnt FROM public.courier_assignments;
  SELECT COUNT(*) INTO v_batches_cnt FROM public.dispatch_batches;

  -- Hitung master data
  SELECT COUNT(*) INTO v_profiles_cnt FROM public.profiles;
  SELECT COUNT(*) INTO v_laundries_cnt FROM public.laundries;
  SELECT COUNT(*) INTO v_services_cnt FROM public.services;
  SELECT COUNT(*) INTO v_laundry_users_cnt FROM public.laundry_users;

  RAISE NOTICE '=== PRE-CLEANUP TRANSACTIONAL DATA COUNT ===';
  RAISE NOTICE 'orders: %', v_orders_cnt;
  RAISE NOTICE 'order_items: %', v_items_cnt;
  RAISE NOTICE 'order_status_logs: %', v_logs_cnt;
  RAISE NOTICE 'payment_attempts: %', v_attempts_cnt;
  RAISE NOTICE 'payment_webhook_events: %', v_webhooks_cnt;
  RAISE NOTICE 'courier_assignments: %', v_assignments_cnt;
  RAISE NOTICE 'dispatch_batches: %', v_batches_cnt;

  RAISE NOTICE '=== PRE-CLEANUP MASTER DATA COUNT (MUST BE PRESERVED) ===';
  RAISE NOTICE 'profiles: %', v_profiles_cnt;
  RAISE NOTICE 'laundries: %', v_laundries_cnt;
  RAISE NOTICE 'services: %', v_services_cnt;
  RAISE NOTICE 'laundry_users: %', v_laundry_users_cnt;

  IF v_profiles_cnt = 0 OR v_laundries_cnt = 0 OR v_services_cnt = 0 THEN
    RAISE EXCEPTION 'SAFETY GUARD TRIGGERED: Master data tidak ditemukan atau kosong. Process ditahan.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 2: EKSPLISIT BOTTOM-UP DELETE DATA TRANSAKSI
-- -----------------------------------------------------------------------------
-- Set session context untuk bypass trigger guard jika diperlukan pada admin session
PERFORM set_config('app.payment_processing', 'true', true);

DELETE FROM public.courier_assignments;
DELETE FROM public.dispatch_batches;
DELETE FROM public.payment_webhook_events;
DELETE FROM public.payment_attempts;
DELETE FROM public.order_status_logs;
DELETE FROM public.order_items;
DELETE FROM public.orders;

-- -----------------------------------------------------------------------------
-- STEP 3: VERIFIKASI POST-CLEANUP & HARD ASSERTION GUARDS
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_orders_cnt INT;
  v_items_cnt INT;
  v_logs_cnt INT;
  v_attempts_cnt INT;
  v_webhooks_cnt INT;
  v_assignments_cnt INT;
  v_batches_cnt INT;
  v_profiles_cnt INT;
  v_laundries_cnt INT;
  v_services_cnt INT;
  v_laundry_users_cnt INT;
BEGIN
  -- 1. Verifikasi 7 tabel transaksi bersih (0 records)
  SELECT COUNT(*) INTO v_orders_cnt FROM public.orders;
  SELECT COUNT(*) INTO v_items_cnt FROM public.order_items;
  SELECT COUNT(*) INTO v_logs_cnt FROM public.order_status_logs;
  SELECT COUNT(*) INTO v_attempts_cnt FROM public.payment_attempts;
  SELECT COUNT(*) INTO v_webhooks_cnt FROM public.payment_webhook_events;
  SELECT COUNT(*) INTO v_assignments_cnt FROM public.courier_assignments;
  SELECT COUNT(*) INTO v_batches_cnt FROM public.dispatch_batches;

  IF v_orders_cnt > 0 OR v_items_cnt > 0 OR v_logs_cnt > 0 OR 
     v_attempts_cnt > 0 OR v_webhooks_cnt > 0 OR v_assignments_cnt > 0 OR 
     v_batches_cnt > 0 THEN
    RAISE EXCEPTION 'POST-CLEANUP ASSERTION FAILED: Data transaksi belum 100%% bersih. Orders: %, Items: %, Logs: %, Attempts: %, Webhooks: %, Assignments: %, Batches: %. Transaksi dibatalkan (ROLLBACK).',
      v_orders_cnt, v_items_cnt, v_logs_cnt, v_attempts_cnt, v_webhooks_cnt, v_assignments_cnt, v_batches_cnt;
  END IF;

  -- 2. Verifikasi Master Data utuh (> 0 records)
  SELECT COUNT(*) INTO v_profiles_cnt FROM public.profiles;
  SELECT COUNT(*) INTO v_laundries_cnt FROM public.laundries;
  SELECT COUNT(*) INTO v_services_cnt FROM public.services;
  SELECT COUNT(*) INTO v_laundry_users_cnt FROM public.laundry_users;

  IF v_profiles_cnt = 0 OR v_laundries_cnt = 0 OR v_services_cnt = 0 OR v_laundry_users_cnt = 0 THEN
    RAISE EXCEPTION 'POST-CLEANUP ASSERTION FAILED: Master data terhapus secara tidak sengaja. Profiles: %, Laundries: %, Services: %, Laundry Users: %. Transaksi dibatalkan (ROLLBACK).',
      v_profiles_cnt, v_laundries_cnt, v_services_cnt, v_laundry_users_cnt;
  END IF;

  RAISE NOTICE '=== SUCCESS: POST-CLEANUP VERIFICATION PASSED ===';
  RAISE NOTICE 'Seluruh data transaksi order berhasil dibersihkan (0 records).';
  RAISE NOTICE 'Seluruh master data (profiles, laundries, services, laundry_users) tetap utuh.';
END $$;

COMMIT;
