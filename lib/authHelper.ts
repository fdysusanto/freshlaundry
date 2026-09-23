import { createClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { authService } from '@/services/authService';

export interface AuthCheckResult {
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
  userId: string | null;
  role: string | null;
  accessToken?: string | null;
}

export async function verifyAdminAuth(request: Request): Promise<AuthCheckResult> {
  const authHeader = request.headers.get('authorization') || '';
  let accessToken = '';

  if (authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7).trim();
  }

  if (!isSupabaseConfigured || !supabase) {
    if (authHeader.startsWith('Bearer mock_admin_token')) {
      return { isAuthenticated: true, isPlatformAdmin: true, userId: 'usr_admin_1', role: 'platform_admin', accessToken: 'mock_admin_token' };
    }
    if (authHeader.startsWith('Bearer mock_customer_token')) {
      return { isAuthenticated: true, isPlatformAdmin: false, userId: 'usr_customer_1', role: 'customer', accessToken: 'mock_customer_token' };
    }
    if (authHeader.startsWith('Bearer mock_courier_token')) {
      return { isAuthenticated: true, isPlatformAdmin: false, userId: 'usr_courier_1', role: 'courier', accessToken: 'mock_courier_token' };
    }
    if (authHeader.startsWith('Bearer mock_owner_token')) {
      return { isAuthenticated: true, isPlatformAdmin: false, userId: 'usr_owner_1', role: 'laundry_owner', accessToken: 'mock_owner_token' };
    }
    if (authHeader.startsWith('Bearer invalid_token')) {
      return { isAuthenticated: false, isPlatformAdmin: false, userId: null, role: null, accessToken: null };
    }
    if (!authHeader) {
      return { isAuthenticated: false, isPlatformAdmin: false, userId: null, role: null, accessToken: null };
    }

    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      const isAdmin = currentUser.role === 'platform_admin' || currentUser.role === 'admin';
      return {
        isAuthenticated: true,
        isPlatformAdmin: isAdmin,
        userId: currentUser.id,
        role: currentUser.role,
        accessToken: accessToken || null,
      };
    }
    return { isAuthenticated: false, isPlatformAdmin: false, userId: null, role: null, accessToken: null };
  }

  if (!accessToken) {
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token || '';
  }

  if (!accessToken) {
    return { isAuthenticated: false, isPlatformAdmin: false, userId: null, role: null, accessToken: null };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return { isAuthenticated: false, isPlatformAdmin: false, userId: null, role: null, accessToken: null };
  }

  const userId = userData.user.id;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  const client = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : supabase;

  const { data: profile } = await (client.from('profiles') as any)
    .select('role')
    .eq('id', userId)
    .single();

  const role = profile?.role || null;
  const isPlatformAdmin = role === 'platform_admin' || role === 'admin';

  return {
    isAuthenticated: true,
    isPlatformAdmin,
    userId,
    role,
    accessToken,
  };
}
