'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { orderService } from '@/services/orderService';
import { laundryService } from '@/services/laundryService';
import { laundryPhotoService } from '@/services/laundryPhotoService';
import { partnerApplicationService, PartnerApplicationRecord } from '@/services/partnerApplicationService';
import { Order } from '@/types/order';
import { Laundry, LaundryService as ServiceCatalogItem, LaundryPhoto } from '@/types/laundry';
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
  Star,
  Check,
  Image as ImageIcon,
} from 'lucide-react';

const FALLBACK_STOREFRONT =
  'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80';

export default function OwnerDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [ownerLaundries, setOwnerLaundries] = useState<Laundry[]>([]);
  const [selectedLaundryId, setSelectedLaundryId] = useState<string | null>(null);
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

  // Weigh & Verify Modal State
  const [weighModalOrder, setWeighModalOrder] = useState<Order | null>(null);
  const [weighInput, setWeighInput] = useState<string>('');
  const [isSubmittingWeigh, setIsSubmittingWeigh] = useState(false);
  const [weighError, setWeighError] = useState<string | null>(null);
  const [weighSuccessMsg, setWeighSuccessMsg] = useState<string | null>(null);

  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  const openWeighModal = (order: Order) => {
    setWeighModalOrder(order);
    setWeighInput(order.finalWeightKg ? String(order.finalWeightKg) : String(order.estimatedWeightKg || 5));
    setWeighError(null);
    setWeighSuccessMsg(null);
  };

  const handleSaveWeighVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weighModalOrder || !currentUser || isSubmittingWeigh) return;

    const rawNum = Number(weighInput);
    if (isNaN(rawNum) || !isFinite(rawNum) || rawNum <= 0) {
      setWeighError('Masukkan angka berat aktual yang valid (harus berupa angka > 0 kg).');
      return;
    }

    const parsedWeight = Math.round(rawNum * 100) / 100;
    if (parsedWeight <= 0) {
      setWeighError('Masukkan angka berat aktual yang valid (> 0 kg).');
      return;
    }

    setIsSubmittingWeigh(true);
    setWeighError(null);

    try {
      const sessionRes = await supabase?.auth?.getSession();
      const token = sessionRes?.data?.session?.access_token;

      const apiRes = await fetch(`/api/orders/${weighModalOrder.id}/weigh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ finalWeightKg: parsedWeight }),
      });

      const apiData = await apiRes.json();
      if (!apiRes.ok || !apiData.success) {
        throw new Error(apiData.message || 'Gagal menyimpan penimbangan di server.');
      }

      const res = apiData;

      let msg = `Penimbangan berhasil disimpan! Berat aktual: ${parsedWeight} kg (Total: ${formatIDR(res.order.totalPrice)})`;
      if (res.priceDelta > 0) {
        if (res.adjustmentPaymentAttempt) {
          msg += `. Selisih +${formatIDR(res.priceDelta)} perlu dibayar customer sebelum pencucian.`;
        } else {
          msg += `. Selisih +${formatIDR(res.priceDelta)} terdeteksi, namun pembuatan tiket pembayaran mengalami kendala.`;
        }
      } else if (res.priceDelta < 0) {
        msg += `. Berat lebih rendah dari estimasi. Selisih: -${formatIDR(Math.abs(res.priceDelta))}. Catatan: Pengembalian dana otomatis belum tersedia (kelebihan pembayaran dicatat).`;
      } else {
        msg += `. Berat sesuai estimasi. Cucian siap diproses.`;
      }

      setWeighSuccessMsg(msg);
      setTimeout(() => {
        setWeighModalOrder(null);
        setWeighSuccessMsg(null);
        window.location.reload();
      }, 2500);
    } catch (err: any) {
      setWeighError(err.message || 'Gagal menyimpan penimbangan.');
    } finally {
      setIsSubmittingWeigh(false);
    }
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

  const selectedLaundry = useMemo(() => {
    return ownerLaundries.find((l) => l.id === selectedLaundryId) || ownerLaundries[0] || null;
  }, [ownerLaundries, selectedLaundryId]);

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

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [laundryOrders, searchQuery, statusFilter]);

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

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500">Memuat Dashboard Partner FreshLaundry...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* HEADER DASHBOARD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard Mitra Laundry</h1>
            <span className="text-xs font-extrabold px-3 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
              Partner Portal
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Selamat datang, <strong className="text-slate-800">{currentUser?.fullName || 'Mitra Laundry'}</strong> ({currentUser?.email})
          </p>
        </div>

        {/* Laundry Outlet Selector if Owner has multiple stores */}
        {ownerLaundries.length > 1 && (
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-slate-400" />
            <select
              value={selectedLaundryId || ''}
              onChange={(e) => setSelectedLaundryId(e.target.value)}
              className="text-xs font-bold p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              {ownerLaundries.map((lnd) => (
                <option key={lnd.id} value={lnd.id}>
                  {lnd.name} ({lnd.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* NO LAUNDRY OUTLET / PENDING APPLICATION NOTICE */}
      {!selectedLaundry ? (
        <Card variant="white" className="p-8 text-center space-y-4 max-w-xl mx-auto border-amber-200 bg-amber-50/30">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Belum Memiliki Outlet Laundry Aktif</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Akun Anda saat ini terdaftar sebagai Mitra, namun belum memiliki outlet laundry yang terverifikasi di platform FreshWash.
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
              <Button variant="primary" size="md" className="bg-teal-600 hover:bg-teal-500 font-bold text-xs">
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
            <div className="space-y-6">
              {/* METRIC CARDS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card variant="white" className="p-5 border-teal-100 bg-teal-50/30 space-y-2">
                  <div className="flex items-center justify-between text-teal-800">
                    <span className="text-xs font-bold">Total Pendapatan Selesai</span>
                    <DollarSign className="w-5 h-5 text-teal-600" />
                  </div>
                  <p className="text-2xl font-black text-teal-900">{formatIDR(metrics.totalRevenue)}</p>
                  <p className="text-[11px] text-teal-700 font-semibold">{metrics.completedOrdersCount} pesanan selesai</p>
                </Card>

                <Card variant="white" className="p-5 border-amber-100 bg-amber-50/30 space-y-2">
                  <div className="flex items-center justify-between text-amber-800">
                    <span className="text-xs font-bold">Pesanan Perlu Tindakan</span>
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="text-2xl font-black text-amber-900">{metrics.pendingActionCount}</p>
                  <p className="text-[11px] text-amber-700 font-semibold">Tiba di outlet &amp; siap diproses</p>
                </Card>

                <Card variant="white" className="p-5 border-blue-100 bg-blue-50/30 space-y-2">
                  <div className="flex items-center justify-between text-blue-800">
                    <span className="text-xs font-bold">Pesanan Aktif Diproses</span>
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-2xl font-black text-blue-900">{metrics.activeOrdersCount}</p>
                  <p className="text-[11px] text-blue-700 font-semibold">Proses pencucian &amp; pengantaran</p>
                </Card>

                <Card variant="white" className="p-5 border-purple-100 bg-purple-50/30 space-y-2">
                  <div className="flex items-center justify-between text-purple-800">
                    <span className="text-xs font-bold">Rating Mitra Laundry</span>
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  </div>
                  <p className="text-2xl font-black text-purple-900">★ {selectedLaundry.rating.toFixed(1)}</p>
                  <p className="text-[11px] text-purple-700 font-semibold">{selectedLaundry.totalReviews} ulasan customer</p>
                </Card>
              </div>

              {/* RECENT ORDERS TABLE BRIEF */}
              <Card variant="white" className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-teal-600" />
                    <span>Pesanan Masuk Terbaru ({laundryOrders.slice(0, 5).length})</span>
                  </h3>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab('orders')}>
                    Lihat Semua Pesanan
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50">
                        <th className="p-3">No. Tracking</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Layanan</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Total</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {laundryOrders.slice(0, 5).map((order) => {
                        const statusCfg = getStatusConfig(order.status);
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/80">
                            <td className="p-3 font-bold text-slate-800">{order.trackingNumber}</td>
                            <td className="p-3 font-semibold text-slate-700">{order.customerName || 'Customer'}</td>
                            <td className="p-3 text-slate-600">{order.serviceType}</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.bg} ${statusCfg.color}`}>
                                {statusCfg.label}
                              </span>
                            </td>
                            <td className="p-3 font-black text-slate-900">{formatIDR(order.totalPrice)}</td>
                            <td className="p-3 text-right">
                              <Link href={`/orders/${order.id}`}>
                                <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                                  Detail
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: DAFTAR PESANAN FULL */}
          {activeTab === 'orders' && (
            <Card variant="white" className="p-6 space-y-6">
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
                            {order.finalWeightKg ? `${order.finalWeightKg} kg (Final)` : `${order.estimatedWeightKg || '-'} kg (Est)`}
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
                              {!order.finalWeightKg && (order.status === 'pending' || order.status === 'assigned' || order.status === 'picked_up') && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="bg-amber-600 hover:bg-amber-500 font-bold flex items-center gap-1"
                                  onClick={() => openWeighModal(order)}
                                >
                                  ⚖️ Terima &amp; Timbang
                                </Button>
                              )}
                              {order.finalWeightKg && (order.status === 'picked_up' || order.status === 'assigned') && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="bg-teal-600 hover:bg-teal-500 font-bold flex items-center gap-1"
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
                      <span className="text-sm font-black text-teal-700">
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
              
              {/* STOREFRONT 5-PHOTO GALLERY SECTION - READ ONLY */}
              <Card variant="white" className="p-6 space-y-4 border-amber-200/80 bg-amber-50/20">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Store className="w-5 h-5 text-teal-600" />
                      <span>Galeri Foto Storefront Mitra (5 Foto)</span>
                    </h3>
                    <p className="text-xs text-slate-500">Foto fisik tampak depan toko mitra yang tampil pada marketplace FreshLaundry.</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ✓ Foto terverifikasi ({ownerPhotos.length} / 5)
                  </span>
                </div>

                {/* READ ONLY 5-PHOTO GALLERY */}
                <div className="space-y-3 pt-1">
                  {ownerPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {ownerPhotos.map((p, idx) => (
                        <div key={p.id} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-200 border-2 border-slate-200 shadow-xs">
                          <img src={p.public_url} alt={`Storefront ${idx + 1}`} className="w-full h-full object-cover" />
                          {p.is_primary && (
                            <div className="absolute top-1.5 left-1.5 bg-teal-800 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-300 text-amber-300" /> Utama
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-2">
                      <div className="w-full sm:w-48 aspect-[4/3] rounded-2xl overflow-hidden bg-slate-200 shrink-0 shadow-md">
                        <img
                          src={selectedLaundry.logoUrl || FALLBACK_STOREFRONT}
                          alt={`Storefront ${selectedLaundry.name}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-xs text-slate-800">Foto Utama Standar Storefront</p>
                        <p className="text-xs text-slate-500">Belum ada galeri 5 foto yang diunggah oleh Platform Admin.</p>
                      </div>
                    </div>
                  )}

                  {/* READ ONLY NOTICE BANNER */}
                  <div className="p-4 bg-slate-900 text-white rounded-2xl text-xs space-y-1.5 shadow-sm mt-3">
                    <p className="font-bold flex items-center gap-1.5 text-amber-300">
                      <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                      Otorisasi Khusus Admin Platform:
                    </p>
                    <p className="text-slate-300 leading-relaxed italic">
                      "Foto mitra dikelola oleh Admin Platform. Hubungi Admin jika ingin mengganti foto."
                    </p>
                    <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                      Demi menjaga kualitas dan keaslian foto marketplace FreshLaundry, Pemilik dan Staf Mitra tidak memiliki wewenang untuk menambah, mengubah, atau menghapus foto secara mandiri.
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

                  {/* JAM OPERASIONAL INSIDE PROFIL MITRA */}
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
                      className="bg-teal-600 hover:bg-teal-500 font-bold"
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

      {/* MODAL VERIFIKASI & TIMBANG LAUNDRY */}
      {weighModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Verifikasi &amp; Timbang Laundry</h3>
                <p className="text-xs text-slate-500 font-medium">Order #{weighModalOrder.trackingNumber}</p>
              </div>
              <button
                onClick={() => setWeighModalOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveWeighVerification} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl space-y-2 border border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Customer:</span>
                  <span className="font-bold text-slate-900">{weighModalOrder.customerName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Berat Estimasi (Awal):</span>
                  <span className="font-semibold text-slate-800">{weighModalOrder.estimatedWeightKg || 5} kg</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Harga Estimasi (Awal):</span>
                  <span className="font-semibold text-slate-800">{formatIDR(weighModalOrder.totalPrice)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">
                  Berat Aktual Timbangan (kg) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    value={weighInput}
                    onChange={(e) => setWeighInput(e.target.value)}
                    className="w-full text-base font-extrabold p-3 rounded-2xl border-2 border-teal-500 bg-teal-50/20 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                    placeholder="Contoh: 7.0"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">kg</span>
                </div>
              </div>

              {/* Server-Side Calculated Actual Summary Preview */}
              {(() => {
                const w = parseFloat(weighInput);
                if (isNaN(w) || w <= 0) return null;
                const unitPrice = weighModalOrder.items[0]?.unitPrice || 8000;
                const estTotal = Math.round(weighModalOrder.totalPrice);
                const actualTotal = Math.round(
                  (w * unitPrice) + (weighModalOrder.deliveryFee || 0) + (weighModalOrder.platformFee || 2000) - (weighModalOrder.discount || 0)
                );
                const delta = actualTotal - estTotal;

                return (
                  <div className="p-3 bg-teal-50/60 border border-teal-200 rounded-2xl space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-teal-800 font-medium">Harga per kg:</span>
                      <span className="font-bold text-slate-800">{formatIDR(unitPrice)} / kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-teal-800 font-medium">Harga Aktual (Server Calculated):</span>
                      <span className="font-black text-teal-900">{formatIDR(actualTotal)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-teal-200 font-bold">
                      <span className="text-slate-800">Selisih Penyesuaian Harga:</span>
                      <span className={delta > 0 ? 'text-amber-700 font-black' : delta < 0 ? 'text-blue-700 font-black' : 'text-emerald-700 font-black'}>
                        {delta > 0 ? `+${formatIDR(delta)}` : delta < 0 ? `-${formatIDR(Math.abs(delta))}` : 'Rp 0'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {weighError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{weighError}</span>
                </div>
              )}

              {weighSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{weighSuccessMsg}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setWeighModalOrder(null)}
                  className="w-1/2 font-bold"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmittingWeigh}
                  className="w-1/2 bg-teal-600 hover:bg-teal-500 font-bold"
                >
                  {isSubmittingWeigh ? 'Menyimpan...' : 'Simpan & Verifikasi'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
