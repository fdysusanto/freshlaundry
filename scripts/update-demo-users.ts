import { createClient } from '@supabase/supabase-js';

/**
 * ADMIN DEVELOPMENT ONLY SCRIPT
 * ------------------------------------------------------------------
 * Memperbarui email 4 akun demo Supabase Auth berdasarkan UUID tetap.
 * SCRIPT INI TIDAK MENGHAPUS USER, TIDAK MEMBUAT USER BARU, DAN
 * TIDAK MENGUBAH ROLE PADA TABEL PROFILES.
 * ------------------------------------------------------------------
 */

interface DemoAccountTarget {
  name: string;
  role: string;
  uuid: string;
  newEmail: string;
}

// ------------------------------------------------------------------
// DAFTAR AKUN DEMO YANG DIJAGA UUID-NYA
// Email diisi dengan 4 email aktif resmi proyek FreshLaundry
// ------------------------------------------------------------------
const DEMO_ACCOUNTS: DemoAccountTarget[] = [
  {
    name: 'Customer Demo',
    role: 'customer',
    uuid: '11b55a8a-ed87-48c9-8756-ce68fe258a8e',
    newEmail: process.env.NEW_EMAIL_CUSTOMER || 'sleephousecrb@gmail.com',
  },
  {
    name: 'Courier Demo',
    role: 'courier',
    uuid: 'ea770969-8ce0-406a-97f4-a70e55ea9f91',
    newEmail: process.env.NEW_EMAIL_COURIER || 'sleephouseklayan@gmail.com',
  },
  {
    name: 'Owner Demo',
    role: 'laundry_owner',
    uuid: '1980f348-4449-403a-bf61-e53d20be908f',
    newEmail: process.env.NEW_EMAIL_OWNER || 'Kurnia123@gmail.com',
  },
  {
    name: 'Admin Demo',
    role: 'platform_admin',
    uuid: 'abb51660-a73c-4df4-ac3e-8fb1ec55b94c',
    newEmail: process.env.NEW_EMAIL_ADMIN || 'laraswatibestari6@gmail.com',
  },
];

async function updateDemoUserEmails() {
  console.log('==================================================');
  console.log('ADMIN SCRIPT: UPDATE DEMO USER EMAILS');
  console.log('==================================================\n');

  // 1. Ambil Environment Variables
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();

  const serviceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  ).trim();

  // 2. Validasi Kehadiran Environment Variables
  if (!supabaseUrl) {
    console.error('[ERROR] SUPABASE_URL atau NEXT_PUBLIC_SUPABASE_URL belum diset.');
    console.error('Harap set environment variable SUPABASE_URL terlebih dahulu.');
    process.exit(1);
  }

  if (!serviceRoleKey) {
    console.error('[ERROR] SUPABASE_SERVICE_ROLE_KEY tidak ditemukan.');
    console.error('Script Admin API membutuhkan SUPABASE_SERVICE_ROLE_KEY untuk memperbarui Supabase Auth.');
    console.error('PERINGATAN: Jangan pernah menggunakan Service Role Key pada kode frontend/browser!\n');
    process.exit(1);
  }

  console.log(`Target Supabase Host: ${supabaseUrl}`);
  console.log('Status Auth Client : Connected via Admin Service Role Key\n');

  // 3. Inisialisasi Supabase Admin Client (Penyimpanan Sesi Matikan)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let successCount = 0;
  let failCount = 0;

  // 4. Iterasi 4 Akun Demo
  for (const account of DEMO_ACCOUNTS) {
    console.log(`--------------------------------------------------`);
    console.log(`[PEMERIKSAAN] ${account.name} (Role: ${account.role})`);
    console.log(`UUID Target  : ${account.uuid}`);
    console.log(`Email Baru   : ${account.newEmail}`);

    try {
      // 4A. Validasi Keberadaan User Berdasarkan UUID
      const { data: userData, error: getUserError } =
        await supabaseAdmin.auth.admin.getUserById(account.uuid);

      if (getUserError || !userData?.user) {
        console.error(
          `[FAIL] User dengan UUID ${account.uuid} TIDAK DITEMUKAN di Supabase Auth.`
        );
        if (getUserError) console.error(`  Detail Error: ${getUserError.message}`);
        console.error(`  [PERINGATAN] User baru TIDAK DIBUAT sesuai kebijakan script.`);
        failCount++;
        continue;
      }

      const currentEmail = userData.user.email;
      console.log(`Email Lama   : ${currentEmail}`);

      if (currentEmail === account.newEmail) {
        console.log(`[SKIP] Email sudah sesuai (${account.newEmail}), tidak ada perubahan.`);
        successCount++;
        continue;
      }

      // 4B. Update Email di Supabase Auth API
      const { data: updateData, error: updateError } =
        await supabaseAdmin.auth.admin.updateUserById(account.uuid, {
          email: account.newEmail,
          email_confirm: true,
        });

      if (updateError || !updateData?.user) {
        console.error(`[FAIL] Gagal memperbarui Supabase Auth email untuk UUID ${account.uuid}:`);
        console.error(`  Detail Error: ${updateError?.message || 'Unknown error'}`);
        failCount++;
        continue;
      }

      // 4C. Sinkronisasi Email di Tabel public.profiles (Tanpa Mengubah Role / UUID)
      const { error: profileError } = await (supabaseAdmin.from('profiles') as any)
        .update({ email: account.newEmail })
        .eq('id', account.uuid);

      if (profileError) {
        console.warn(
          `[WARNING] Auth Email berhasil diupdate, tetapi gagal mengupdate email di public.profiles: ${profileError.message}`
        );
      } else {
        console.log(`[SYNC] Email pada public.profiles berhasil disesuaikan.`);
      }

      console.log(`[SUCCESS] Email berhasil diperbarui dari '${currentEmail}' -> '${account.newEmail}'`);
      successCount++;
    } catch (err: any) {
      console.error(`[ERROR EXCEPTION] Gagal memproses UUID ${account.uuid}:`, err.message || err);
      failCount++;
    }
  }

  console.log('\n==================================================');
  console.log(`RINGKASAN PROSES UPDATE DEMO USERS`);
  console.log(`Berhasil / Sesuai : ${successCount}`);
  console.log(`Gagal             : ${failCount}`);
  console.log('==================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

// Jalankan fungsi utama
updateDemoUserEmails();
