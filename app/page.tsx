'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { CuciyanHero } from '@/components/landing/CuciyanHero';
import { CuciyanHowItWorks } from '@/components/landing/CuciyanHowItWorks';
import { CuciyanPartnerSection } from '@/components/landing/CuciyanPartnerSection';

export default function LandingPage() {
  const router = useRouter();

  // Role Guard: Redirect active non-customer operational users to their respective dashboards
  useEffect(() => {
    let isMounted = true;
    const checkRoleGuard = async () => {
      let currentRole: string | undefined;
      if (isSupabaseConfigured) {
        const liveProfile = await authService.fetchCurrentProfile();
        currentRole = liveProfile?.role;
      } else {
        const syncUser = authService.getCurrentUserSync();
        currentRole = syncUser?.role;
      }

      if (currentRole && currentRole !== 'customer') {
        if (isMounted) {
          if (currentRole === 'courier') router.push('/courier');
          else if (currentRole === 'laundry_owner' || currentRole === 'laundry_staff') router.push('/owner');
          else if (currentRole === 'admin' || currentRole === 'platform_admin') router.push('/admin');
        }
      }
    };
    checkRoleGuard();
    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-white">
      {/* SECTION 1: HERO */}
      <CuciyanHero />

      {/* SECTION 2: CARA KERJA CUCIYAN */}
      <div id="layanan">
        <CuciyanHowItWorks />
      </div>

      {/* SECTION 3: PARTNER SECTION */}
      <div id="mitra">
        <CuciyanPartnerSection />
      </div>
    </main>
  );
}



