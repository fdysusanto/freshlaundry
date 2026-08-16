import { NextResponse } from 'next/server';
import { orderService } from '@/services/orderService';
import { UserRole } from '@/types/user';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const targetStatus = body.targetStatus;
    const notes = body.notes || '';
    const userId = body.userId || 'usr_system';
    const role: UserRole = body.role || 'customer';
    const laundryId = body.laundryId;

    if (!targetStatus) {
      return NextResponse.json(
        { success: false, message: 'Validasi Gagal: targetStatus wajib diisi.' },
        { status: 400 }
      );
    }

    const updatedOrder = await orderService.transitionOrderStatusAsync(
      orderId,
      targetStatus,
      { id: userId, role, laundryId },
      notes
    );

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memproses transisi status order.' },
      { status: 400 }
    );
  }
}
