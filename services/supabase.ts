import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (typeof window !== 'undefined') {
  console.log('[SUPABASE-DIAGNOSTIC] Environment configured status:', {
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseAnonKey),
    isConfigured: isSupabaseConfigured,
  });
}

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Creates an authenticated Supabase client instance scoped to a specific customer's Bearer JWT access token.
 * Passes Authorization: Bearer <accessToken> in global headers so PostgreSQL engine receives auth.uid().
 */
export function createAuthenticatedClient(accessToken: string): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    return supabase;
  }
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Creates a server-side Supabase client instance using the SUPABASE_SERVICE_ROLE_KEY.
 * Exclusively used for out-of-band server tasks such as Payment Webhook processing.
 * Must NEVER be called or exposed on the client-side (browser).
 */
export function createServiceRoleClient(): SupabaseClient<Database> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl) {
    throw new Error('Supabase URL is not configured (NEXT_PUBLIC_SUPABASE_URL is missing).');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured in environment variables.');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
