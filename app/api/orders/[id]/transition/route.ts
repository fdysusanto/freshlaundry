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

    // 1. Authenticate user via JWT Bearer Token if present
    const authHeader = request.headers.get('authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

    let authenticatedUserId = userId;
    let authenticatedUserRole = role;
    let authenticatedLaundryId = laundryId;
    let userClient: any = null;

    if (token && isSupabaseConfigured) {
      userClient = createAuthenticatedClient(token);
      const authClient = userClient || supabase;
      if (authClient) {
        const { data: { user } } = await authClient.auth.getUser(token);
        if (user) {
          authenticatedUserId = user.id;
          const { data: profile } = await (authClient.from('profiles') as any).select('role, laundry_id').eq('id', user.id).maybeSingle();
          if (profile) {
            authenticatedUserRole = (profile.role as UserRole) || role;
            if (profile.laundry_id) authenticatedLaundryId = profile.laundry_id;
          }
        }
      }
    }

    // 2. Client selection: userClient for orders update (satisfying RLS/triggers for user auth), serviceDb as fallback
    const dbClient = userClient || (isSupabaseConfigured ? createServiceRoleClient() : undefined);

    const updatedOrder = await orderService.transitionOrderStatusAsync(
      orderId,
      targetStatus,
      { id: authenticatedUserId, role: authenticatedUserRole, laundryId: authenticatedLaundryId },
      notes,
      dbClient
    );

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Gagal memproses transisi status order.' },
      { status: 400 }
    );
  }
}
