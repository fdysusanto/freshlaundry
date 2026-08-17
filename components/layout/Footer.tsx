'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { UserProfile } from '@/types/user';
import { Sparkles, Phone, Mail, MapPin, Clock, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      if (isSupabaseConfigured) {
        const profile = await authService.fetchCurrentProfile();
        if (isMounted) setCurrentUser(profile);
      } else {
        if (isMounted) setCurrentUser(authService.getCurrentUserSync());
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const role = currentUser?.role;

  return (
    <footer className="bg-slate-900 text-slate-300 pt-12 pb-20 md:pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Col 1: Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xl font-black text-white tracking-tight">FreshWash</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Layanan laundry pickup & delivery profesional, cepat, higienis, dan terpercaya. Pakaian bersih wangi tanpa keluar rumah!
            </p>
            <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Garansi Cuci Ulang Gratis 100%</span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Navigasi</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/" className="hover:text-teal-400 transition-colors">
                  Beranda
                </Link>
              </li>
              {(!role || role === 'customer') && (
                <>
                  <li>
                    <Link href="/customer/laundries" className="hover:text-teal-400 transition-colors">
                      Cari Laundry
                    </Link>
                  </li>
                  {role === 'customer' && (
                    <li>
                      <Link href="/customer" className="hover:text-teal-400 transition-colors">
                        Customer Dashboard
                      </Link>
                    </li>
                  )}
                </>
              )}
              {role === 'courier' && (
                <li>
                  <Link href="/courier" className="hover:text-teal-400 transition-colors">
                    Kurir Portal
                  </Link>
                </li>
              )}
              {(role === 'laundry_owner' || role === 'laundry_staff') && (
                <li>
                  <Link href="/owner" className="hover:text-teal-400 transition-colors">
                    Owner Dashboard
                  </Link>
                </li>
              )}
              {(role === 'admin' || role === 'platform_admin') && (
                <>
                  <li>
                    <Link href="/admin" className="hover:text-teal-400 transition-colors">
                      Admin Monitoring
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin/partner-applications" className="hover:text-teal-400 transition-colors">
                      Verifikasi Laundry
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin/staff" className="hover:text-teal-400 transition-colors">
                      Manajemen Staff
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Col 3: Services */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Layanan Unggulan</h4>
            <ul className="space-y-2 text-xs">
              <li>Cuci Komplit Kiloan (Cuci + Setrika)</li>
              <li>Express 6 Jam (Prioritas Utama)</li>
              <li>Dry Cleaning Jas & Gaun</li>
              <li>Cuci Satuan Bedcover & Sepatu</li>
            </ul>
          </div>

          {/* Col 4: Contact & Hours */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Kontak & Jam Buka</h4>
            <ul className="space-y-2.5 text-xs">
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Harjamukti, Kota Cirebon</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-teal-400 shrink-0" />
                <span>0878-2995-0470</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-teal-400 shrink-0" />
                <span>fredysusanto16@gmail.com</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Setiap Hari: 07:00 - 21:00 WIB</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 FreshWash Laundry. Built for Supabase PostgreSQL & n8n Automation.</p>
          <div className="flex items-center gap-4">
            <span className="text-teal-400 font-medium">Supabase Ready</span>
            <span>•</span>
            <span className="text-amber-400 font-medium">n8n Automation Ready</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
