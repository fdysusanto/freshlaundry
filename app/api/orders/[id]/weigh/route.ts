import { NextResponse } from 'next/server';
import { orderService } from '@/services/orderService';
import { createAuthenticatedClient, createServiceRoleClient, isSupabaseConfigured, supabase } from '@/services/supabase';
import { UserRole } from '@/types/user';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const authHeader = request.headers.get('authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

    if (!token && isSupabaseConfigured) {
      return NextResponse.json(
        { success: false, message: 'Autentikasi Gagal: Token autentikasi (Bearer token) tidak ditemukan dalam request header.' },
        { status: 401 }
      );
    }

    const userClient = token ? createAuthenticatedClient(token) : null;
    const authClient = userClient || supabase;

    let userId = 'usr_system';
    let userRole: UserRole = 'laundry_owner';

    if (isSupabaseConfigured && authClient && token) {
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user) {
        return NextResponse.json(
          { success: false, message: 'Autentikasi Gagal: Sesi pengguna tidak valid atau telah kadaluarsa.' },
          { status: 401 }
        );
      }
      userId = user.id;

      // Fetch authoritative profile role & laundry_id from database
      const { data: profile } = await (authClient.from('profiles') as any)
        .select('role, laundry_id')
        .eq('id', user.id)
        .single();

      if (profile) {
        userRole = profile.role as UserRole;
      }

      if (userRole !== 'laundry_owner' && userRole !== 'laundry_staff' && userRole !== 'admin' && userRole !== 'courier') {
        return NextResponse.json(
          { success: false, message: 'Akses Ditolak: Hanya Mitra Laundry / Staff / Courier / Admin yang dapat menginput berat aktual.' },
          { status: 403 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const rawWeight = Number(body.finalWeightKg ?? body.weight ?? body.courierWeightKg);
    const action = body.action || (userRole === 'courier' ? 'preliminary' : 'finalize');

    if (isNaN(rawWeight) || !isFinite(rawWeight) || rawWeight <= 0) {
      return NextResponse.json(
        { success: false, message: 'Validasi Gagal: Berat harus berupa angka > 0 kg.' },
        { status: 400 }
      );
    }

    if (rawWeight > 50.0) {
      return NextResponse.json(
        { success: false, message: 'Validasi Berat Gagal: Berat maksimal adalah 50 kg per pesanan.' },
        { status: 400 }
      );
    }

    const parsedWeight = Math.round(rawWeight * 100) / 100;

    const order = await orderService.getOrderByIdAsync(orderId, authClient || undefined);
    if (!order) {
      return NextResponse.json(
        { success: false, message: `Pesanan dengan ID '${orderId}' tidak ditemukan.` },
        { status: 404 }
      );
    }

    if (userRole === 'courier' && order.courierId !== userId) {
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Anda hanya dapat menimbang pesanan yang ditugaskan kepada Anda.' },
        { status: 403 }
      );
    }

    if (action === 'preliminary' || userRole === 'courier') {
      if (order.status !== 'assigned' && order.status !== 'picked_up') {
        return NextResponse.json(
          { success: false, message: 'Berat awal kurir belum dapat dicatat pada status pesanan saat ini.' },
          { status: 400 }
        );
      }

      const res = await orderService.saveCourierPreliminaryWeightAsync(
        orderId,
        parsedWeight,
        body.notes,
        authClient || undefined
      );

      return NextResponse.json({
        success: true,
        mode: 'preliminary',
        order: res.order,
        courierWeightKg: res.courierWeightKg,
      });
    }

    if (order.status !== 'picked_up') {
      return NextResponse.json(
        { success: false, message: 'Berat final laundry hanya dapat diverifikasi setelah pesanan dijemput kurir.' },
        { status: 400 }
      );
    }

    const res = await orderService.finalizeLaundryWeightAsync(
      orderId,
      parsedWeight,
      body.notes,
      authClient || undefined
    );

    return NextResponse.json({
      success: true,
      mode: 'finalized',
      order: res.order,
      priceDelta: res.priceDelta,
      adjustmentPaymentAttempt: res.adjustmentPaymentAttempt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memperbarui penimbangan berat.' },
      { status: 400 }
    );
  }
}
