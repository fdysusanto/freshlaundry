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

      if (userRole !== 'laundry_owner' && userRole !== 'laundry_staff' && userRole !== 'admin') {
        return NextResponse.json(
          { success: false, message: 'Akses Ditolak: Hanya Mitra Laundry / Staff / Admin yang dapat menginput berat aktual.' },
          { status: 403 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const rawWeight = Number(body.finalWeightKg);

    if (isNaN(rawWeight) || !isFinite(rawWeight) || rawWeight <= 0) {
      return NextResponse.json(
        { success: false, message: 'Validasi Gagal: finalWeightKg harus berupa angka > 0 kg.' },
        { status: 400 }
      );
    }

    const parsedWeight = Math.round(rawWeight * 100) / 100;

    // Removed createServiceRoleClient to adhere to RLS policies and not bypass them

    const order = await orderService.getOrderByIdAsync(orderId, authClient || undefined);
    if (!order) {
      return NextResponse.json(
        { success: false, message: `Pesanan dengan ID '${orderId}' tidak ditemukan.` },
        { status: 404 }
      );
    }

    const res = await orderService.updateActualWeightAndRecalculatePriceAsync(
      orderId,
      parsedWeight,
      {
        id: userId,
        role: userRole,
        laundryId: order.laundryId,
      },
      authClient || undefined
    );

    return NextResponse.json({
      success: true,
      order: res.order,
      priceDelta: res.priceDelta,
      adjustmentPaymentAttempt: res.adjustmentPaymentAttempt,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memperbarui penimbangan berat aktual.' },
      { status: 400 }
    );
  }
}
