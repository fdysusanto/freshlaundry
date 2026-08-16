import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { orderService } from '@/services/orderService';
import { authService } from '@/services/authService';

export async function GET(request: Request) {
  try {
    let isPlatformAdmin = false;
    let authUserId: string | null = null;
    let isUnauthenticated = false;

    if (isSupabaseConfigured && supabase) {
      // 1. Extract Authorization Bearer Token from HTTP Request Headers
      const authHeader = request.headers.get('authorization') || '';
      let accessToken = '';

      if (authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7).trim();
      }

      // Fallback to active session if token header is missing
      if (!accessToken) {
        const { data: { session } } = await supabase.auth.getSession();
        accessToken = session?.access_token || '';
      }

      if (!accessToken) {
        isUnauthenticated = true;
      } else {
        // 2. Authoritatively verify access token with Supabase Auth
        const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

        if (userError || !userData?.user) {
          isUnauthenticated = true;
        } else {
          authUserId = userData.user.id;

          // 3. Create Server-Side Supabase Admin Client using Service Role Key for profile verification
          const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

          const profileClient = serviceRoleKey
            ? createClient(supabaseUrl, serviceRoleKey, {
                auth: { autoRefreshToken: false, persistSession: false },
              })
            : supabase;

          // 4. Query public.profiles using verified authenticated user.id
          const { data: profile } = await (profileClient.from('profiles') as any)
            .select('role')
            .eq('id', authUserId)
            .single();

          if (profile && profile.role === 'platform_admin') {
            isPlatformAdmin = true;
          }
        }
      }
    } else {
      // In local dev/mock mode, check current active user role via authService
      const currentUser = authService.getCurrentUser();
      if (currentUser && currentUser.role === 'platform_admin') {
        isPlatformAdmin = true;
      }
    }

    if (isUnauthenticated) {
      return NextResponse.json(
        {
          success: false,
          message: 'Tidak Terotentikasi: Sesi atau token otentikasi tidak ditemukan.',
        },
        { status: 401 }
      );
    }

    if (!isPlatformAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: 'Akses Ditolak: Hanya Platform Admin yang berhak mengumpulkan data seluruh transaksi.',
        },
        { status: 403 }
      );
    }

    const orders = await orderService.getAllOrdersAsync();

    return NextResponse.json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal mengambil data transaksi admin dari Supabase.',
      },
      { status: 500 }
    );
  }
}
