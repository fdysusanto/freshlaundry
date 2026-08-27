import { NextResponse } from 'next/server';
import { orderService } from '@/services/orderService';
import { createAuthenticatedClient, isSupabaseConfigured, supabase } from '@/services/supabase';
import { UserRole } from '@/types/user';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json().catch(() => ({}));
    const courierId = body.courierId || 'usr_courier_01';
    const courierName = body.courierName || 'Budi Kurir';

    // 1. Authenticate & resolve server-side user role (Do NOT trust client body)
    const authHeader = request.headers.get('authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

    let callerRole: UserRole | string = body.role || 'customer';
    let callerId: string = body.updatedByUserId || 'usr_system';

    if (token && isSupabaseConfigured) {
      const userClient = createAuthenticatedClient(token);
      const authClient = userClient || supabase;
      if (authClient) {
        const { data: { user } } = await authClient.auth.getUser(token);
        if (user) {
          callerId = user.id;
          const { data: profile } = await (authClient.from('profiles') as any).select('role').eq('id', user.id).maybeSingle();
          if (profile) {
            callerRole = profile.role;
          }
        }
      }
    }

    if (callerRole !== 'platform_admin') {
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Hanya platform administrator yang dapat mengelola penugasan kurir.' },
        { status: 403 }
      );
    }

    const updatedOrder = await orderService.assignCourierAsync(
      orderId,
      courierId,
      courierName,
      callerId,
      { id: callerId, role: callerRole }
    );

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal menugaskan kurir.' },
      { status: 400 }
    );
  }
}
