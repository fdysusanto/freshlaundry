'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { orderService } from '@/services/orderService';
import { laundryService } from '@/services/laundryService';
import { partnerApplicationService, PartnerApplicationRecord } from '@/services/partnerApplicationService';
import { Order } from '@/types/order';
import { Laundry, LaundryService as ServiceCatalogItem } from '@/types/laundry';
import { UserProfile } from '@/types/user';
import { formatIDR, formatDateIndo, formatDateTimeIndo } from '@/utils/formatters';
import { getStatusConfig } from '@/utils/helpers';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
  Save,
  Check,
} from 'lucide-react';

type TabType = 'dashboard' | 'orders' | 'services' | 'profile' | 'reviews';

const FALLBACK_STOREFRONT =
  'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80';

export default function LaundryOwnerDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [ownerLaundries, setOwnerLaundries] = useState<Laundry[]>([]);
  const [partnerApp, setPartnerApp] = useState<PartnerApplicationRecord | null>(null);
  const [selectedLaundryId, setSelectedLaundryId] = useState<string | null>(null);
  const [laundryOrders, setLaundryOrders] = useState<Order[]>([]);
  const [laundryServices, setLaundryServices] = useState<ServiceCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

          if (isMounted) setCurrentUser(profile);

          const [liveLaundries, livePartnerApp] = await Promise.all([
            laundryService.getLaundriesByOwnerAsync(profile.id),
            partnerApplicationService.getMyPartnerApplicationAsync(),
          ]);

          if (isMounted) {
            setOwnerLaundries(liveLaundries);
            setPartnerApp(livePartnerApp);

            if (liveLaundries.length > 0) {
              const activeId = profile.laundryId && liveLaundries.some((l) => l.id === profile.laundryId)
                ? profile.laundryId
                : liveLaundries[0].id;
              setSelectedLaundryId(activeId);
            } else {
              setSelectedLaundryId(null);
            }
          }
        } else {
          const user = authService.getCurrentUser();
          if (user.role !== 'laundry_owner' && user.role !== 'laundry_staff') {
            if (isMounted) router.push('/customer');
            return;
          }
          if (isMounted) {
            setCurrentUser(user);
            const mockLaundries = await laundryService.getLaundriesAsync();
            const ownedMock = mockLaundries.filter((l) => l.ownerId === user.id || l.id === user.laundryId);
            setOwnerLaundries(ownedMock);
            if (ownedMock.length > 0) {
              setSelectedLaundryId(ownedMock[0].id);
            } else {
              setSelectedLaundryId(null);
            }
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

  // Load orders and services when selected laundry changes
  useEffect(() => {
    let isMounted = true;

    const loadLaundryContent = async () => {
      if (!selectedLaundryId) {
        if (isMounted) {
          setLaundryOrders([]);
          setLaundryServices([]);
        }
        return;
      }

      try {
        if (isSupabaseConfigured) {
          const [ordersData, servicesData] = await Promise.all([
            orderService.getOrdersByLaundryAsync(selectedLaundryId),
            laundryService.getServicesByLaundryAsync(selectedLaundryId),
          ]);

          if (isMounted) {
            setLaundryOrders(ordersData);
            setLaundryServices(servicesData);
          }
        } else {
          const mockOrders = orderService.getOrdersByLaundry(selectedLaundryId);
          const mockServices = laundryService.getServicesByLaundry(selectedLaundryId);
          if (isMounted) {
            setLaundryOrders(mockOrders);
            setLaundryServices(mockServices);
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

  const selectedLaundry: Laundry | null = useMemo(() => {
    if (!selectedLaundryId || ownerLaundries.length === 0) return null;
    return ownerLaundries.find((l) => l.id === selectedLaundryId) || ownerLaundries[0] || null;
  }, [selectedLaundryId, ownerLaundries]);

  // Sync profile form when selected laundry changes
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

  // KPI Statistics Calculation
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const ordersToday = laundryOrders.filter((o) => o.createdAt.startsWith(todayStr));

    const activeOrders = laundryOrders.filter(
      (o) =>
        o.status === 'pending' ||
        o.status === 'assigned' ||
        o.status === 'picked_up' ||
        o.status === 'in_washing'
    );

    const completedOrders = laundryOrders.filter(
      (o) =>
        o.status === 'ready_for_delivery' ||
        o.status === 'out_for_delivery' ||
        o.status === 'delivered'
    );

    const todayRevenue = ordersToday
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.totalPrice, 0);

    return {
      todayCount: ordersToday.length,
      activeCount: activeOrders.length,
      completedCount: completedOrders.length,
      todayRevenue,
      rating: selectedLaundry?.rating || 5.0,
      totalReviews: selectedLaundry?.totalReviews || 0,
    };
  }, [laundryOrders, selectedLaundry]);

  // Filtered orders table
  const filteredOrders = useMemo(() => {
    return laundryOrders.filter((o) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        o.trackingNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.serviceName.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [laundryOrders, searchQuery, statusFilter]);

  // Save profile modifications
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLaundryId) return;
    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    try {
      if (isSupabaseConfigured) {
        const { supabase } = await import('@/services/supabase');
        if (supabase) {
          const { error } = await (supabase.from('laundries') as any)
            .update({
              name: profileForm.name.trim(),
              description: profileForm.description.trim(),
              phone: profileForm.phone.trim(),
              address: profileForm.address.trim(),
              opening_time: profileForm.openingTime,
              closing_time: profileForm.closingTime,
              is_open: profileForm.isOpen,
            })
            .eq('id', selectedLaundryId);

          if (error) throw error;
        }
      }
      setProfileSuccessMsg('Profil toko laundry berhasil diperbarui!');
      setTimeout(() => setProfileSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan profil laundry.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Memuat dashboard mitra laundry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      
      {/* 1. Header Profile & Multi-Laundry Switcher */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-teal-500/20 border border-teal-400/30 text-teal-300 font-black text-2xl flex items-center justify-center shrink-0">
              <Store className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-3xl font-black tracking-tight">
                  Selamat datang, {selectedLaundry ? selectedLaundry.name : currentUser?.fullName || 'Mitra Laundry'}
                </h1>
                {selectedLaundry && (
                  <>
                    <Badge variant="teal" size="sm">
                      {selectedLaundry.code}
                    </Badge>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        selectedLaundry.isOpen
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                      }`}
                    >
                      {selectedLaundry.isOpen ? '• Buka Menerima Order' : '• Tutup'}
                    </span>
                  </>
                )}
              </div>

              <p className="text-xs text-slate-300 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>{selectedLaundry ? selectedLaundry.address : 'Alamat Belum Terdaftar'}</span>
              </p>
              <p className="text-xs text-slate-400">
                Peranan: <strong className="text-white capitalize">{currentUser?.role.replace(/_/g, ' ')}</strong> ({currentUser?.email || ''})
              </p>
            </div>
          </div>

          {/* Multi-Laundry Switcher Select Box */}
          {ownerLaundries.length > 1 && (
            <div className="bg-white/10 p-3 rounded-2xl border border-white/15 space-y-1.5 shrink-0">
              <label className="text-[10px] font-bold uppercase text-slate-300 block tracking-wider">
                Pilih Toko Laundry:
              </label>
              <select
                value={selectedLaundryId || ''}
                onChange={(e) => setSelectedLaundryId(e.target.value)}
                className="text-xs font-bold bg-slate-900 text-teal-300 border border-teal-500/30 rounded-xl px-3 py-1.5 focus:outline-hidden cursor-pointer w-full"
              >
                {ownerLaundries.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Navigation Tabs Bar (Simple MVP Navigation) */}
        <div className="flex items-center gap-2 overflow-x-auto pt-4 border-t border-white/10 relative z-10 scrollbar-none">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Store },
            { id: 'orders', label: `Pesanan (${laundryOrders.length})`, icon: ShoppingBag },
            { id: 'services', label: `Layanan (${laundryServices.length})`, icon: Layers },
            { id: 'profile', label: 'Profil Mitra', icon: UserCheck },
            { id: 'reviews', label: `Ulasan (${selectedLaundry?.totalReviews || 0})`, icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                    : 'bg-white/5 hover:bg-white/15 text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ONBOARDING / EMPTY STATES FOR OWNER WITHOUT ACTIVE LAUNDRY */}
      {!selectedLaundry && ownerLaundries.length === 0 ? (
        <Card variant="white" className="p-8 sm:p-12 text-center space-y-6 shadow-xl border-teal-100 max-w-3xl mx-auto">
          {partnerApp?.status === 'pending' ? (
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-md animate-pulse">
                <Clock className="w-8 h-8" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <Badge variant="amber" className="font-bold text-xs px-3 py-1 uppercase tracking-wider mb-2">
                  🟡 Menunggu Verifikasi Admin
                </Badge>
                <h2 className="text-xl font-bold text-slate-900">
                  Pengajuan Laundry Sedang Diverifikasi
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Data outlet laundry Anda (<strong>{partnerApp.laundry_name}</strong>) diajukan pada{' '}
                  {formatDateIndo(partnerApp.created_at)} dan sedang diperiksa oleh tim Admin Platform FreshWash.
                </p>
              </div>
            </div>
          ) : partnerApp?.status === 'rejected' ? (
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-md">
                <XCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <Badge variant="rose" className="font-bold text-xs px-3 py-1 uppercase tracking-wider mb-2">
                  🔴 Pengajuan Ditolak
                </Badge>
                <h2 className="text-xl font-bold text-slate-900">
                  Pengajuan Laundry Perlu Perbaikan
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pengajuan outlet <strong>{partnerApp.laundry_name}</strong> belum dapat disetujui. Silakan perbaiki sesuai catatan admin.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto shadow-md">
                <Store className="w-8 h-8" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h2 className="text-xl font-bold text-slate-900">Anda Belum Memiliki Laundry Terdaftar</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Daftarkan usaha laundry Anda untuk mulai menerima pesanan dan mengelola operasional melalui FreshWash.
                </p>
              </div>
              <div className="pt-2 flex justify-center">
                <Link href="/auth/register/partner">
                  <Button variant="primary" size="lg" className="bg-teal-600 hover:bg-teal-500 font-bold text-xs shadow-lg" leftIcon={<PlusCircle className="w-4 h-4" />}>
                    + DAFTARKAN LAUNDRY
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* 2. Overview Metrics Cards (Requirement #9) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card variant="white" className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-teal-50 text-teal-600">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500">Pesanan Hari Ini</p>
                <h3 className="text-xl font-black text-slate-900">{stats.todayCount}</h3>
              </div>
            </Card>

            <Card variant="white" className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
                <Clock className="w-6 h-6 animate-spin-slow" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500">Pesanan Aktif</p>
                <h3 className="text-xl font-black text-slate-900">{stats.activeCount}</h3>
              </div>
            </Card>

            <Card variant="white" className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500">Pendapatan Hari Ini</p>
                <h3 className="text-xl font-black text-slate-900">{formatIDR(stats.todayRevenue)}</h3>
              </div>
            </Card>

            <Card variant="white" className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500">Rating Toko</p>
                <h3 className="text-xl font-black text-slate-900">★ {stats.rating.toFixed(1)}</h3>
              </div>
            </Card>
          </div>

          {/* 3. Main Views */}
          {activeTab === 'dashboard' || activeTab === 'orders' ? (
            <div className="space-y-6">
              {/* Filter & Search Bar */}
              <Card variant="white" className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari resi, nama, layanan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto scrollbar-none">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                  {[
                    { key: 'all', label: 'Semua Pesanan' },
                    { key: 'pending', label: 'Pesanan Baru' },
                    { key: 'in_washing', label: 'Diproses' },
                    { key: 'ready_for_delivery', label: 'Siap Diambil' },
                    { key: 'delivered', label: 'Selesai' },
                  ].map((st) => (
                    <button
                      key={st.key}
                      onClick={() => setStatusFilter(st.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                        statusFilter === st.key
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </Card>

              {/* Orders Table */}
              <Card variant="white" className="overflow-hidden p-0 shadow-lg">
                {filteredOrders.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <Package className="w-12 h-12 text-slate-300 mx-auto" />
                    <h3 className="text-base font-bold text-slate-700">Belum ada pesanan</h3>
                    <p className="text-xs text-slate-500">Toko laundry ini belum memiliki pesanan yang sesuai dengan filter.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4">No. Resi</th>
                          <th className="px-6 py-4">Pelanggan</th>
                          <th className="px-6 py-4">Layanan</th>
                          <th className="px-6 py-4">Status Pesanan</th>
                          <th className="px-6 py-4">Total</th>
                          <th className="px-6 py-4 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {filteredOrders.map((order) => {
                          const statusConfig = getStatusConfig(order.status);
                          return (
                            <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-900">
                                <div>#{order.trackingNumber}</div>
                                <div className="text-[10px] font-normal text-slate-400">{formatDateTimeIndo(order.createdAt)}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="font-bold text-slate-800">{order.customerName}</div>
                                <div className="text-[11px] text-slate-500">{order.customerPhone}</div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-semibold text-slate-800">{order.serviceName}</span>
                                {order.estimatedWeightKg && (
                                  <span className="text-[11px] text-slate-500 block">{order.estimatedWeightKg} kg</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusConfig.bg} ${statusConfig.color}`}>
                                  {order.paymentStatus === 'paid' && order.status === 'pending'
                                    ? 'Pesanan Baru (Perlu Konfirmasi)'
                                    : statusConfig.label}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-900">
                                {formatIDR(order.totalPrice)}
                              </td>
                              <td className="px-6 py-4 text-right space-y-1">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  {order.paymentStatus === 'paid' && order.status === 'pending' && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          await orderService.assignCourierAsync(order.id, undefined, undefined, currentUser?.id || '');
                                          alert(`Pesanan #${order.trackingNumber} berhasil dikonfirmasi!`);
                                          window.location.reload();
                                        } catch (err: any) {
                                          alert(err.message || 'Gagal mengonfirmasi pesanan.');
                                        }
                                      }}
                                    >
                                      Konfirmasi Pesanan
                                    </Button>
                                  )}
                                  {order.status === 'picked_up' && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          await orderService.transitionOrderStatusAsync(order.id, 'in_washing', { id: currentUser?.id || '', role: currentUser?.role || 'laundry_owner', laundryId: order.laundryId }, 'Masuk ke proses cuci');
                                          window.location.reload();
                                        } catch (err: any) {
                                          alert(err.message || 'Gagal merubah status.');
                                        }
                                      }}
                                    >
                                      Proses Cuci
                                    </Button>
                                  )}
                                  {order.status === 'in_washing' && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          await orderService.transitionOrderStatusAsync(order.id, 'ready_for_delivery', { id: currentUser?.id || '', role: currentUser?.role || 'laundry_owner', laundryId: order.laundryId }, 'Cucian selesai & siap diantar');
                                          window.location.reload();
                                        } catch (err: any) {
                                          alert(err.message || 'Gagal merubah status.');
                                        }
                                      }}
                                    >
                                      Siap Diantar
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
                )}
              </Card>
            </div>
          ) : null}

          {/* TAB LAYANAN */}
          {activeTab === 'services' && (
            <Card variant="white" className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Manajemen Layanan Laundry</h3>
                  <p className="text-xs text-slate-500">
                    Layanan terendah yang AKTIF akan otomatis ditampilkan pada marketplace ("Mulai Rp X/kg").
                  </p>
                </div>
                <Link href="/owner/services">
                  <Button variant="primary" size="sm" leftIcon={<Layers className="w-4 h-4" />}>
                    Kelola Katalog Layanan
                  </Button>
                </Link>
              </div>

              {laundryServices.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">Belum ada layanan terdaftar untuk toko ini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {laundryServices.map((srv) => (
                    <div
                      key={srv.id}
                      className={`p-4 rounded-2xl border space-y-2 transition-all ${
                        srv.isActive ? 'bg-slate-50/80 border-slate-200' : 'bg-rose-50/30 border-rose-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{srv.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          srv.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {srv.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{srv.description}</p>
                      <div className="pt-2 flex items-center justify-between border-t border-slate-200/60">
                        <span className="text-xs font-black text-teal-700">{formatIDR(srv.price)} / {srv.unit}</span>
                        <span className="text-[11px] font-semibold text-slate-400">{srv.estimatedHours || 24} Jam</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* TAB PROFIL MITRA (Contains Storefront Photo Permission Restriction & Operating Hours) */}
          {activeTab === 'profile' && selectedLaundry && (
            <div className="space-y-6">
              
              {/* REQUIREMENT #11: STOREFRONT PHOTO SECTION - STRICTLY READ ONLY */}
              <Card variant="white" className="p-6 space-y-4 border-amber-200/80 bg-amber-50/20">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Store className="w-5 h-5 text-teal-600" />
                      <span>Foto Storefront Mitra Laundry</span>
                    </h3>
                    <p className="text-xs text-slate-500">Foto fisik tampak depan toko mitra yang tampil pada marketplace.</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ✓ Foto telah diverifikasi
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-2">
                  <div className="w-full sm:w-48 aspect-[4/3] rounded-2xl overflow-hidden bg-slate-200 shrink-0 shadow-md">
                    <img
                      src={selectedLaundry.logoUrl || FALLBACK_STOREFRONT}
                      alt={`Storefront ${selectedLaundry.name}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="space-y-3 flex-1">
                    <div className="p-4 bg-slate-900 text-white rounded-2xl text-xs space-y-1.5 shadow-sm">
                      <p className="font-bold flex items-center gap-1.5 text-amber-300">
                        <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                        Otorisasi Khusus Admin Platform:
                      </p>
                      <p className="text-slate-300 leading-relaxed italic">
                        "Foto mitra dikelola oleh Admin Platform. Hubungi Admin jika ingin mengganti foto."
                      </p>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Demi menjaga kualitas dan keaslian foto marketplace FreshLaundry, Pemilik dan Staf Mitra tidak memiliki wewenang untuk mengganti foto secara mandiri.
                    </p>
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
                        className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Nomor Telepon / WA</label>
                      <input
                        type="text"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        required
                        className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
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
                      className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Deskripsi Singkat Toko</label>
                    <textarea
                      value={profileForm.description}
                      onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                      rows={2}
                      className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {/* JAM OPERASIONAL INSIDE PROFIL MITRA (Requirement #7) */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-teal-600" />
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
                        className="rounded text-teal-600 focus:ring-teal-500"
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
                      leftIcon={<Save className="w-4 h-4" />}
                      className="bg-teal-600 hover:bg-teal-500 font-bold shadow-md cursor-pointer"
                    >
                      {isSavingProfile ? 'Menyimpan...' : 'Simpan Perubahan Profil'}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {/* TAB ULASAN */}
          {activeTab === 'reviews' && selectedLaundry && (
            <Card variant="white" className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Ulasan &amp; Rating Pelanggan</h3>
              <p className="text-xs text-slate-500">Seluruh ulasan dan penilaian bintang dari pelanggan yang telah memesan.</p>
              
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-4">
                <div className="text-center">
                  <span className="text-3xl font-black text-amber-600 block">★ {selectedLaundry.rating.toFixed(1)}</span>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">{selectedLaundry.totalReviews} Ulasan Total</span>
                </div>
                <p className="text-xs text-slate-600">
                  Terus pertahankan kualitas cuci dan ketepatan waktu pengantaran untuk meraih kepercayaan pelanggan yang lebih tinggi.
                </p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
