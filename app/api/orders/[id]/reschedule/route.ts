import { NextResponse } from 'next/server';
import { orderService } from '@/services/orderService';
import { createAuthenticatedClient, supabase } from '@/services/supabase';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Autentikasi Gagal: Anda harus login untuk mengubah jadwal pesanan.' },
        { status: 401 }
      );
    }

    const userClient = createAuthenticatedClient(token);
    const authClient = userClient || supabase;

    if (!authClient) {
      return NextResponse.json(
        { success: false, message: 'Layanan database tidak tersedia.' },
        { status: 500 }
      );
    }

    // 1. Authoritative Server-Side User Verification
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Autentikasi Gagal: Sesi pengguna tidak valid atau telah kadaluarsa.' },
        { status: 401 }
      );
    }

    // 2. Parse and Validate Request Payload
    const body = await request.json().catch(() => ({}));
    const { pickupDate, pickupTimeSlot, deliveryDate, deliveryTimeSlot } = body;

    if (!pickupDate && !pickupTimeSlot && !deliveryDate && !deliveryTimeSlot) {
      return NextResponse.json(
        { success: false, message: 'Validasi Gagal: Silakan masukkan jadwal penjemputan (pickup) atau pengantaran (delivery) baru.' },
        { status: 400 }
      );
    }

    // 3. Execute Reschedule in orderService
    const updatedOrder = await orderService.rescheduleOrderScheduleAsync(
      orderId,
      user.id,
      { pickupDate, pickupTimeSlot, deliveryDate, deliveryTimeSlot },
      authClient
    );

    return NextResponse.json({
      success: true,
      message: 'Jadwal pesanan berhasil diperbarui.',
      order: updatedOrder,
    });
  } catch (error: any) {
    const msg = error.message || 'Gagal mengubah jadwal pesanan.';

    if (msg.includes('Akses Ditolak')) {
      return NextResponse.json(
        { success: false, message: 'Anda tidak memiliki akses untuk mengubah pesanan ini.' },
        { status: 403 }
      );
    }

    if (msg.includes('CONCURRENCY_LOCK') || msg.includes('proses dispatch') || msg.includes('kurir sudah berjalan')) {
      return NextResponse.json(
        { success: false, message: 'Jadwal tidak dapat diubah karena proses dispatch sedang berjalan.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: msg },
      { status: 400 }
    );
  }
}
