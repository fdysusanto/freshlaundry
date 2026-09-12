'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { partnerApplicationService, PartnerApplicationRecord } from '@/services/partnerApplicationService';
import { laundryService } from '@/services/laundryService';
import { Laundry } from '@/types/laundry';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import {
  Store,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  Sparkles,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export default function OwnerBranchesPage() {
  const [applications, setApplications] = useState<PartnerApplicationRecord[]>([]);
  const [laundries, setLaundries] = useState<Laundry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        if (!isSupabaseConfigured || !supabase) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const [appsData, laundriesData] = await Promise.all([
          partnerApplicationService.getMyPartnerApplicationsAsync(),
          laundryService.getLaundriesByOwnerAsync(session.user.id),
        ]);

        setApplications(appsData);
        setLaundries(laundriesData);
      } catch (err) {
        console.error('Error loading owner branches data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const pendingApps = applications.filter((a) => a.status === 'pending');
  const rejectedApps = applications.filter((a) => a.status === 'rejected');

  return (
    <div className="min-h-screen bg-slate-50 pt-6 sm:pt-8 pb-32 sm:pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-brand-surface text-brand-primary flex items-center justify-center font-bold shrink-0 border border-brand-primary/20">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">Kelola Cabang & Pengajuan</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Daftar outlet laundry aktif dan riwayat pengajuan cabang usaha Anda.
              </p>
            </div>
          </div>

          <Link href="/owner/branches/create">
            <Button
              variant="primary"
              className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Cabang Baru</span>
            </Button>
          </Link>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cabang Aktif</span>
            <div className="text-2xl font-black text-slate-900 flex items-center justify-between">
              <span>{laundries.length}</span>
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Menunggu Verifikasi</span>
            <div className="text-2xl font-black text-amber-600 flex items-center justify-between">
              <span>{pendingApps.length}</span>
              <Clock className="w-6 h-6 text-amber-500" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs space-y-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pengajuan Ditolak</span>
            <div className="text-2xl font-black text-rose-600 flex items-center justify-between">
              <span>{rejectedApps.length}</span>
              <XCircle className="w-6 h-6 text-rose-500" />
            </div>
          </div>
        </div>

        {/* Section 1: Cabang Laundry Aktif */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-100 space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span>Cabang Laundry Aktif ({laundries.length})</span>
          </h2>

          {isLoading ? (
            <div className="py-8 text-center text-slate-400 animate-pulse text-sm">Memuat data cabang...</div>
          ) : laundries.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">Belum ada cabang laundry terdaftar.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {laundries.map((laundry) => (
                <div
                  key={laundry.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-3 hover:border-brand-primary/40 transition-all"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-brand-surface text-brand-primary text-[10px] font-black uppercase">
                        {laundry.code || 'LND'}
                      </span>
                      <h3 className="font-extrabold text-sm text-slate-900 truncate">{laundry.name}</h3>
                    </div>
                    {laundry.address && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{laundry.address}</span>
                      </p>
                    )}
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold shrink-0">
                    Terverifikasi
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Riwayat Pengajuan Cabang (Status) */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-100 space-y-4">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="w-5 h-5 text-brand-primary" />
            <span>Status Pengajuan Cabang ({applications.length})</span>
          </h2>

          {isLoading ? (
            <div className="py-8 text-center text-slate-400 animate-pulse text-sm">Memuat data pengajuan...</div>
          ) : applications.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              Belum ada riwayat pengajuan penambahan cabang.
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => {
                const isAddBranch = app.application_type === 'add_branch';

                return (
                  <div
                    key={app.id}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-slate-200 text-slate-700">
                            {isAddBranch ? 'Penambahan Cabang' : 'Pendaftaran Laundry Baru'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(app.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <h3 className="font-extrabold text-base text-slate-900">{app.laundry_name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{app.laundry_address}, {app.city}</span>
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0">
                        {app.status === 'pending' && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-900 text-xs font-extrabold">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>🟡 Menunggu Persetujuan Admin</span>
                          </div>
                        )}
                        {app.status === 'approved' && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-900 text-xs font-extrabold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>🟢 Disetujui</span>
                          </div>
                        )}
                        {app.status === 'rejected' && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-100 text-rose-900 text-xs font-extrabold">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>🔴 Ditolak</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rejection Reason Display */}
                    {app.status === 'rejected' && app.rejection_reason && (
                      <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-900 text-xs space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-rose-800">
                          <ShieldAlert className="w-4 h-4 text-rose-600" />
                          Alasan Penolakan Admin:
                        </div>
                        <p className="text-rose-800/90 leading-relaxed font-medium">
                          {app.rejection_reason}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
