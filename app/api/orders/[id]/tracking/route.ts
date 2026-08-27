import { NextResponse } from 'next/server';
import { orderService } from '@/services/orderService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trackingOrId } = await params;
    const order = await orderService.getOrderByIdAsync(trackingOrId);

    if (!order) {
      return NextResponse.json(
        { success: false, message: `Order dengan ID/Resi '${trackingOrId}' tidak ditemukan.` },
        { status: 404 }
      );
    }

    const trackingData = {
      trackingNumber: order.trackingNumber,
      laundryName: order.laundryName,
      serviceName: order.serviceName,
      status: order.status,
      paymentStatus: order.paymentStatus,
      pickupDate: order.pickupDate,
      pickupTimeSlot: order.pickupTimeSlot,
      deliveryDate: order.deliveryDate,
      deliveryTimeSlot: order.deliveryTimeSlot,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      logs: order.logs,
    };

    return NextResponse.json({ success: true, tracking: trackingData });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengambil data tracking order.' },
      { status: 500 }
    );
  }
}
