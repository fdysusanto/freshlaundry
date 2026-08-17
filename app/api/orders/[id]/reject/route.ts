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
    const reason = body.reason || 'Pesanan ditolak oleh Mitra Laundry.';

    const authHeader = request.headers.get('authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

    let userId = body.userId || 'usr_owner_01';
    let role = body.role || 'laundry_owner';
    let laundryId = body.laundryId;

    if (token) {
      const userClient = createAuthenticatedClient(token);
      const authClient = userClient || supabase;
      if (authClient) {
        const { data: { user } } = await authClient.auth.getUser(token);
        if (user) {
          userId = user.id;
          const { data: profile } = await (authClient.from('profiles') as any)
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile?.role) role = profile.role;
        }
      }
    }

    const updatedOrder = await orderService.rejectOrderAsync(
      orderId,
      { id: userId, role, laundryId },
      reason
    );

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menolak pesanan.' },
      { status: 400 }
    );
  }
}
