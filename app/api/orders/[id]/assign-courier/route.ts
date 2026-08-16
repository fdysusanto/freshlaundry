import { NextResponse } from 'next/server';
import { orderService } from '@/services/orderService';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const courierId = body.courierId || 'usr_courier_01';
    const courierName = body.courierName || 'Budi Kurir';
    const updatedByUserId = body.updatedByUserId || 'usr_owner_01';

    const updatedOrder = await orderService.assignCourierAsync(
      orderId,
      courierId,
      courierName,
      updatedByUserId
    );

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menugaskan kurir.' },
      { status: 400 }
    );
  }
}
