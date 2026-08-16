import { NextResponse } from 'next/server';
import { checkoutService, CreateCheckoutInput } from '@/services/checkoutService';
import { authService } from '@/services/authService';
import { supabase, createAuthenticatedClient, isSupabaseConfigured } from '@/services/supabase';
import { UserProfile, UserRole } from '@/types/user';

export async function POST(request: Request) {
  try {
    const body: CreateCheckoutInput = await request.json();

    let customer: UserProfile | null = null;
    let userClient = null;

    if (isSupabaseConfigured && supabase) {
      const authHeader = request.headers.get('authorization');
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

      if (!token) {
        return NextResponse.json(
          { success: false, message: 'Autentikasi Gagal: Token autentikasi (Bearer token) tidak ditemukan dalam request header.' },
          { status: 401 }
        );
      }

      // Create authenticated Supabase client scoped to customer's Bearer JWT token
      userClient = createAuthenticatedClient(token);
      const authClient = userClient || supabase;

      // Authoritative Server-Side User Validation using Supabase Auth JWT token
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user) {
        return NextResponse.json(
          { success: false, message: 'Autentikasi Gagal: Sesi pengguna tidak valid atau telah kadaluarsa.' },
          { status: 401 }
        );
      }

      // Fetch user profile securely using authenticated user.id
      const { data: profile } = await (authClient.from('profiles') as any)
        .select('*')
        .eq('id', user.id)
        .single();

      const activeRole = (profile?.role || user.user_metadata?.role || 'customer') as UserRole;

      customer = {
        id: user.id, // Strictly derived from validated Auth Token!
        email: profile?.email || user.email || '',
        fullName: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer',
        phone: profile?.phone || user.user_metadata?.phone || '',
        role: activeRole,
        avatarUrl: profile?.avatar_url || undefined,
        address: profile?.address || undefined,
        createdAt: profile?.created_at || user.created_at || new Date().toISOString(),
      };
    } else {
      customer = authService.getCurrentUserSync();
    }

    if (!customer || customer.role !== 'customer') {
      return NextResponse.json(
        { success: false, message: 'Akses Ditolak: Hanya akun dengan peran Customer yang dapat membuat pesanan.' },
        { status: 403 }
      );
    }

    // Pass authenticated userClient to checkoutService so Authorization header persists
    const result = await checkoutService.processCheckoutAsync(body, customer, userClient || undefined);
    return NextResponse.json(result, { status: result.isDuplicate ? 200 : 201 });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Gagal memproses checkout pesanan.';
    return NextResponse.json(
      { success: false, message: errMessage },
      { status: 400 }
    );
  }
}
