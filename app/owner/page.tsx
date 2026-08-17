'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { orderService } from '@/services/orderService';
import { laundryService } from '@/services/laundryService';
import { partnerApplicationService, PartnerApplicationRecord } from '@/services/partnerApplicationService';
import { Order, OrderStatus } from '@/types/order';
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
  LogOut,
  Sparkles,
  Search,
  Filter,
  ShieldCheck,
  MapPin,
  Phone,
  AlertCircle,
  PlusCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';

type TabType = 'dashboard' | 'orders' | 'services' | 'revenue' | 'profile';

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

  useEffect(() => {
    let isMounted = true;

    const loadOwnerDashboard = async () => {
      setIsLoading(true);
      try {
        if (isSupabaseConfigured) {
          const profile = await authService.fetchCurrentProfile();
          if (!profile || profile.role !== 'laundry_owner') {
            if (isMounted) router.push('/customer');
            return;
          }

          if (isMounted) setCurrentUser(profile);

          // Query live Supabase laundries and partner application owned by authenticated owner
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
          // Dev/Mock fallback mode for unconfigured environment
          const user = authService.getCurrentUser();
          if (user.role !== 'laundry_owner') {
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

  // Load orders and services whenever selectedLaundryId changes
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
        console.warn('[OWNER-DASHBOARD] Error loading laundry orders/services:', err);
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

  // Statistics Calculation
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const ordersToday = laundryOrders.filter((o) => o.createdAt.startsWith(todayStr));

    const processingOrders = laundryOrders.filter(
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

    const totalRevenue = laundryOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.totalPrice, 0);

    return {
      todayCount: ordersToday.length,
      processingCount: processingOrders.length,
      completedCount: completedOrders.length,
      totalRevenue,
    };
  }, [laundryOrders]);

  // Filtered orders for table
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
                  {selectedLaundry ? selectedLaundry.name : 'Toko Laundry Pemilik'}
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
                Pemilik Mitra: <strong className="text-white">{currentUser?.fullName || 'Laundry Owner'}</strong> ({currentUser?.email || ''})
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

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pt-4 border-t border-white/10 relative z-10 scrollbar-none">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Store },
            { id: 'orders', label: `Orders (${laundryOrders.length})`, icon: ShoppingBag },
            { id: 'services', label: `Katalog Layanan (${laundryServices.length})`, icon: Layers },
            { id: 'revenue', label: 'Pendapatan & Payout', icon: DollarSign },
            { id: 'profile', label: 'Profil Toko', icon: UserCheck },
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
          {/* STATE B: PENDING APPROVAL */}
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

              <div className="pt-2 flex justify-center">
                <Link href="/owner/laundry/register">
                  <Button variant="outline" size="md" className="font-bold text-xs" leftIcon={<Eye className="w-4 h-4" />}>
                    Tinjau Form Pengajuan
                  </Button>
                </Link>
              </div>
            </div>
          ) : partnerApp?.status === 'rejected' ? (
            /* STATE D: REJECTED */
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
                  Pengajuan outlet <strong>{partnerApp.laundry_name}</strong> belum dapat disetujui. Silakan perbaiki sesuai catatan admin di bawah ini.
                </p>
              </div>

              {partnerApp.rejection_reason && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs text-left max-w-lg mx-auto space-y-1">
                  <span className="font-bold text-rose-700 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> Catatan Penolakan Admin:
                  </span>
                  <p className="pl-5 text-slate-800 italic">{partnerApp.rejection_reason}</p>
                </div>
              )}

              <div className="pt-2 flex justify-center">
                <Link href="/owner/laundry/register?revision=true">
                  <Button variant="primary" size="md" className="bg-teal-600 hover:bg-teal-500 font-bold text-xs" leftIcon={<Sparkles className="w-4 h-4" />}>
                    Perbaiki &amp; Ajukan Kembali
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            /* STATE A: NO APPLICATION (INITIAL ONBOARDING) */
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
                <Link href="/owner/laundry/register">
                  <Button variant="primary" size="lg" className="bg-teal-600 hover:bg-teal-500 font-bold text-xs shadow-lg" leftIcon={<PlusCircle className="w-4 h-4" />}>
                    + DAFTARKAN LAUNDRY
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto pt-6 border-t border-slate-100 text-left">
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Omset Total</span>
              <p className="text-sm font-black text-slate-800">Rp 0</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Order Hari Ini</span>
              <p className="text-sm font-black text-slate-800">0</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Diproses</span>
              <p className="text-sm font-black text-slate-800">0</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Selesai</span>
              <p className="text-sm font-black text-slate-800">0</p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* 2. Top Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card variant="white" className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-teal-50 text-teal-600">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500">Order Hari Ini</p>
                <h3 className="text-xl font-black text-slate-900">{stats.todayCount}</h3>
              </div>
            </Card>

            <Card variant="white" className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
                <Clock className="w-6 h-6 animate-spin-slow" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500">Sedang Diproses</p>
                <h3 className="text-xl font-black text-slate-900">{stats.processingCount}</h3>
              </div>
            </Card>

            <Card variant="white" className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500">Order Selesai</p>
                <h3 className="text-xl font-black text-slate-900">{stats.completedCount}</h3>
              </div>
            </Card>

            <Card variant="white" className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500">Total Omset</p>
                <h3 className="text-xl font-black text-slate-900">{formatIDR(stats.totalRevenue)}</h3>
              </div>
            </Card>
          </div>

          {/* 3. Main Content Views */}
          {activeTab === 'dashboard' || activeTab === 'orders' ? (
            <div className="space-y-6">
              {/* Search & Status Filter Controls */}
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
                  {['all', 'pending', 'in_washing', 'ready_for_delivery', 'delivered', 'cancelled'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 capitalize transition-colors cursor-pointer ${
                        statusFilter === status
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {status === 'all' ? 'Semua Status' : status.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </Card>

              {/* Orders Table */}
              <Card variant="white" className="overflow-hidden p-0 shadow-lg">
                {filteredOrders.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <Package className="w-12 h-12 text-slate-300 mx-auto" />
                    <h3 className="text-base font-bold text-slate-700">Belum Ada Transaksi</h3>
                    <p className="text-xs text-slate-500">Toko laundry ini belum menerima pesanan yang sesuai dengan filter.</p>
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
                                <div>{order.trackingNumber}</div>
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
                                    ? 'Menunggu Konfirmasi Laundry'
                                    : statusConfig.label}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-900">
                                {formatIDR(order.totalPrice)}
                              </td>
                              <td className="px-6 py-4 text-right space-y-1">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  {order.paymentStatus === 'paid' && order.status === 'pending' && (
                                    <>
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={async () => {
                                          try {
                                            await orderService.assignCourierAsync(order.id, undefined, undefined, currentUser?.id || 'usr_owner_01');
                                            alert(`Pesanan #${order.trackingNumber} berhasil dikonfirmasi! Sistem Dispatch Engine sedang mencari kurir terdekat.`);
                                            window.location.reload();
                                          } catch (err: any) {
                                            alert(err.message || 'Gagal mengonfirmasi pesanan.');
                                          }
                                        }}
                                      >
                                        Konfirmasi Pesanan
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                          try {
                                            const { dispatchService } = await import('@/services/dispatchService');
                                            await dispatchService.retryDispatchAsync(order.id, currentUser?.id || 'usr_owner_01');
                                            alert(`Mencari ulang kurir terdekat untuk pesanan #${order.trackingNumber}...`);
                                            window.location.reload();
                                          } catch (err: any) {
                                            alert(err.message || 'Gagal mencari kurir.');
                                          }
                                        }}
                                      >
                                        Cari Kurir Lagi
                                      </Button>
                                      <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={async () => {
                                          const reason = prompt('Masukkan alasan penolakan pesanan:', 'Toko laundry penuh');
                                          if (reason === null) return;
                                          try {
                                            await orderService.rejectOrderAsync(order.id, { id: currentUser?.id || 'usr_owner_01', role: 'laundry_owner', laundryId: order.laundryId }, reason);
                                            alert(`Pesanan #${order.trackingNumber} berhasil ditolak & diproses refund.`);
                                            window.location.reload();
                                          } catch (err: any) {
                                            alert(err.message || 'Gagal menolak pesanan.');
                                          }
                                        }}
                                      >
                                        Tolak
                                      </Button>
                                    </>
                                  )}
                                  {order.status === 'picked_up' && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          await orderService.transitionOrderStatusAsync(order.id, 'in_washing', { id: currentUser?.id || 'usr_owner_01', role: 'laundry_owner', laundryId: order.laundryId }, 'Masuk ke proses cuci & pengeringan');
                                          window.location.reload();
                                        } catch (err: any) {
                                          alert(err.message || 'Gagal mengubah status.');
                                        }
                                      }}
                                    >
                                      Mulai Pencucian
                                    </Button>
                                  )}
                                  {order.status === 'in_washing' && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          await orderService.transitionOrderStatusAsync(order.id, 'ready_for_delivery', { id: currentUser?.id || 'usr_owner_01', role: 'laundry_owner', laundryId: order.laundryId }, 'Cucian selesai & terkemas, siap diantar');
                                          window.location.reload();
                                        } catch (err: any) {
                                          alert(err.message || 'Gagal mengubah status.');
                                        }
                                      }}
                                    >
                                      Selesai Cucian
                                    </Button>
                                  )}
                                  {order.status === 'ready_for_delivery' && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          await orderService.createDeliveryAssignmentAsync(order.id, undefined, undefined, currentUser?.id || 'usr_owner_01');
                                          alert(`Dispatch Engine pengantaran pesanan #${order.trackingNumber} berhasil dimulai!`);
                                          window.location.reload();
                                        } catch (err: any) {
                                          alert(err.message || 'Gagal menugaskan kurir pengantar.');
                                        }
                                      }}
                                    >
                                      Cari Kurir Pengantar
                                    </Button>
                                  )}
                                  <Link href={`/orders/${order.id}`}>
                                    <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                                      Detail
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

          {activeTab === 'services' && (
            <Card variant="white" className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Katalog Layanan Toko</h3>
                  <p className="text-xs text-slate-500">Daftar tarif dan layanan yang tersedia di mitra laundry Anda.</p>
                </div>
              </div>

              {laundryServices.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">Belum ada layanan terdaftar untuk toko laundry ini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {laundryServices.map((srv) => (
                    <div key={srv.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{srv.name}</span>
                        <Badge variant="teal" size="sm">
                          {srv.unit}
                        </Badge>
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

          {activeTab === 'revenue' && (
            <Card variant="white" className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Ringkasan Pendapatan Mitra</h3>
              <p className="text-xs text-slate-500">Total akumulasi omset bruto dari seluruh transaksi non-batal.</p>
              <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-2">
                <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">Total Pendapatan Bruto</span>
                <h2 className="text-3xl font-black">{formatIDR(stats.totalRevenue)}</h2>
              </div>
            </Card>
          )}

          {activeTab === 'profile' && selectedLaundry && (
            <Card variant="white" className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Profil Detail Toko Laundry</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block font-bold uppercase">Nama Toko</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedLaundry.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase">Alamat</span>
                  <span className="font-medium text-slate-700">{selectedLaundry.address}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase">Telepon / WhatsApp</span>
                  <span className="font-medium text-slate-700">{selectedLaundry.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase">Jam Operasional</span>
                  <span className="font-medium text-slate-700">{selectedLaundry.openingTime} - {selectedLaundry.closingTime} WIB</span>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
