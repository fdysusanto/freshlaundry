import { NextResponse } from 'next/server';
import { orderService } from '@/services/orderService';
import { createAuthenticatedClient, supabase } from '@/services/supabase';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const assignmentId = body.assignmentId || orderId;

    const authHeader = request.headers.get('authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

    let courierId = body.courierId || 'usr_courier_01';

    if (token) {
      const userClient = createAuthenticatedClient(token);
      const authClient = userClient || supabase;
      if (authClient) {
        const { data: { user } } = await authClient.auth.getUser(token);
        if (user) courierId = user.id;
      }
    }

    const updatedOrder = await orderService.acceptCourierAssignmentAsync(assignmentId, courierId);

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal mengonfirmasi penerimaan tugas kurir.' },
      { status: 400 }
    );
  }
}
