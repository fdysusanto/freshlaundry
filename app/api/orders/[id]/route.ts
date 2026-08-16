import { NextResponse } from 'next/server';
import { orderService } from '@/services/orderService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const order = await orderService.getOrderByIdAsync(orderId);

    if (!order) {
      return NextResponse.json(
        { success: false, message: `Order '${orderId}' tidak ditemukan.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil data order.' },
      { status: 500 }
    );
  }
}
