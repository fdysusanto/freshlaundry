'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { partnerApplicationService, PartnerApplicationRecord } from '@/services/partnerApplicationService';
import { isSupabaseConfigured } from '@/services/supabase';
import { formatDateIndo } from '@/utils/formatters';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Sparkles,
  Store,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Building,
  CreditCard,
  Tag,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';

export default function PartnerApplicationStatusPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [application, setApplication] = useState<PartnerApplicationRecord | null>(null);
  const [userEmail, setUserEmail] = useState('');

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const profile = await authService.fetchCurrentProfile();
        if (!profile) {
          router.push('/login');
          return;
        }
        setUserEmail(profile.email);

        const liveApp = await partnerApplicationService.getMyPartnerApplicationAsync();
        setApplication(liveApp);
      }
    } catch (err) {
      console.warn('Load partner application status error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const maskAccountNumber = (accountNum: string) => {
    if (!accountNum || accountNum.length <= 4) return '****';
    const lastFour = accountNum.slice(-4);
    return `********${lastFour}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Memuat status pengajuan mitra...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-gradient-to-b from-teal-50/50 via-slate-50 to-white">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/30 mb-2">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Status Pengajuan Mitra</h1>
          <p className="text-xs text-slate-500">
            Status verifikasi outlet laundry Anda oleh tim platform FreshWash.
          </p>
        </div>

        <Card variant="white" className="shadow-xl">
          {!application ? (
            <div className="text-center py-6 space-y-4">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-800">Belum Ada Pengajuan Mitra</h2>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Akun ({userEmail}) belum pernah mengirimkan pengajuan pendaftaran mitra laundry.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <Link href="/register/partner">
                  <Button variant="primary" size="md" className="w-full sm:w-auto">
                    Daftar Mitra Sekarang
                  </Button>
                </Link>
                <Link href="/customer">
                  <Button variant="outline" size="md" className="w-full sm:w-auto">
                    Kembali ke Beranda
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header Status Chip */}
              <div className="p-4 rounded-2xl border flex items-center justify-between gap-3 bg-slate-50 border-slate-200">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Status Pengajuan:
                  </span>
                  {application.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <Badge variant="amber" className="font-bold text-xs px-2.5 py-1">
                        PENDING VERIFICATION
                      </Badge>
                    </div>
                  )}
                  {application.status === 'approved' && (
                    <div className="flex items-center gap-2">
                      <Badge variant="emerald" className="font-bold text-xs px-2.5 py-1">
                        DISETUJUI (APPROVED)
                      </Badge>
                    </div>
                  )}
                  {application.status === 'rejected' && (
                    <div className="flex items-center gap-2">
                      <Badge variant="rose" className="font-bold text-xs px-2.5 py-1">
                        DITOLAK (REJECTED)
                      </Badge>
                    </div>
                  )}
                </div>
                <button
                  onClick={loadStatus}
                  className="p-2 text-slate-400 hover:text-teal-700 rounded-xl hover:bg-white transition-all cursor-pointer"
                  title="Muat Ulang Status"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Status Explanation Card */}
              {application.status === 'pending' && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" /> Pengajuan Anda sedang menunggu verifikasi.
                  </p>
                  <p className="text-amber-800 text-[11px] leading-relaxed pl-5">
                    Tim verifikasi FreshWash sedang meninjau dokumen dan alamat outlet usaha Anda. Kami akan menghubungi nomor WhatsApp <strong>{application.owner_phone}</strong>.
                  </p>
                  <p className="text-amber-900 font-semibold text-[11px] pl-5 pt-1">
                    Anda tidak perlu membuat pengajuan baru. Tim kami sedang melakukan verifikasi.
                  </p>
                </div>
              )}

              {application.status === 'approved' && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> Selamat! Pengajuan Anda telah disetujui.
                  </p>
                  <p className="text-emerald-800 text-[11px] leading-relaxed pl-5">
                    Akun Anda telah di-upgrade menjadi Pemilik Mitra Laundry. Silakan masuk ke Dashboard Owner untuk mengelola layanan dan pesanan.
                  </p>
                  <div className="pt-2 pl-5">
                    <Link href="/owner">
                      <Button variant="primary" size="sm">
                        Buka Dashboard Owner
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {application.status === 'rejected' && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" /> Pengajuan Anda ditolak.
                  </p>
                  {application.rejection_reason ? (
                    <div className="bg-white p-2.5 rounded-lg border border-rose-200 text-rose-800 text-xs">
                      <span className="font-semibold block text-[11px] text-slate-500 mb-0.5">Alasan Penolakan:</span>
                      {application.rejection_reason}
                    </div>
                  ) : (
                    <p className="text-rose-800 text-[11px] pl-5">
                      Silakan periksa kembali kelengkapan data usaha Anda dan ajukan revisi.
                    </p>
                  )}
                  <div className="pt-1 pl-5">
                    <Link href="/register/partner?edit=1">
                      <Button variant="primary" size="sm">
                        Revisi &amp; Ajukan Ulang
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Rincian Pengajuan Summary */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Rincian Pengajuan Data Outlet
                </h3>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-200/80 pb-2">
                    <span className="text-slate-500">Nama Toko:</span>
                    <strong className="text-slate-900 font-bold">{application.laundry_name}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 pb-2">
                    <span className="text-slate-500">Alamat Outlet:</span>
                    <span className="text-slate-800 font-medium text-right max-w-xs">
                      {application.laundry_address}, {application.district}, {application.city}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 pb-2">
                    <span className="text-slate-500">Jam Operasional:</span>
                    <span className="text-slate-800 font-semibold">
                      {application.opening_time || '08:00'} - {application.closing_time || '20:00'} WIB
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 pb-2">
                    <span className="text-slate-500">Tanggal Pengajuan:</span>
                    <span className="text-slate-800 font-semibold">
                      {formatDateIndo(application.created_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Rekening Payout:</span>
                    <span className="text-slate-800 font-semibold">
                      {application.payout_bank} — {maskAccountNumber(application.payout_account_number)} ({application.payout_account_holder})
                    </span>
                  </div>
                </div>

                {/* Services Draft Summary */}
                {application.services && application.services.length > 0 && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-teal-600" /> Katalog Draf Layanan ({application.services.length})
                    </h4>
                    <ul className="divide-y divide-slate-200/80">
                      {application.services.map((s) => (
                        <li key={s.id} className="py-1.5 flex justify-between">
                          <span className="text-slate-700 font-semibold">{s.name}</span>
                          <span className="text-teal-800 font-bold">
                            Rp {s.price_per_unit.toLocaleString('id-ID')} / {s.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex justify-between border-t border-slate-100">
                <Link href="/customer">
                  <Button variant="outline" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                    Kembali ke Beranda
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await authService.signOut();
                    router.push('/login');
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-rose-600 px-3 py-2 cursor-pointer transition-colors"
                >
                  Keluar Akun
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
