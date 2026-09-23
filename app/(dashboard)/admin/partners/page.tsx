'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { UserProfile } from '@/types/user';
import { Laundry, PartnerLifecycleStatus } from '@/types/laundry';
import { CreatePartnerModal } from '@/components/admin/CreatePartnerModal';
import { PartnerStatusModal } from '@/components/admin/PartnerStatusModal';
import { InviteOwnerModal } from '@/components/admin/InviteOwnerModal';
import {
  Building2,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  Lock,
  RefreshCw,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Phone,
  User,
  Eye,
  ShieldAlert,
  UserPlus,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function AdminPartnersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [partners, setPartners] = useState<Laundry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [verificationFilter, setVerificationFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPartnerForStatus, setSelectedPartnerForStatus] = useState<Laundry | null>(null);
  const [targetStatus, setTargetStatus] = useState<PartnerLifecycleStatus | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedPartnerForInvite, setSelectedPartnerForInvite] = useState<Laundry | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsUnauthorized(false);

    try {
      let profile: UserProfile | null = null;
      if (isSupabaseConfigured) {
        profile = await authService.fetchCurrentProfile();
      } else {
        profile = authService.getCurrentUser();
      }

      setCurrentUser(profile);

      if (!profile || (profile.role !== 'platform_admin' && profile.role !== 'admin')) {
        setIsUnauthorized(true);
        setIsLoading(false);
        return;
      }

      const queryParams = new URLSearchParams();
      if (statusFilter !== 'all') queryParams.set('status', statusFilter);
      if (verificationFilter !== 'all') queryParams.set('verificationStatus', verificationFilter);
      if (cityFilter !== 'all') queryParams.set('city', cityFilter);
      if (searchQuery.trim()) queryParams.set('q', searchQuery.trim());

      const headers = await authService.getAuthHeadersAsync();

      const res = await fetch(`/api/admin/partners?${queryParams.toString()}`, { headers });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengambil daftar partner.');
      }

      setPartners(data.partners || []);
    } catch (err: any) {
      console.error('[ADMIN-PARTNERS] Error loading data:', err);
      setErrorMessage(err.message || 'Gagal terhubung ke database.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, verificationFilter, cityFilter, searchQuery]);

  useEffect(() => {
    loadData();

    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          loadData();
        }
      });
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [loadData]);

  if (isUnauthorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl mx-auto flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900">Akses Ditolak (403 Forbidden)</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Halaman ini khusus untuk peranan <strong>Platform Ops Admin</strong>. Akun Anda saat ini tidak memiliki otorisasi.
          </p>
        </div>
        <Button variant="primary" onClick={() => router.push('/customer')}>
          Kembali ke Dashboard Utama
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: PartnerLifecycleStatus) => {
    switch (status) {
      case 'active':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">ACTIVE / PARTNER</span>;
      case 'supplier':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">SUPPLIER</span>;
      case 'order_ready':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300">ORDER READY</span>;
      case 'suspended':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">SUSPENDED</span>;
      case 'onboarding':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">ONBOARDING</span>;
      case 'claimed':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">CLAIMED</span>;
      case 'listed':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">LISTED</span>;
      case 'unclaimed':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">UNCLAIMED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">{status.toUpperCase()}</span>;
    }
  };

  const getVerificationBadge = (vStatus?: string) => {
    switch (vStatus) {
      case 'verified':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Verified</span>;
      case 'rejected':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">Rejected</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">Pending</span>;
    }
  };

  const getOperationalBadge = (isOpen?: boolean) => {
    if (isOpen) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
          Buka
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
        Tutup
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-brand-primary via-slate-900 to-brand-secondary rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-xs font-bold">
            <Building2 className="w-3.5 h-3.5" />
            <span>Platform Ops Admin — Database Partner</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Partners Database
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Kelola seluruh laundry partner CUCIYAN dari sisi platform. Monitoring status lifecycle, verifikasi, onboarding, hingga penangguhan operasional mitra.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={loadData}
            disabled={isLoading}
            className="border-white/30 text-white hover:bg-white/10 text-xs font-bold"
            leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black shadow-lg shadow-cyan-500/30 border-none"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            + Tambah Partner
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-center justify-between gap-4 text-red-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>Coba Lagi</Button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Cari nama partner, lokasi, ID, kode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Status Lifecycle</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Status Lifecycle</option>
              <option value="listed">Listed</option>
              <option value="order_ready">Order Ready</option>
              <option value="supplier">Supplier</option>
              <option value="claimed">Claimed</option>
              <option value="onboarding">Onboarding</option>
              <option value="active">Active / Partner</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Verification Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Verifikasi Compliance</label>
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
            >
              <option value="all">Semua Status Verifikasi</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Partners Table (Desktop) & Cards (Mobile) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-primary" />
            <span>Daftar Database Laundry Partner</span>
          </h2>
          <span className="text-xs font-bold text-slate-500">
            {isLoading ? 'Memuat data...' : `Total ${partners.length} Partner Terdaftar`}
          </span>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-primary" />
            <p className="text-xs font-semibold">Mengambil database partner dari Supabase...</p>
          </div>
        ) : partners.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">Partner Tidak Ditemukan</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ada partner laundry yang cocok dengan kriteria pencarian atau filter yang dipilih.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Partner</th>
                      <th className="py-3.5 px-4">Lokasi</th>
                      <th className="py-3.5 px-4">Status Lifecycle</th>
                      <th className="py-3.5 px-4">Operasional</th>
                      <th className="py-3.5 px-4">Verifikasi</th>
                      <th className="py-3.5 px-4">Pemilik (Owner)</th>
                      <th className="py-3.5 px-4 text-center">Cabang</th>
                      <th className="py-3.5 px-4 text-center">Aksi Platform</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {partners.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-900 text-xs">{p.name}</p>
                            <p className="text-[10px] font-mono text-brand-primary font-bold">{p.code}</p>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <div className="flex items-center gap-1 text-[11px]">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="line-clamp-1">{p.cityName || 'Cirebon'}, {p.districtName || 'Kesambi'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">{getStatusBadge(p.status || 'listed')}</td>
                        <td className="py-3.5 px-4">{getOperationalBadge(p.isOpen)}</td>
                        <td className="py-3.5 px-4">{getVerificationBadge(p.verificationStatus)}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[11px] font-semibold">{p.ownerName || 'Not Claimed'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                          {p.branchesCount || 1}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/admin/partners/${p.id}`)}
                              className="text-[11px] font-bold py-1 px-2.5"
                              leftIcon={<Eye className="w-3.5 h-3.5" />}
                            >
                              Detail
                            </Button>

                            {p.status === 'listed' || p.status === 'unclaimed' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPartnerForStatus(p);
                                  setTargetStatus('order_ready');
                                  setIsStatusModalOpen(true);
                                }}
                                className="text-[11px] font-bold py-1 px-2.5 border-cyan-300 text-cyan-700 hover:bg-cyan-50"
                              >
                                Aktifkan Pesanan
                              </Button>
                            ) : p.status === 'order_ready' ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPartnerForStatus(p);
                                    setTargetStatus('supplier');
                                    setIsStatusModalOpen(true);
                                  }}
                                  className="text-[11px] font-bold py-1 px-2.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                                >
                                  Tandai Supplier
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPartnerForStatus(p);
                                    setTargetStatus('suspended');
                                    setIsStatusModalOpen(true);
                                  }}
                                  className="text-[11px] font-bold py-1 px-2.5 border-red-300 text-red-700 hover:bg-red-50"
                                >
                                  Suspend
                                </Button>
                              </>
                            ) : p.status === 'supplier' ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPartnerForStatus(p);
                                    setTargetStatus('active');
                                    setIsStatusModalOpen(true);
                                  }}
                                  className="text-[11px] font-bold py-1 px-2.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                >
                                  Partner Resmi
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPartnerForStatus(p);
                                    setTargetStatus('suspended');
                                    setIsStatusModalOpen(true);
                                  }}
                                  className="text-[11px] font-bold py-1 px-2.5 border-red-300 text-red-700 hover:bg-red-50"
                                >
                                  Suspend
                                </Button>
                              </>
                            ) : p.status === 'active' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPartnerForStatus(p);
                                  setTargetStatus('suspended');
                                  setIsStatusModalOpen(true);
                                }}
                                className="text-[11px] font-bold py-1 px-2.5 border-red-300 text-red-700 hover:bg-red-50"
                                leftIcon={<ShieldAlert className="w-3.5 h-3.5" />}
                              >
                                Suspend
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPartnerForStatus(p);
                                  setTargetStatus('order_ready');
                                  setIsStatusModalOpen(true);
                                }}
                                className="text-[11px] font-bold py-1 px-2.5 border-cyan-300 text-cyan-700 hover:bg-cyan-50"
                              >
                                Aktifkan Pesanan
                              </Button>
                            )}

                            {p.claimStatus === 'unclaimed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPartnerForInvite(p);
                                  setIsInviteModalOpen(true);
                                }}
                                className="text-[11px] font-bold py-1 px-2.5 border-purple-300 text-purple-700 hover:bg-purple-50"
                                leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                              >
                                Undang
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-4 lg:hidden">
              {partners.map((p) => (
                <div key={p.id} className="bg-white rounded-3xl border border-slate-200 p-5 space-y-4 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                      <p className="text-[10px] font-mono font-bold text-brand-primary">{p.code}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {getStatusBadge(p.status || 'listed')}
                      {getOperationalBadge(p.isOpen)}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-b border-slate-100 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Operasional:</span>
                      {getOperationalBadge(p.isOpen)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Verifikasi:</span>
                      {getVerificationBadge(p.verificationStatus)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Lokasi:</span>
                      <span className="font-semibold text-slate-800">{p.cityName || 'Cirebon'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Owner:</span>
                      <span className="font-semibold text-slate-800">{p.ownerName || 'Not Claimed'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/partners/${p.id}`)}
                      className="w-full text-xs font-bold"
                    >
                      Lihat Detail
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <CreatePartnerModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => loadData()}
      />

      <PartnerStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        partner={selectedPartnerForStatus}
        targetStatus={targetStatus}
        onSuccess={() => loadData()}
      />

      <InviteOwnerModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        partner={selectedPartnerForInvite}
      />
    </div>
  );
}
