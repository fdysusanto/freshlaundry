import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { paymentService } from '@/services/paymentService';
import { authService } from '@/services/authService';

/**
 * Helper to authenticate and authorize Platform Admin server-side.
 */
async function authenticateAdmin(request: Request): Promise<{
  isAuthorized: boolean;
  userId: string | null;
  status: number;
  message?: string;
}> {
  if (isSupabaseConfigured && supabase) {
    const authHeader = request.headers.get('authorization') || '';
    let accessToken = '';

    if (authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7).trim();
    }

    if (!accessToken) {
      const { data: { session } } = await supabase.auth.getSession();
      accessToken = session?.access_token || '';
    }

    if (!accessToken) {
      return { isAuthorized: false, userId: null, status: 401, message: 'Tidak Terotentikasi: Sesi atau token otentikasi tidak ditemukan.' };
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return { isAuthorized: false, userId: null, status: 401, message: 'Otentikasi Gagal: Token tidak valid atau telah kadaluwarsa.' };
    }

    const authUserId = userData.user.id;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    const profileClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : supabase;

    const { data: profile } = await (profileClient.from('profiles') as any)
      .select('role')
      .eq('id', authUserId)
      .single();

    if (!profile || profile.role !== 'platform_admin') {
      return { isAuthorized: false, userId: authUserId, status: 403, message: 'Akses Ditolak: Hanya Platform Admin yang berhak mengelola pengembalian dana.' };
    }

    return { isAuthorized: true, userId: authUserId, status: 200 };
  } else {
    // Local / Mock Mode Fallback
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'platform_admin') {
      return { isAuthorized: false, userId: currentUser?.id || null, status: 403, message: 'Akses Ditolak: Hanya Platform Admin yang diizinkan.' };
    }
    return { isAuthorized: true, userId: currentUser.id, status: 200 };
  }
}

/**
 * GET /api/admin/refunds
 * Fetches all orders with payment_status = 'refund_pending'
 */
export async function GET(request: Request) {
  try {
    const authResult = await authenticateAdmin(request);
    if (!authResult.isAuthorized) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
    }

    const refunds = await paymentService.getPendingRefundsAsync();

    return NextResponse.json({
      success: true,
      refunds,
      count: refunds.length,
    });
  } catch (error: any) {
    console.error('[API-ADMIN-REFUNDS-GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal mengambil data antrean pengembalian dana.',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/refunds
 * Confirms a manual platform refund for a refund_pending order.
 */
export async function POST(request: Request) {
  try {
    const authResult = await authenticateAdmin(request);
    if (!authResult.isAuthorized) {
      return NextResponse.json({ success: false, message: authResult.message }, { status: authResult.status });
    }

    const body = await request.json();
    const {
      orderId,
      paymentAttemptId,
      destinationBank,
      destinationAccount,
      destinationName,
      reference,
      notes,
    } = body;

    // 1. Strict Server-Side Input Validation
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return NextResponse.json({ success: false, message: 'ID Pesanan (orderId) wajib diisi.' }, { status: 400 });
    }
    if (!paymentAttemptId || typeof paymentAttemptId !== 'string' || !paymentAttemptId.trim()) {
      return NextResponse.json({ success: false, message: 'ID Pembayaran (paymentAttemptId) wajib diisi.' }, { status: 400 });
    }
    if (!destinationBank || typeof destinationBank !== 'string' || !destinationBank.trim()) {
      return NextResponse.json({ success: false, message: 'Nama Bank Tujuan wajib diisi.' }, { status: 400 });
    }
    if (!destinationAccount || typeof destinationAccount !== 'string' || !destinationAccount.trim()) {
      return NextResponse.json({ success: false, message: 'Nomor Rekening Tujuan wajib diisi.' }, { status: 400 });
    }
    if (!destinationName || typeof destinationName !== 'string' || !destinationName.trim()) {
      return NextResponse.json({ success: false, message: 'Nama Pemilik Rekening wajib diisi.' }, { status: 400 });
    }
    if (!reference || typeof reference !== 'string' || !reference.trim()) {
      return NextResponse.json({ success: false, message: 'Nomor Referensi Bukti Transfer wajib diisi.' }, { status: 400 });
    }

    // 2. Fetch Actual Paid Amount from Database (Never Trust Client Amount)
    let actualAmount = 0;
    if (isSupabaseConfigured && supabase) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      const adminDb = serviceRoleKey
        ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
        : supabase;

      const { data: attemptRow, error: attemptErr } = await (adminDb.from('payment_attempts') as any)
        .select('id, order_id, amount, status')
        .eq('id', paymentAttemptId.trim())
        .single();

      if (attemptErr || !attemptRow) {
        return NextResponse.json({ success: false, message: 'Data pembayaran tidak ditemukan di database.' }, { status: 400 });
      }

      if (attemptRow.order_id !== orderId.trim()) {
        return NextResponse.json({ success: false, message: 'Mismatch: Data pembayaran tidak cocok dengan pesanan yang dimaksud.' }, { status: 400 });
      }

      if (attemptRow.status !== 'refund_pending') {
        return NextResponse.json({ success: false, message: `Status pembayaran tidak valid untuk refund (status saat ini: ${attemptRow.status}).` }, { status: 400 });
      }

      actualAmount = attemptRow.amount;
    } else {
      actualAmount = body.amount || 0;
    }

    if (actualAmount <= 0) {
      return NextResponse.json({ success: false, message: 'Nominal pembayaran tidak valid (harus lebih besar dari Rp 0).' }, { status: 400 });
    }

    // 3. Invoke Atomic Manual Refund Confirmation RPC
    await paymentService.confirmManualRefundAsync(
      orderId.trim(),
      paymentAttemptId.trim(),
      actualAmount,
      destinationBank.trim(),
      destinationAccount.trim(),
      destinationName.trim(),
      reference.trim(),
      (notes || '').trim()
    );

    return NextResponse.json({
      success: true,
      message: 'Pengembalian dana manual telah berhasil dikonfirmasi dan dicatat ke sistem.',
    });
  } catch (error: any) {
    console.error('[API-ADMIN-REFUNDS-POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal mengonfirmasi pengembalian dana manual.',
      },
      { status: 400 }
    );
  }
}
