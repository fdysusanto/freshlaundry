import { UserProfile, UserRole } from '@/types/user';
import { DEMO_USERS } from '@/utils/constants';
import { isValidUuid } from '@/utils/formatters';
import { supabase, isSupabaseConfigured } from './supabase';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';

const AUTH_STORAGE_KEY = 'fresh_laundry_auth_user';

export const authService = {
  /**
   * Mengambil profil pengguna terautentikasi secara asynchronous dari Supabase Auth & Database Profile.
   */
  async fetchCurrentProfile(): Promise<UserProfile | null> {
    if (!isSupabaseConfigured || !supabase) {
      return this.getCurrentUserSync();
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (typeof window !== 'undefined') {
        console.log('[AUTH-SERVICE] fetchCurrentProfile session check:', {
          isSupabaseConfigured,
          hasSessionUser: Boolean(session?.user),
          sessionUserIdPrefix: session?.user?.id ? session.user.id.slice(0, 8) + '...' : null,
          isUuidValid: session?.user?.id ? isValidUuid(session.user.id) : false,
        });
      }

      if (sessionError || !session?.user) {
        return null;
      }

      const userId = session.user.id;
      const { data: profile, error: profileError } = await (supabase.from('profiles') as any)
        .select('*')
        .eq('id', userId)
        .single();

      const activeRole = (profile?.role || session.user.user_metadata?.role || 'customer') as UserRole;

      if (typeof window !== 'undefined') {
        console.log('[ROLE-AUTH-DIAGNOSTIC]', {
          sessionUserId: userId,
          profileRole: activeRole,
          source: 'supabase_auth',
          isSupabaseAuth: true,
          isMockUser: false,
        });
      }

      if (profileError || !profile) {
        const fallbackUser: UserProfile = {
          id: userId,
          email: session.user.email || '',
          fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          phone: session.user.user_metadata?.phone || '',
          role: activeRole,
          createdAt: session.user.created_at || new Date().toISOString(),
        };
        this.setCurrentUserSync(fallbackUser);
        return fallbackUser;
      }

      const activeUser: UserProfile = {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        phone: profile.phone,
        role: profile.role as UserRole,
        avatarUrl: profile.avatar_url || undefined,
        address: profile.address || undefined,
        createdAt: profile.created_at,
      };

      this.setCurrentUserSync(activeUser);
      return activeUser;
    } catch {
      if (isSupabaseConfigured) return null;
      return this.getCurrentUserSync();
    }
  },

  /**
   * Getter sinkronus untuk kompatibilitas antarmuka UI.
   */
  getCurrentUserSync(): UserProfile {
    if (typeof window === 'undefined') return DEMO_USERS[0];
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (isSupabaseConfigured) {
          if (parsed && isValidUuid(parsed.id)) {
            return parsed;
          } else {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        } else {
          return parsed;
        }
      } catch {}
    }

    return {
      id: '',
      email: '',
      fullName: '',
      phone: '',
      role: 'customer',
      createdAt: new Date().toISOString(),
    };
  },

  getCurrentUser(): UserProfile {
    return this.getCurrentUserSync();
  },

  setCurrentUserSync(user: UserProfile): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    }
  },

  setCurrentUser(user: UserProfile): void {
    this.setCurrentUserSync(user);
  },

  switchRole(role: UserRole): UserProfile {
    if (isSupabaseConfigured) {
      return this.getCurrentUserSync();
    }
    const found = DEMO_USERS.find((u) => u.role === role) || DEMO_USERS[0];
    this.setCurrentUserSync(found);
    return found;
  },

  /**
   * Real Supabase Auth Login.
   */
  async loginAsync(email: string, password?: string, preferredRole: UserRole = 'customer'): Promise<UserProfile> {
    if (isSupabaseConfigured) {
      if (!password) {
        throw new Error('Validasi Gagal: Kata sandi wajib diisi.');
      }
      if (!supabase) {
        throw new Error('Koneksi Supabase belum terkonfigurasi.');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(`Login Gagal: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('Login Gagal: Pengguna tidak ditemukan.');
      }

      const profile = await this.fetchCurrentProfile();
      if (!profile) {
        throw new Error('Login Gagal: Gagal memuat profil pengguna dari database.');
      }

      if (typeof window !== 'undefined') {
        console.log('[AUTH-LIVE-DIAGNOSTIC]', {
          source: 'supabase_auth',
          authenticated: true,
          userIdIsUuid: isValidUuid(profile.id),
          profileLoaded: true,
          role: profile.role,
        });
      }

      return profile;
    }

    return this.loginSync(email, preferredRole);
  },

  loginSync(email: string, role: UserRole = 'customer'): UserProfile {
    const existing = DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      this.setCurrentUserSync(existing);
      return existing;
    }

    const newUser: UserProfile = {
      id: `usr_${Date.now()}`,
      email,
      fullName: email.split('@')[0].replace('.', ' '),
      phone: '0812' + Math.floor(10000000 + Math.random() * 90000000),
      role,
      createdAt: new Date().toISOString(),
    };
    this.setCurrentUserSync(newUser);
    return newUser;
  },

  login(email: string, role: UserRole = 'customer'): UserProfile {
    return this.loginSync(email, role);
  },

  /**
   * Real Supabase Auth Request Password Reset Email.
   */
  async resetPasswordForEmailAsync(email: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Koneksi Supabase belum terkonfigurasi.');
    }

    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/reset-password`
      : 'http://localhost:3000/reset-password';

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });

    if (error) {
      throw new Error(`Gagal mengirim email reset password: ${error.message}`);
    }

    if (typeof window !== 'undefined') {
      console.log('[AUTH-RESET-DIAGNOSTIC]', {
        source: 'supabase_auth',
        action: 'password_reset_request',
        emailProvided: true,
      });
    }
  },

  /**
   * Real Supabase Auth Update Password (for Password Recovery Flow).
   */
  async updatePasswordAsync(newPassword: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Koneksi Supabase belum terkonfigurasi.');
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(`Gagal memperbarui password: ${error.message}`);
    }

    if (typeof window !== 'undefined') {
      console.log('[AUTH-PASSWORD-UPDATE-DIAGNOSTIC]', {
        source: 'supabase_auth',
        authenticated: true,
        action: 'password_update',
      });
    }
  },

  /**
   * Real Supabase Auth Register dengan Synchronisasi Profil Database.
   * Peran pendaftaran publik dikunci secara ketat ke 'customer' untuk mencegah role escalation.
   */
  async registerAsync(
    fullName: string,
    email: string,
    password?: string,
    phone?: string,
    address?: string
  ): Promise<UserProfile> {
    const res = await this.registerPartnerAsync(fullName, email, password, phone, address);
    return res.user;
  },

  /**
   * Special Registration method for Partner Applications returning detailed session state.
   */
  async registerPartnerAsync(
    fullName: string,
    email: string,
    password?: string,
    phone?: string,
    address?: string
  ): Promise<{ user: UserProfile; hasSession: boolean; requiresEmailConfirmation: boolean }> {
    if (!isSupabaseConfigured || !supabase || !password) {
      const fallback = this.registerSync(fullName, email, phone || '', 'customer', address);
      return { user: fallback, hasSession: false, requiresEmailConfirmation: false };
    }

    const assignedRole: UserRole = 'customer';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || '',
          role: assignedRole,
        },
      },
    });

    if (error) {
      throw new Error(`Pendaftaran Gagal: ${error.message}`);
    }

    if (!data.user) {
      throw new Error('Pendaftaran Gagal: Pengguna tidak dapat dibuat.');
    }

    const userId = data.user.id;
    const hasSession = Boolean(data.session);

    // Synchronize row into public.profiles
    const { error: profileError } = await (supabase.from('profiles') as any).upsert({
      id: userId,
      email,
      full_name: fullName,
      phone: phone || '',
      address: address || null,
      role: assignedRole,
    });

    if (typeof window !== 'undefined') {
      console.log('[PARTNER-AUTH-DIAGNOSTIC]', {
        signupUserExists: Boolean(data.user),
        signupSessionExists: hasSession,
        userIdIsUuid: isValidUuid(userId),
        profileExists: !profileError,
        profileRole: assignedRole,
      });
    }

    const newProfile: UserProfile = {
      id: userId,
      email,
      fullName,
      phone: phone || '',
      role: assignedRole,
      address,
      createdAt: new Date().toISOString(),
    };

    if (hasSession) {
      this.setCurrentUserSync(newProfile);
    }

    return {
      user: newProfile,
      hasSession,
      requiresEmailConfirmation: !hasSession,
    };
  },

  registerSync(fullName: string, email: string, phone: string, role: UserRole, address?: string): UserProfile {
    const newUser: UserProfile = {
      id: `usr_${Date.now()}`,
      email,
      fullName,
      phone,
      role: 'customer',
      address,
      createdAt: new Date().toISOString(),
    };
    this.setCurrentUserSync(newUser);
    return newUser;
  },

  register(fullName: string, email: string, phone: string, role: UserRole, address?: string): UserProfile {
    return this.registerSync(fullName, email, phone, role, address);
  },

  /**
   * Real Supabase Auth Logout.
   */
  async logoutAsync(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        if (typeof window !== 'undefined') {
          console.log('[AUTH-LOGOUT]', {
            success: false,
            source: 'supabase_auth',
            error: error.message,
          });
        }
        throw new Error(`Logout Gagal: ${error.message}`);
      }

      if (typeof window !== 'undefined') {
        console.log('[AUTH-LOGOUT]', {
          success: true,
          source: 'supabase_auth',
          error: null,
        });
      }
    }
    this.logoutSync();
  },

  async signOut(): Promise<void> {
    return this.logoutAsync();
  },

  logoutSync(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  },

  logout(): void {
    this.logoutSync();
  },

  /**
   * Ambil sesi aktif Supabase Auth.
   */
  async getSession(): Promise<Session | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  /**
   * Subscribe ke perubahan status autentikasi Supabase.
   */
  subscribeToAuthChanges(callback: (user: UserProfile | null) => void) {
    if (!isSupabaseConfigured || !supabase) {
      return { unsubscribe: () => {} };
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          const profile = await this.fetchCurrentProfile();
          callback(profile);
        } else {
          this.logoutSync();
          callback(null);
        }
      }
    );

    return subscription;
  },
};
