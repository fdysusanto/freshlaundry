'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { orderService } from '@/services/orderService';
import { laundryService } from '@/services/laundryService';
import { laundryPhotoService, CANONICAL_LAUNDRY_FALLBACK } from '@/services/laundryPhotoService';
import { partnerApplicationService, PartnerApplicationRecord } from '@/services/partnerApplicationService';
import { Order, OrderStatus } from '@/types/order';
import { Laundry, LaundryService as ServiceCatalogItem, LaundryPhoto } from '@/types/laundry';
import { UserProfile } from '@/types/user';
import { formatIDR, formatDateIndo, formatDateTimeIndo } from '@/utils/formatters';
import { getStatusConfig } from '@/utils/helpers';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { WeightVerificationModal } from '@/components/owner/WeightVerificationModal';
import { OwnerHomeDashboard } from '@/components/owner/OwnerHomeDashboard';
import { MobileOrdersView } from '@/components/owner/mobile/MobileOrdersView';
import { OwnerBranchProvider, useOwnerBranch } from '@/components/owner/OwnerBranchContext';
import { OwnerBranchSwitcher } from '@/components/owner/OwnerBranchSwitcher';
import {
  Store,
  ShoppingBag,
  TrendingUp,
  Clock,
  CheckCircle2,
  Package,
  Layers,
  DollarSign,
  UserCheck,
  Eye,
  Sparkles,
  Search,
  Filter,
  ShieldCheck,
  MapPin,
  Phone,
  AlertCircle,
  PlusCircle,
  XCircle,
  MessageSquare,
  Lock,
  Star,
  Check,
  Image as ImageIcon,
  Upload,
  Trash2,
  Loader2,
} from 'lucide-react';


function OwnerDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const {
    currentUser,
    ownedLaundries,
    activeLaundryId: selectedLaundryId,
    activeLaundry: selectedLaundry,
    setActiveLaundryId: setSelectedLaundryId,
    isLoading: isBranchLoading,
  } = useOwnerBranch();

  const [partnerApp, setPartnerApp] = useState<PartnerApplicationRecord | null>(null);

  const [laundryOrders, setLaundryOrders] = useState<Order[]>([]);
  const [laundryServices, setLaundryServices] = useState<ServiceCatalogItem[]>([]);
  const [ownerPhotos, setOwnerPhotos] = useState<LaundryPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tab Navigation State: 'dashboard' | 'orders' | 'services' | 'profile' | 'reviews'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'services' | 'profile' | 'reviews'>('dashboard');

  // Orders Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [weightVerificationOnly, setWeightVerificationOnly] = useState(false);

  // Sync tab & filters from URL search params
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const statusParam = searchParams.get('status');
    const filterParam = searchParams.get('filter');

    if (tabParam && ['dashboard', 'orders', 'services', 'profile', 'reviews'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
    if (statusParam) {
      setStatusFilter(statusParam);
    }
    if (filterParam === 'weight_verification') {
      setStatusFilter('picked_up');
      setWeightVerificationOnly(true);
    } else {
      setWeightVerificationOnly(false);
    }
  }, [searchParams]);

  // Profile Edit Form State
  const [profileForm, setProfileForm] = useState({
    name: '',
    description: '',
    phone: '',
    address: '',
    openingTime: '08:00',
    closingTime: '20:00',
    isOpen: true,
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Weight Verification Modal State (Option B Centralized)
  const [selectedOrderForVerification, setSelectedOrderForVerification] = useState<Order | null>(null);

  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  const handleOrderTransition = async (order: Order, targetStatus: OrderStatus, notes: string) => {
    if (processingOrderId) return;
    setProcessingOrderId(order.id);
    try {
      const sessionRes = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
      const token = sessionRes?.data?.session?.access_token;
      const res = await fetch(`/api/orders/${order.id}/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetStatus,
          notes,
          userId: currentUser?.id,
          role: currentUser?.role || 'laundry_owner',
          laundryId: order.laundryId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal merubah status.');
      }
      if (selectedLaundryId) {
        const updatedOrders = await orderService.getOrdersByLaundryAsync(selectedLaundryId);
        setLaundryOrders(updatedOrders);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal merubah status.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const openWeighModal = (order: Order) => {
    setSelectedOrderForVerification(order);
  };

  useEffect(() => {
    let isMounted = true;

    const loadOwnerDashboard = async () => {
      setIsLoading(true);
      try {
        if (isSupabaseConfigured) {
          const profile = await authService.fetchCurrentProfile();
          if (!profile || (profile.role !== 'laundry_owner' && profile.role !== 'laundry_staff')) {
            if (isMounted) router.push('/customer');
            return;
          }

          const livePartnerApp = await partnerApplicationService.getMyPartnerApplicationAsync();
          if (isMounted) {
            setPartnerApp(livePartnerApp);
          }
        } else {
          const user = authService.getCurrentUser();
          if (user.role !== 'laundry_owner' && user.role !== 'laundry_staff') {
            if (isMounted) router.push('/customer');
            return;
          }
        }
      } catch (err) {
        console.warn('[OWNER-DASHBOARD] Error loading dashboard data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadOwnerDashboard();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // Load orders, services, and 5-photo gallery when selected laundry changes
  useEffect(() => {
    let isMounted = true;

    const loadLaundryContent = async () => {
      if (!selectedLaundryId) {
        if (isMounted) {
          setLaundryOrders([]);
          setLaundryServices([]);
          setOwnerPhotos([]);
        }
        return;
      }

      try {
        if (isSupabaseConfigured) {
          const [ordersData, servicesData, photosData] = await Promise.all([
            orderService.getOrdersByLaundryAsync(selectedLaundryId),
            laundryService.getServicesByLaundryAsync(selectedLaundryId),
            laundryPhotoService.getPhotosByLaundryAsync(selectedLaundryId),
          ]);

          if (isMounted) {
            setLaundryOrders(ordersData);
            setLaundryServices(servicesData);
            setOwnerPhotos(photosData.photos);
          }
        } else {
          const mockOrders = orderService.getOrdersByLaundry(selectedLaundryId);
          const mockServices = laundryService.getServicesByLaundry(selectedLaundryId);
          if (isMounted) {
            setLaundryOrders(mockOrders);
            setLaundryServices(mockServices);
            setOwnerPhotos([]);
          }
        }
      } catch (err) {
        console.warn('[OWNER-DASHBOARD] Error loading laundry content:', err);
      }
    };

    loadLaundryContent();

    return () => {
      isMounted = false;
    };
  }, [selectedLaundryId]);

  // Sync profileForm when selectedLaundry changes
  useEffect(() => {
    if (selectedLaundry) {
      setProfileForm({
        name: selectedLaundry.name || '',
        description: selectedLaundry.description || '',
        phone: selectedLaundry.phone || '',
        address: selectedLaundry.address || '',
        openingTime: selectedLaundry.openingTime || '08:00',
        closingTime: selectedLaundry.closingTime || '20:00',
        isOpen: selectedLaundry.isOpen ?? true,
      });
    }
  }, [selectedLaundry]);

  // Metrics computation
  const metrics = useMemo(() => {
    const totalOrders = laundryOrders.length;
    const completedOrders = laundryOrders.filter((o) => o.status === 'delivered');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const activeOrders = laundryOrders.filter(
      (o) => o.status !== 'delivered' && o.status !== 'cancelled'
    );
    const pendingActionOrders = laundryOrders.filter(
      (o) => o.status === 'picked_up' || o.status === 'pending'
    );

    return {
      totalOrders,
      completedOrdersCount: completedOrders.length,
      activeOrdersCount: activeOrders.length,
      pendingActionCount: pendingActionOrders.length,
      totalRevenue,
    };
  }, [laundryOrders]);

  // Filtered Orders for 'orders' tab
  const filteredOrders = useMemo(() => {
    return laundryOrders.filter((order) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        order.trackingNumber.toLowerCase().includes(q) ||
        order.customerName?.toLowerCase().includes(q) ||
        order.pickupAddress.toLowerCase().includes(q);

      let matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      if (weightVerificationOnly) {
        matchesStatus = order.status === 'picked_up' && !order.weightFinalizedAt && !order.finalWeightKg;
      }

      return matchesQuery && matchesStatus;
    });
  }, [laundryOrders, searchQuery, statusFilter, weightVerificationOnly]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLaundryId) return;

    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    try {
      if (isSupabaseConfigured) {
        await laundryService.updateLaundryProfileAsync(selectedLaundryId, {
          name: profileForm.name,
          description: profileForm.description,
          phone: profileForm.phone,
          address: profileForm.address,
          openingTime: profileForm.openingTime,
          closingTime: profileForm.closingTime,
          isOpen: profileForm.isOpen,
        });
      }

      setProfileSuccessMsg('Profil dan operasional mitra laundry berhasil diperbarui!');
      setTimeout(() => setProfileSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(`Gagal memperbarui profil: ${err.message}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Owner Photo Management State & Handlers
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [photoActionId, setPhotoActionId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);

  const refreshPhotos = async () => {
    if (!selectedLaundryId) return;
    try {
      const res = await fetch(`/api/owner/laundries/${selectedLaundryId}/photos`);
      if (res.ok) {
        const data = await res.json();
        setOwnerPhotos(data.photos || []);
      } else {
        const p = await laundryPhotoService.getPhotosByLaundryAsync(selectedLaundryId);
        setOwnerPhotos(p.photos);
      }
    } catch {
      const p = await laundryPhotoService.getPhotosByLaundryAsync(selectedLaundryId);
      setOwnerPhotos(p.photos);
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedLaundryId) return;
    e.target.value = ''; // reset input

    if (ownerPhotos.length >= 5) {
      setPhotoError('Maksimum 5 foto outlet telah tercapai.');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setPhotoError('Format file tidak didukung. Harap unggah format JPG, PNG, atau WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Ukuran file melebihi batas 5MB.');
      return;
    }

    setIsPhotoUploading(true);
    setPhotoError(null);
    setPhotoSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/owner/laundries/${selectedLaundryId}/photos`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Gagal mengunggah foto');
      }
      setPhotoSuccess('Foto berhasil ditambahkan.');
      await refreshPhotos();
    } catch (err: any) {
      setPhotoError(err.message || 'Terjadi kesalahan saat mengunggah foto.');
    } finally {
      setIsPhotoUploading(false);
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    if (!selectedLaundryId || photoActionId) return;
    setPhotoActionId(photoId);
    setPhotoError(null);
    setPhotoSuccess(null);

    try {
      const res = await fetch(`/api/owner/laundries/${selectedLaundryId}/photos/${photoId}/primary`, {
        method: 'PATCH',
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Gagal mengubah foto utama');
      }
      setPhotoSuccess('Foto utama berhasil diperbarui.');
      await refreshPhotos();
    } catch (err: any) {
      setPhotoError(err.message || 'Terjadi kesalahan saat mengubah foto utama.');
    } finally {
      setPhotoActionId(null);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!selectedLaundryId || photoActionId) return;
    if (!window.confirm('Yakin ingin menghapus foto outlet ini?')) return;

    setPhotoActionId(photoId);
    setPhotoError(null);
    setPhotoSuccess(null);

    try {
      const res = await fetch(`/api/owner/laundries/${selectedLaundryId}/photos/${photoId}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Gagal menghapus foto');
      }
      setPhotoSuccess('Foto berhasil dihapus.');
      await refreshPhotos();
    } catch (err: any) {
      setPhotoError(err.message || 'Terjadi kesalahan saat menghapus foto.');
    } finally {
      setPhotoActionId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500">Memuat Dashboard Partner CUCIYAN...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 pb-24 md:pb-10">
      {/* HEADER DASHBOARD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard Mitra Laundry</h1>
            <span className="text-xs font-extrabold px-3 py-0.5 rounded-full bg-brand-surface text-brand-primary border border-brand-primary/20">
              Partner Portal
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Selamat datang, <strong className="text-slate-800">{currentUser?.fullName || 'Mitra Laundry'}</strong> ({currentUser?.email})
          </p>
        </div>

        {/* Active Branch Switcher Component */}
        <div className="shrink-0">
          <OwnerBranchSwitcher />
        </div>
      </div>

      {/* NO LAUNDRY OUTLET / PENDING APPLICATION NOTICE */}
      {!selectedLaundry ? (
        <Card variant="white" className="p-8 text-center space-y-4 max-w-xl mx-auto border-amber-200 bg-amber-50/30">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Belum Memiliki Outlet Laundry Aktif</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Akun Anda saat ini terdaftar sebagai Mitra, namun belum memiliki outlet laundry yang terverifikasi di platform CUCIYAN.
          </p>

          {partnerApp ? (
            <div className="p-4 bg-white rounded-2xl border border-amber-200 text-xs text-left space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">Status Pengajuan Mitra:</span>
                <span className="font-extrabold px-2.5 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-800 border border-amber-300 uppercase">
                  {partnerApp.status}
                </span>
              </div>
              <p className="text-slate-500 text-[11px]">
                Nomor Pengajuan: <code>{partnerApp.id}</code> ({formatDateIndo(partnerApp.created_at)})
              </p>
            </div>
          ) : (
            <Link href="/register/partner">
              <Button variant="primary" size="md" className="bg-brand-primary hover:bg-brand-primary/90 font-bold text-xs">
                Daftarkan Mitra Laundry Baru
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <>
          {/* TAB NAVIGATION HEADER (Dashboard, Pesanan, Layanan, Profil Mitra, Ulasan) */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'dashboard'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Ringkasan Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'orders'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Daftar Pesanan ({laundryOrders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('services')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'services'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Katalog Layanan ({laundryServices.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === 'profile'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Profil Mitra & Operasional</span>
            </button>
          </div>

          {/* TAB 1: RINGKASAN DASHBOARD */}
          {activeTab === 'dashboard' && (
            <OwnerHomeDashboard
              currentUser={currentUser}
              selectedLaundry={selectedLaundry}
              laundryOrders={laundryOrders}
              metrics={metrics}
              onNavigateToOrders={(targetStatus, isWeightVerification) => {
                setActiveTab('orders');
                if (targetStatus) {
                  setStatusFilter(targetStatus);
                } else {
                  setStatusFilter('all');
                }
                setWeightVerificationOnly(Boolean(isWeightVerification));
              }}
            />
          )}

          {/* TAB 2: DAFTAR PESANAN FULL */}
          {activeTab === 'orders' && (
            <>
              {/* MOBILE VIEW (< 768px): COMPACT CARDS & ACTION CENTER CHIPS */}
              <div className="block md:hidden">
                <MobileOrdersView
                  orders={laundryOrders}
                  onVerifyWeight={(order) => setSelectedOrderForVerification(order)}
                  onTransitionStatus={(order, targetStatus, notes) =>
                    handleOrderTransition(order, targetStatus, notes)
                  }
                  processingOrderId={processingOrderId}
                  initialFilter={weightVerificationOnly ? 'weight_verification' : 'all'}
                />
              </div>

              {/* DESKTOP VIEW (>= 768px): FULL MANAGEMENT TABLE */}
              <Card variant="white" className="hidden md:block p-6 space-y-6">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Manajemen Pesanan Laundry</h3>
                    <p className="text-xs text-slate-500">Kelola status penerimaan cucian, timbangan, dan proses pencucian.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari tracking / customer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50"
                      />
                    </div>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="text-xs font-bold py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer"
                    >
                      <option value="all">Semua Status</option>
                      <option value="picked_up">Pakaian Diambil</option>
                      <option value="in_washing">Sedang Dicuci</option>
                      <option value="ready_for_delivery">Siap Diantar</option>
                      <option value="delivered">Selesai/Tiba</option>
                    </select>
                  </div>
                </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50">
                      <th className="p-3">No. Tracking</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Alamat</th>
                      <th className="p-3">Layanan</th>
                      <th className="p-3">Estimasi / Final Weight</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Total</th>
                      <th className="p-3 text-right">Aksi Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((order) => {
                      const statusCfg = getStatusConfig(order.status);
                      return (
                        <tr key={order.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-bold text-slate-900">{order.trackingNumber}</td>
                          <td className="p-3 font-semibold text-slate-800">{order.customerName || 'Customer'}</td>
                          <td className="p-3 text-slate-500 max-w-xs truncate">{order.pickupAddress}</td>
                          <td className="p-3 text-slate-700 font-medium">{order.serviceType}</td>
                          <td className="p-3 text-slate-600">
                            {order.weightFinalizedAt || order.finalWeightKg ? (
                              <span className="font-bold text-emerald-700">✓ {order.finalWeightKg} kg (Final)</span>
                            ) : order.courierWeightKg ? (
                              <span className="font-semibold text-blue-700">⚖️ {order.courierWeightKg} kg (Kurir)</span>
                            ) : (
                              <span>{order.estimatedWeightKg || '-'} kg (Est)</span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.bg} ${statusCfg.color}`}>
                                {statusCfg.label}
                              </span>
                              {(order.status === 'pending' || order.status === 'assigned' || order.status === 'picked_up') && (
                                <div className="text-[10px] font-bold">
                                  {order.logs?.some((l) => l.notes?.includes('courier_arrived') || l.notes?.includes('Tiba di Outlet') || l.notes?.includes('sampai di outlet')) || order.status === 'picked_up' ? (
                                    <span className="text-emerald-700 font-extrabold flex items-center gap-1">📍 Cucian Tiba di Outlet</span>
                                  ) : (
                                    <span className="text-amber-700 font-semibold flex items-center gap-1">🚴 Kurir Menuju Outlet</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-black text-slate-900">{formatIDR(order.totalPrice)}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {(order.weightFinalizedAt || order.finalWeightKg) ? (
                                <Badge variant="emerald" className="font-bold py-1 px-2.5 flex items-center gap-1">
                                  ✓ Berat Final: {order.finalWeightKg} kg
                                </Badge>
                              ) : !order.weightFinalizedAt && order.status === 'picked_up' ? (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="bg-amber-600 hover:bg-amber-500 font-bold flex items-center gap-1 cursor-pointer"
                                  onClick={() => setSelectedOrderForVerification(order)}
                                >
                                  ⚖️ Verifikasi Berat
                                </Button>
                              ) : order.status === 'assigned' ? (
                                <span className="text-[11px] font-semibold text-slate-500 italic">
                                  Menunggu cucian dijemput kurir
                                </span>
                              ) : order.status === 'pending' ? (
                                <span className="text-[11px] font-semibold text-slate-500 italic">
                                  Menunggu kurir mengambil pesanan
                                </span>
                              ) : null}
                              {order.finalWeightKg && (order.status === 'picked_up' || order.status === 'assigned') && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="bg-brand-primary hover:bg-brand-primary/90 font-bold flex items-center gap-1"
                                  disabled={processingOrderId === order.id}
                                  onClick={async () => {
                                    if (processingOrderId) return;
                                    setProcessingOrderId(order.id);
                                    try {
                                      const sessionRes = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
                                      const token = sessionRes?.data?.session?.access_token;
                                      const res = await fetch(`/api/orders/${order.id}/transition`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                        },
                                        body: JSON.stringify({
                                          targetStatus: 'in_washing',
                                          notes: 'Laundry outlet mulai mencuci cucian customer',
                                          userId: currentUser?.id,
                                          role: currentUser?.role || 'laundry_owner',
                                          laundryId: order.laundryId,
                                        }),
                                      });
                                      const data = await res.json();
                                      if (!res.ok || !data.success) {
                                        throw new Error(data.message || 'Gagal merubah status.');
                                      }
                                      window.location.reload();
                                    } catch (err: any) {
                                      alert(err.message || 'Gagal merubah status.');
                                    } finally {
                                      setProcessingOrderId(null);
                                    }
                                  }}
                                >
                                  {processingOrderId === order.id ? 'Memproses...' : '🧼 Mulai Pencucian'}
                                </Button>
                              )}
                              {order.status === 'in_washing' && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  disabled={processingOrderId === order.id}
                                  onClick={async () => {
                                    if (processingOrderId) return;
                                    setProcessingOrderId(order.id);
                                    try {
                                      const sessionRes = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
                                      const token = sessionRes?.data?.session?.access_token;
                                      const res = await fetch(`/api/orders/${order.id}/transition`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                        },
                                        body: JSON.stringify({
                                          targetStatus: 'ready_for_delivery',
                                          notes: 'Cucian selesai & siap diantar',
                                          userId: currentUser?.id,
                                          role: currentUser?.role || 'laundry_owner',
                                          laundryId: order.laundryId,
                                        }),
                                      });
                                      const data = await res.json();
                                      if (!res.ok || !data.success) {
                                        throw new Error(data.message || 'Gagal merubah status.');
                                      }
                                      window.location.reload();
                                    } catch (err: any) {
                                      alert(err.message || 'Gagal merubah status.');
                                    } finally {
                                      setProcessingOrderId(null);
                                    }
                                  }}
                                >
                                  {processingOrderId === order.id ? 'Memproses...' : 'Siap Diantar'}
                                </Button>
                              )}
                              <Link href={`/orders/${order.id}`}>
                                <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                                  Lihat Detail
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
          )}

          {/* TAB 3: KATALOG LAYANAN (Dapat Mengubah Status Aktif & Harga) */}
          {activeTab === 'services' && (
            <Card variant="white" className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Katalog Layanan Outlet</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Atur tarif harga per unit (kg / pcs) dan aktifkan/nonaktifkan layanan yang ditawarkan di marketplace.
                  </p>
                </div>
                <Link href="/owner/services/create">
                  <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
                    + Tambah Layanan Baru
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {laundryServices.map((service) => (
                  <div key={service.id} className="p-4 rounded-2xl border border-slate-200 space-y-3 bg-white shadow-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{service.name}</h4>
                        <p className="text-[11px] text-slate-500">{service.description}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        service.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {service.isActive ? 'Aktif' : 'Non-Aktif'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-black text-brand-primary">
                        {formatIDR(service.price)} / {service.unit}
                      </span>
                      <Link href={`/owner/services/${service.id}/edit`}>
                        <Button variant="outline" size="sm">
                          Edit Tarif
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* TAB 4: PROFIL MITRA & OPERASIONAL */}
          {activeTab === 'profile' && selectedLaundry && (
            <div className="space-y-6">
              
              {/* STOREFRONT 5-PHOTO GALLERY SECTION - INTERACTIVE OWNER MANAGEMENT */}
              <Card variant="white" className="p-6 space-y-4 border-slate-200/90 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Store className="w-5 h-5 text-brand-primary" />
                      <span>Galeri & Foto Utama Outlet (Maks. 5 Foto)</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Kelola foto outlet Anda yang tampil di marketplace FreshLaundry. Foto bertanda <span className="font-bold text-brand-primary">★ Foto Utama</span> akan tampil di kartu pencarian & urutan pertama galeri.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full border ${
                      ownerPhotos.length >= 5
                        ? 'text-amber-800 bg-amber-50 border-amber-300'
                        : 'text-emerald-800 bg-emerald-50 border-emerald-300'
                    }`}>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      {ownerPhotos.length} / 5 Foto Terpasang
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleUploadPhoto}
                      disabled={isPhotoUploading || ownerPhotos.length >= 5}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isPhotoUploading || ownerPhotos.length >= 5}
                      className="gap-1.5"
                    >
                      {isPhotoUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Mengunggah...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>+ Tambah Foto</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {photoError && (
                  <div className="p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-xs font-semibold flex items-center justify-between">
                    <span>{photoError}</span>
                    <button onClick={() => setPhotoError(null)} className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer">✕</button>
                  </div>
                )}
                {photoSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-semibold flex items-center justify-between">
                    <span>{photoSuccess}</span>
                    <button onClick={() => setPhotoSuccess(null)} className="text-emerald-500 hover:text-emerald-700 font-bold cursor-pointer">✕</button>
                  </div>
                )}

                {/* Photo Grid */}
                <div className="space-y-4 pt-1">
                  {ownerPhotos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                      {ownerPhotos.map((p, idx) => {
                        const isActionInProgress = photoActionId === p.id;
                        return (
                          <div
                            key={p.id}
                            className={`relative rounded-2xl overflow-hidden bg-slate-100 border-2 transition-all flex flex-col shadow-xs ${
                              p.is_primary ? 'border-brand-primary ring-2 ring-brand-primary/20' : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="relative aspect-[4/3] w-full bg-slate-200 overflow-hidden">
                              <img
                                src={p.public_url}
                                alt={`Storefront ${idx + 1}`}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = CANONICAL_LAUNDRY_FALLBACK;
                                }}
                                className="w-full h-full object-cover"
                              />
                              {p.is_primary && (
                                <div className="absolute top-2 left-2 bg-brand-primary text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                                  <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" /> Foto Utama
                                </div>
                              )}
                              <div className="absolute bottom-2 right-2 bg-slate-900/70 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
                                #{idx + 1}
                              </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="p-2.5 bg-white border-t border-slate-100 flex items-center justify-between gap-1.5">
                              {!p.is_primary ? (
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimary(p.id)}
                                  disabled={isActionInProgress || photoActionId !== null}
                                  className="text-[11px] font-bold text-slate-700 hover:text-brand-primary hover:bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  {isActionInProgress ? 'Memproses...' : 'Jadikan Utama'}
                                </button>
                              ) : (
                                <span className="text-[11px] font-bold text-brand-primary px-1">
                                  Utama
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeletePhoto(p.id)}
                                disabled={isActionInProgress || photoActionId !== null}
                                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer ml-auto"
                                title="Hapus foto ini"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-sm text-slate-800">Belum ada foto galeri outlet</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          Unggah foto tampak depan toko atau mesin laundry Anda untuk meningkatkan kepercayaan pelanggan marketplace FreshLaundry.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isPhotoUploading}
                        className="gap-1.5"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Unggah Foto Pertama</span>
                      </Button>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
                    <span>
                      <strong>Tips Galeri Foto:</strong> Unggah foto beresolusi tinggi (format JPG, PNG, atau WebP, maks. 5MB). Foto pertama yang Anda unggah otomatis menjadi Foto Utama, atau Anda dapat menentukan Foto Utama kapan saja dengan tombol <em>Jadikan Utama</em>.
                    </span>
                  </div>
                </div>
              </Card>

              {/* EDITABLE BUSINESS INFORMATION FORM */}
              <Card variant="white" className="p-6 space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Informasi Operasional Mitra</h3>
                  <p className="text-xs text-slate-500">Perbarui nama toko, deskripsi, alamat, kontak, dan jam operasional.</p>
                </div>

                {profileSuccessMsg && (
                  <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200 text-xs font-bold">
                    ✓ {profileSuccessMsg}
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Nama Toko Laundry</label>
                      <input
                        type="text"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        required
                        className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Nomor Telepon / WA</label>
                      <input
                        type="text"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        required
                        className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Alamat Lengkap Outlet</label>
                    <textarea
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                      required
                      rows={2}
                      className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Deskripsi Singkat Toko</label>
                    <textarea
                      value={profileForm.description}
                      onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                      rows={2}
                      className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    />
                  </div>

                  {/* JAM OPERASIONAL INSIDE PROFIL MITRA */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-brand-primary" />
                      <span>Jam Operasional Toko</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Jam Buka</label>
                        <input
                          type="time"
                          value={profileForm.openingTime}
                          onChange={(e) => setProfileForm({ ...profileForm, openingTime: e.target.value })}
                          className="w-full text-xs font-semibold p-2 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Jam Tutup</label>
                        <input
                          type="time"
                          value={profileForm.closingTime}
                          onChange={(e) => setProfileForm({ ...profileForm, closingTime: e.target.value })}
                          className="w-full text-xs font-semibold p-2 rounded-xl border border-slate-200 bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="isOpenCheck"
                        checked={profileForm.isOpen}
                        onChange={(e) => setProfileForm({ ...profileForm, isOpen: e.target.checked })}
                        className="rounded text-brand-primary focus:ring-brand-primary"
                      />
                      <label htmlFor="isOpenCheck" className="text-xs font-bold text-slate-800 cursor-pointer">
                        Status Toko Buka Menerima Pesanan Customer
                      </label>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={isSavingProfile}
                      className="bg-brand-primary hover:bg-brand-primary/90 font-bold"
                    >
                      {isSavingProfile ? 'Menyimpan...' : 'Simpan Informasi Profil'}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Option B Weight Verification Modal (Single Source of Truth) */}
      {selectedOrderForVerification && (
        <WeightVerificationModal
          order={selectedOrderForVerification}
          onClose={() => setSelectedOrderForVerification(null)}
          onSuccess={async () => {
            setSelectedOrderForVerification(null);
            if (selectedLaundryId) {
              try {
                const updatedOrders = await orderService.getOrdersByLaundryAsync(selectedLaundryId);
                setLaundryOrders(updatedOrders);
              } catch (err) {
                console.warn('[OWNER-PAGE] Error refreshing orders after weight verification:', err);
              }
            }
          }}
        />
      )}
    </div>
  );
}

export default function LaundryOwnerDashboard() {
  return <OwnerDashboardContent />;
}
