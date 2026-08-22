import { NextResponse } from 'next/server';
import { paymentService } from '@/services/paymentService';
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
        { success: false, message: 'Autentikasi Gagal: Token autentikasi (Bearer token) tidak ditemukan dalam request header.' },
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

    // 1. Authoritative User Verification
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Autentikasi Gagal: Sesi pengguna tidak valid atau telah kadaluarsa.' },
        { status: 401 }
      );
    }

    // 2. Authoritative Order Ownership Check
    const order = await orderService.getOrderByIdAsync(orderId, userClient || undefined);
    if (!order) {
      return NextResponse.json(
        { success: false, message: `Pesanan dengan ID '${orderId}' tidak ditemukan.` },
        { status: 404 }
      );
    }

    if (order.customerId !== user.id) {
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Anda tidak memiliki akses ke pesanan ini.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || 'create';

    // Helper to get or auto-create adjustment attempt for overweight orders
    const getOrCreateAdjustmentAttemptAsync = async () => {
      let pendingAdj = await paymentService.getPendingAdjustmentPaymentAttemptAsync(
        orderId,
        userClient || undefined
      );

      if (!pendingAdj && order.finalWeightKg && order.estimatedWeightKg && order.finalWeightKg > order.estimatedWeightKg) {
        const estimatedWeight = Number(order.estimatedWeightKg) || 5;
        const unitPrice = Number(order.items[0]?.unitPrice) || 8000;
        const estimatedTotal = Math.round((estimatedWeight * unitPrice) + (Number(order.deliveryFee) || 0) + (Number(order.platformFee) || 2000) - (Number(order.discount) || 0));
        const actualSubtotal = Math.round(Number(order.finalWeightKg) * unitPrice);
        const newTotalPrice = Math.round(actualSubtotal + (Number(order.deliveryFee) || 0) + (Number(order.platformFee) || 2000) - (Number(order.discount) || 0));
        const priceDelta = newTotalPrice - estimatedTotal;

        if (priceDelta > 0) {
          const { createServiceRoleClient, isSupabaseConfigured } = await import('@/services/supabase');
          const serviceDb = isSupabaseConfigured ? createServiceRoleClient() : undefined;
          pendingAdj = await paymentService.createAdjustmentPaymentAttemptAsync(orderId, priceDelta, serviceDb);
        }
      }
      return pendingAdj;
    };

    // ACTION: Customer Requesting Price Adjustment Payment Attempt Retrieval / Creation
    if (action === 'create_adjustment') {
      const pendingAdj = await getOrCreateAdjustmentAttemptAsync();

      if (!pendingAdj) {
        return NextResponse.json(
          { success: false, message: 'Tidak ada kekurangan pembayaran selisih yang harus dibayar untuk pesanan ini.' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, payment: pendingAdj });
    }

    // ACTION: Customer Requesting Payment Attempt Creation / Retrieval
    if (action === 'create') {
      if (order.paymentStatus === 'paid') {
        const pendingAdj = await getOrCreateAdjustmentAttemptAsync();
        if (pendingAdj) {
          return NextResponse.json({ success: true, payment: pendingAdj });
        }
      }

      const payment = await paymentService.createPaymentAttemptAsync(
        orderId,
        body.paymentMethod || 'qris',
        body.clientSuppliedAmount,
        userClient || undefined
      );
      return NextResponse.json({ success: true, payment });
    }

    // ACTION: Development / Demo Payment Confirmation Simulation
    // Customers cannot directly trigger 'confirm' on Production. Only allowed in non-production or test simulation mode.
    if (action === 'confirm' || action === 'fail') {
      const isProd = process.env.NODE_ENV === 'production';
      if (isProd) {
        return NextResponse.json(
          {
            success: false,
            message: 'Akses Ditolak: Konfirmasi pembayaran langsung dari customer tidak diizinkan pada lingkungan produksi. Pembayaran harus melalui Webhook resmi Payment Gateway.',
          },
          { status: 403 }
        );
      }

      const paymentId = body.paymentId || orderId;

      if (action === 'confirm') {
        const payment = await paymentService.handlePaymentSuccessAsync(paymentId, body.providerReference, userClient || undefined);
        return NextResponse.json({ success: true, payment });
      }

      if (action === 'fail') {
        const payment = await paymentService.handlePaymentFailureAsync(paymentId, body.reason, userClient || undefined);
        return NextResponse.json({ success: true, payment });
      }
    }

    return NextResponse.json(
      { success: false, message: `Aksi pembayaran '${action}' tidak dikenal.` },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memproses pembayaran.' },
      { status: 400 }
    );
  }
}
