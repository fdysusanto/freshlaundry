'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { UserProfile } from '@/types/user';
import { Laundry, AuditLogRecord, LaundryUser, PartnerLifecycleStatus } from '@/types/laundry';
import { PartnerAuditLogTable } from '@/components/admin/PartnerAuditLogTable';
import { PartnerStatusModal } from '@/components/admin/PartnerStatusModal';
import { InviteOwnerModal } from '@/components/admin/InviteOwnerModal';
import { PartnerServicesTab } from '@/components/admin/PartnerServicesTab';
import { PartnerPhotosTab } from '@/components/admin/PartnerPhotosTab';
import { PartnerOperationalStatusModal } from '@/components/admin/PartnerOperationalStatusModal';

const getBusinessMeaningLabel = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'listed':
    case 'unclaimed':
      return 'Belum tersedia untuk order';
    case 'order_ready':
    case 'supplier':
      return 'Tersedia di CUCIYAN';
    case 'active':
    case 'partner':
      return 'Mitra Resmi CUCIYAN';
    case 'suspended':
      return 'Ditangguhkan (Suspended)';
    case 'inactive':
      return 'Nonaktif';
    case 'claimed':
      return 'Terklaim (Belum Aktif)';
    case 'onboarding':
      return 'Dalam Proses Onboarding';
    default:
      return status || '-';
  }
};

const getStatusBadgeStyle = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'listed':
    case 'unclaimed':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'order_ready':
      return 'bg-cyan-100 text-cyan-800 border-cyan-300';
    case 'supplier':
      return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    case 'active':
    case 'partner':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'suspended':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'inactive':
      return 'bg-slate-100 text-slate-700 border-slate-300';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300';
  }
};
import {
  Building2,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RefreshCw,
  MapPin,
  Phone,
  Mail,
  User,
  ShieldAlert,
  UserPlus,
  FileText,
  Calendar,
  Layers,
  ShoppingBag,
  TrendingUp,
  Store,
  Camera,
  Star,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const resolvedParams = use(params);
  const partnerId = resolvedParams.partnerId;
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [partner, setPartner] = useState<Laundry | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [users, setUsers] = useState<LaundryUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'photos' | 'info' | 'services' | 'branches' | 'users' | 'orders' | 'verification' | 'audit'>('overview');

  // Modals state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<PartnerLifecycleStatus | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isOperationalModalOpen, setIsOperationalModalOpen] = useState(false);
  const [targetIsOpen, setTargetIsOpen] = useState(false);
  const [operationalSuccessMessage, setOperationalSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
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

      const headers = await authService.getAuthHeadersAsync();

      const [partnerRes, auditRes, usersRes] = await Promise.all([
        fetch(`/api/admin/partners/${partnerId}`, { headers }),
        fetch(`/api/admin/partners/${partnerId}/audit`, { headers }),
        fetch(`/api/admin/partners/${partnerId}/users`, { headers }),
      ]);

      const partnerData = await partnerRes.json();
      const auditData = await auditRes.json();
      const usersData = await usersRes.json();

      if (partnerData.success) setPartner(partnerData.partner);
      if (auditData.success) setAuditLogs(auditData.auditLogs || []);
      if (usersData.success) setUsers(usersData.users || []);
    } catch (err) {
      console.error('[PARTNER-DETAIL] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isUnauthorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl mx-auto flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">Akses Ditolak (403 Forbidden)</h1>
        <Button variant="primary" onClick={() => router.push('/customer')}>
          Kembali
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-primary" />
        <p className="text-xs text-slate-500 font-semibold">Memuat detail partner dari Supabase...</p>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
        <h1 className="text-xl font-bold text-slate-800">Partner Tidak Ditemukan</h1>
        <Button variant="outline" onClick={() => router.push('/admin/partners')}>
          Kembali ke Daftar Partner
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Navigation Top */}
      <button
        onClick={() => router.push('/admin/partners')}
        className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-brand-primary transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Database Partner
      </button>

      {/* Operational Success Banner */}
      {operationalSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4 text-emerald-800 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{operationalSuccessMessage}</span>
          </div>
          <button
            onClick={() => setOperationalSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Partner Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{partner.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-surface text-brand-primary border border-brand-primary/20">
                {partner.code}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadgeStyle(partner.status)}`}>
                {partner.status}
              </span>
              {partner.isOpen ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  BUKA
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  TUTUP
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {getBusinessMeaningLabel(partner.status)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {partner.cityName || 'Cirebon'}, {partner.districtName || 'Kesambi'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Pemilik: <strong>{partner.ownerName || 'Belum Diklaim'}</strong>
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Operational Status Action */}
            {partner.isOpen ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTargetIsOpen(false);
                  setIsOperationalModalOpen(true);
                }}
                className="border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold"
                leftIcon={<Store className="w-3.5 h-3.5 text-rose-600" />}
              >
                Tutup Toko
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTargetIsOpen(true);
                  setIsOperationalModalOpen(true);
                }}
                className="border-emerald-400 text-emerald-700 hover:bg-emerald-50 text-xs font-bold"
                leftIcon={<Store className="w-3.5 h-3.5 text-emerald-600" />}
              >
                Buka Toko
              </Button>
            )}
            {/* 1. Listed / Unclaimed */}
            {(partner.status === 'listed' || partner.status === 'unclaimed') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTargetStatus('order_ready');
                  setIsStatusModalOpen(true);
                }}
                className="border-cyan-300 text-cyan-700 hover:bg-cyan-50 text-xs font-bold"
              >
                Aktifkan Pesanan
              </Button>
            )}

            {/* 2. Order Ready */}
            {partner.status === 'order_ready' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetStatus('supplier');
                    setIsStatusModalOpen(true);
                  }}
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs font-bold"
                >
                  Tandai Supplier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetStatus('suspended');
                    setIsStatusModalOpen(true);
                  }}
                  className="border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold"
                  leftIcon={<ShieldAlert className="w-4 h-4" />}
                >
                  Suspend
                </Button>
              </>
            )}

            {/* 3. Supplier */}
            {partner.status === 'supplier' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetStatus('active');
                    setIsStatusModalOpen(true);
                  }}
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold"
                >
                  Jadikan Mitra Resmi
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetStatus('suspended');
                    setIsStatusModalOpen(true);
                  }}
                  className="border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold"
                  leftIcon={<ShieldAlert className="w-4 h-4" />}
                >
                  Suspend
                </Button>
              </>
            )}

            {/* 4. Active / Partner */}
            {(partner.status === 'active' || partner.status === 'partner') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTargetStatus('suspended');
                  setIsStatusModalOpen(true);
                }}
                className="border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold"
                leftIcon={<ShieldAlert className="w-4 h-4" />}
              >
                Suspend
              </Button>
            )}

            {/* 5. Suspended (Recovery Actions: order_ready, supplier, active) */}
            {partner.status === 'suspended' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetStatus('order_ready');
                    setIsStatusModalOpen(true);
                  }}
                  className="border-cyan-300 text-cyan-700 hover:bg-cyan-50 text-xs font-bold"
                >
                  Aktifkan Pesanan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetStatus('supplier');
                    setIsStatusModalOpen(true);
                  }}
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs font-bold"
                >
                  Tandai Supplier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetStatus('active');
                    setIsStatusModalOpen(true);
                  }}
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold"
                >
                  Jadikan Mitra Resmi
                </Button>
              </>
            )}

            {/* 6. Inactive (Recovery Actions: order_ready, active) */}
            {partner.status === 'inactive' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetStatus('order_ready');
                    setIsStatusModalOpen(true);
                  }}
                  className="border-cyan-300 text-cyan-700 hover:bg-cyan-50 text-xs font-bold"
                >
                  Aktifkan Pesanan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetStatus('active');
                    setIsStatusModalOpen(true);
                  }}
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold"
                >
                  Jadikan Mitra Resmi
                </Button>
              </>
            )}

            {/* 7. Claimed / Onboarding */}
            {(partner.status === 'claimed' || partner.status === 'onboarding') && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetStatus('order_ready');
                    setIsStatusModalOpen(true);
                  }}
                  className="border-cyan-300 text-cyan-700 hover:bg-cyan-50 text-xs font-bold"
                >
                  Aktifkan Pesanan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetStatus('active');
                    setIsStatusModalOpen(true);
                  }}
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold"
                >
                  Jadikan Mitra Resmi
                </Button>
              </>
            )}

            {partner.claimStatus === 'unclaimed' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInviteModalOpen(true)}
                className="border-purple-300 text-purple-700 hover:bg-purple-50 text-xs font-bold"
                leftIcon={<UserPlus className="w-4 h-4" />}
              >
                Undang Pemilik
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto text-xs font-bold text-slate-500 gap-6">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'photos', label: 'Foto Storefront' },
          { id: 'info', label: 'Business Info' },
          { id: 'services', label: 'Layanan' },
          { id: 'branches', label: 'Cabang / Branches' },
          { id: 'users', label: 'Pengguna / Users' },
          { id: 'verification', label: 'Verifikasi' },
          { id: 'audit', label: 'Audit Log' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            className={`pb-3 transition-colors cursor-pointer whitespace-nowrap border-b-2 ${
              activeTab === t.id
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-white rounded-3xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Status Lifecycle</span>
              <div className="flex items-center gap-2">
                <p className="text-xl font-black text-slate-900 uppercase">{partner.status}</p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyle(partner.status)}`}>
                  {partner.status}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-600">
                {getBusinessMeaningLabel(partner.status)}
              </p>
            </div>

            {/* Section STATUS OPERASIONAL */}
            <div className="p-6 bg-white rounded-3xl border border-slate-200 space-y-3 flex flex-col justify-between shadow-xs">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status Operasional</span>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-black text-slate-900 uppercase">
                    {partner.isOpen ? 'BUKA' : 'TUTUP'}
                  </p>
                  {partner.isOpen ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      Buka
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                      Tutup
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                  {partner.isOpen
                    ? 'Toko sedang operasional buka. Pelanggan dapat membuat pesanan jika lifecycle dan layanan aktif memenuhi syarat.'
                    : 'Toko sedang tutup sementara. Pelanggan tidak dapat membuat pesanan baru hingga toko dibuka kembali.'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                {partner.isOpen ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTargetIsOpen(false);
                      setIsOperationalModalOpen(true);
                    }}
                    className="w-full border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold"
                    leftIcon={<Store className="w-3.5 h-3.5 text-rose-600" />}
                  >
                    Tutup Toko
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setTargetIsOpen(true);
                      setIsOperationalModalOpen(true);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs border-none"
                    leftIcon={<Store className="w-3.5 h-3.5 text-white" />}
                  >
                    Buka Toko
                  </Button>
                )}
              </div>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Status Klaim</span>
              <p className="text-xl font-black text-slate-900 uppercase">{partner.claimStatus}</p>
            </div>
            <div className="p-6 bg-white rounded-3xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Verifikasi Compliance</span>
              <p className="text-xl font-black text-slate-900 uppercase">{partner.verificationStatus}</p>
            </div>
          </div>

          {/* Section Storefront Overview Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative w-28 h-20 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                <img
                  src={partner.logoUrl || 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80'}
                  alt={`Storefront ${partner.name}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1.5 left-1.5 bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-slate-950" />
                  <span>UTAMA</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-purple-600" />
                  <h4 className="text-sm font-bold text-slate-900">Foto Profil &amp; Storefront Outlet</h4>
                </div>
                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                  Foto cover marketplace dan galeri profil outlet untuk pelanggan. Maksimal 5 foto per outlet laundry.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('photos')}
              leftIcon={<Camera className="w-3.5 h-3.5 text-purple-600" />}
              className="text-xs font-bold border-purple-200 text-purple-700 hover:bg-purple-50 shrink-0 w-full md:w-auto"
            >
              Kelola Foto Storefront
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'photos' && (
        <PartnerPhotosTab partner={partner} onPhotoUpdated={loadData} />
      )}

      {activeTab === 'info' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm">Informasi Bisnis Platform-Level</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-700">
            <div>
              <p className="text-slate-400 text-[11px]">Nama Laundry:</p>
              <p className="font-bold text-slate-900">{partner.name}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Nama Legal:</p>
              <p className="font-bold text-slate-900">{partner.legalName || '-'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Telepon Kontrak:</p>
              <p className="font-bold text-slate-900">{partner.phone}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[11px]">Email Bisnis:</p>
              <p className="font-bold text-slate-900">{partner.businessEmail || partner.ownerEmail || '-'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-slate-400 text-[11px]">Alamat Alamat Operasional:</p>
              <p className="font-bold text-slate-900">{partner.address}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'services' && (
        <PartnerServicesTab partner={partner} />
      )}

      {activeTab === 'branches' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm">Daftar Cabang Laundry Partner</h3>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-900">{partner.name} (Cabang Utama)</p>
              <p className="text-slate-500 text-[11px]">{partner.address}</p>
            </div>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px]">UTAMA</span>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm">Pengguna Terkait (Owner &amp; Staf)</h3>
          {users.length === 0 ? (
            <p className="text-slate-500">Belum ada pengguna terdaftar untuk outlet ini.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {users.map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{u.fullName}</p>
                    <p className="text-[11px] text-slate-500">{u.email || u.phone || '-'}</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-700">
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'verification' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 text-sm">Status Onboarding &amp; Verifikasi Compliance</h3>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <p>• Status Verifikasi: <strong className="uppercase">{partner.verificationStatus}</strong></p>
            <p>• Progress Onboarding: <strong className="uppercase">{partner.onboardingStatus}</strong></p>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <PartnerAuditLogTable logs={auditLogs} />
      )}

      {/* Modals */}
      <PartnerStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        partner={partner}
        targetStatus={targetStatus}
        onSuccess={() => loadData()}
      />

      <InviteOwnerModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        partner={partner}
      />

      <PartnerOperationalStatusModal
        isOpen={isOperationalModalOpen}
        onClose={() => setIsOperationalModalOpen(false)}
        partner={partner}
        targetIsOpen={targetIsOpen}
        onSuccess={(newIsOpen) => {
          setPartner((prev) => (prev ? { ...prev, isOpen: newIsOpen } : null));
          setOperationalSuccessMessage(
            `Status operasional toko berhasil diubah menjadi ${newIsOpen ? 'BUKA' : 'TUTUP'}.`
          );
          loadData();
        }}
      />
    </div>
  );
}
