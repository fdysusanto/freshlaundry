'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { partnerApplicationService, PartnerApplicationRecord } from '@/services/partnerApplicationService';
import { marketplaceService } from '@/services/marketplaceService';
import { useLocationState } from '@/hooks/useLocationState';
import { isSupabaseConfigured } from '@/services/supabase';
import { Order, normalizeOrderStatus } from '@/types/order';
import { UserProfile } from '@/types/user';
import { LaundryMarketplaceItem, ServiceCategory } from '@/types/laundry';
import { CategoryShortcut, CategoryFilterType } from '@/components/marketplace/CategoryShortcut';
import { LaundryPartnerCard } from '@/components/marketplace/LaundryPartnerCard';
import { LaundryCardSkeleton } from '@/components/ui/MarketplaceSkeleton';
import { formatIDR, formatDateIndo } from '@/utils/formatters';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Search, AlertTriangle, Store } from 'lucide-react';

export default function CustomerDashboardPage() {
  const router = useRouter();
  const locationState = useLocationState();
  const { marketplaceLocation } = locationState;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [partnerApp, setPartnerApp] = useState<PartnerApplicationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Customer Home Marketplace Data, Category & Search State
  const [marketplaceItems, setMarketplaceItems] = useState<LaundryMarketplaceItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilterType>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMarketplaceLoading, setIsMarketplaceLoading] = useState(true);

  // Category shortcut expansion state
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  const [hasMoreThanTwoCategoryRows, setHasMoreThanTwoCategoryRows] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoading(true);
      let loadedOrders: Order[] = [];
      if (isSupabaseConfigured) {
        const liveProfile = await authService.fetchCurrentProfile();
        if (!liveProfile) {
          if (isMounted) router.push('/login');
          return;
        }
        if (liveProfile.role !== 'customer') {
          if (isMounted) {
            if (liveProfile.role === 'courier') router.push('/courier');
            else if (liveProfile.role === 'laundry_owner' || liveProfile.role === 'laundry_staff') router.push('/owner');
            else if (liveProfile.role === 'admin' || liveProfile.role === 'platform_admin') router.push('/admin');
            else router.push('/');
          }
          return;
        }
        if (isMounted) setUser(liveProfile);

        try {
          loadedOrders = await orderService.getOrdersByCustomerAsync(liveProfile.id);
          if (isMounted) setOrders(loadedOrders);

          const livePartnerApp = await partnerApplicationService.getMyPartnerApplicationAsync();
          if (isMounted) setPartnerApp(livePartnerApp);
        } catch (err) {
          console.warn('Live dashboard load warning:', err);
          if (isMounted) setOrders([]);
        } finally {
          if (isMounted) setIsLoading(false);
        }
      } else {
        const currentUser = authService.getCurrentUser();
        if (currentUser && currentUser.role !== 'customer') {
          if (isMounted) {
            if (currentUser.role === 'courier') router.push('/courier');
            else if (currentUser.role === 'laundry_owner' || currentUser.role === 'laundry_staff') router.push('/owner');
            else if (currentUser.role === 'admin' || currentUser.role === 'platform_admin') router.push('/admin');
            else router.push('/');
          }
          return;
        }
        if (isMounted) {
          setUser(currentUser);
          loadedOrders = currentUser ? orderService.getOrdersByCustomer(currentUser.id) : [];
          setOrders(loadedOrders);
          setIsLoading(false);
        }
      }
    };

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [router]);

  // Fetch Marketplace Partners for Home using Location State
  const loadMarketplaceData = useCallback(async () => {
    setIsMarketplaceLoading(true);
    try {
      let userLat: number | null = null;
      let userLng: number | null = null;

      if (
        marketplaceLocation.latitude !== null &&
        marketplaceLocation.longitude !== null
      ) {
        userLat = Number(marketplaceLocation.latitude);
        userLng = Number(marketplaceLocation.longitude);
      }

      const items = await marketplaceService.getNearbyLaundryPartnersAsync(userLat, userLng);
      setMarketplaceItems(items);
    } catch (err: any) {
      console.warn('[CUSTOMER-HOME] Error loading marketplace data:', err);
      setMarketplaceItems([]);
    } finally {
      setIsMarketplaceLoading(false);
    }
  }, [marketplaceLocation.latitude, marketplaceLocation.longitude]);

  useEffect(() => {
    loadMarketplaceData();
  }, [loadMarketplaceData]);

  // Category & Search Filtering for Home
  const filteredPartners = useMemo(() => {
    return marketplaceItems.filter((item) => {
      // 1. Category Filter
      const matchesCategory =
        selectedCategory === 'Semua' ||
        item.serviceCategories?.includes(selectedCategory as ServiceCategory);

      // 2. Search Query Filter
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.laundry.name.toLowerCase().includes(q) ||
        item.laundry.address?.toLowerCase().includes(q) ||
        item.serviceCategories?.some((cat) => cat.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [marketplaceItems, selectedCategory, searchQuery]);

  const pastOrders = orders.filter((o) => {
    const norm = normalizeOrderStatus(o.status);
    return norm === 'delivered' || norm === 'cancelled';
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Memuat Customer Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5 space-y-5 pb-24 md:pb-12">
      {/* 🏷️ SOFT CUCIYAN HERO GRADIENT ZONE */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-brand-surface via-sky-50/40 to-white p-5 sm:p-7 border border-slate-200/50 shadow-2xs space-y-4 transition-all">
        {/* Soft Radial Brand Glow Overlays (Decorative & Pointer Events None) */}
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-brand-secondary/12 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-brand-primary/8 rounded-full blur-3xl pointer-events-none" />

        {/* 1. Customer Greeting (Small & Subtle) */}
        <div className="relative z-10 space-y-0.5">
          <p className="text-xs sm:text-sm font-semibold text-brand-primary/80">
            Halo, {user?.fullName || 'Pelanggan Setia'} 👋
          </p>
        </div>

        {/* 2. Minimal Hero & Subhero */}
        <div className="relative z-10 space-y-1">
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Laundry terdekat,<br />
            lebih mudah!
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            Pilih layanan, atur jadwal, beres!
          </p>
        </div>

        {/* 3. Search Bar */}
        <div className="relative z-10 w-full max-w-xl pt-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-20">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari laundry atau layanan..."
            className="w-full h-11 sm:h-12 pl-10 pr-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs focus:outline-none focus:ring-2 focus:ring-brand-primary text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-slate-400 hover:text-slate-600 font-bold z-20"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Partner Application Status Card / CTA Banner */}
      {user?.role === 'laundry_owner' ? (
        <Card variant="white" className="bg-gradient-to-r from-emerald-50 to-brand-surface border-emerald-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="emerald" className="font-bold">PEMILIK MITRA LAUNDRY</Badge>
            </div>
            <h3 className="text-sm font-bold text-slate-900">Anda terdaftar sebagai Pemilik Mitra Laundry</h3>
            <p className="text-xs text-slate-600">Kelola outlet, pesanan masuk, dan tarif layanan di Owner Dashboard.</p>
          </div>
          <Link href="/owner">
            <Button variant="primary" size="md" className="shrink-0 font-bold">
              Buka Owner Dashboard
            </Button>
          </Link>
        </Card>
      ) : partnerApp?.status === 'pending' ? (
        <Card variant="white" className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="amber" className="font-bold">PENDING VERIFICATION</Badge>
              <span className="text-xs text-amber-800 font-semibold">{partnerApp.laundry_name}</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900">Pengajuan Mitra Laundry Sedang Diverifikasi</h3>
            <p className="text-xs text-slate-600">Tim platform kami sedang meninjau outlet usaha Anda. Anda tidak perlu mengajukan form baru.</p>
          </div>
          <Link href="/register/partner/status">
            <Button variant="outline" size="md" className="shrink-0 font-bold border-amber-300 hover:bg-amber-100 text-amber-900">
              Lihat Status Pengajuan
            </Button>
          </Link>
        </Card>
      ) : partnerApp?.status === 'rejected' ? (
        <Card variant="white" className="bg-rose-50 border-rose-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="rose" className="font-bold">PENGAJUAN DITOLAK</Badge>
            </div>
            <h3 className="text-sm font-bold text-rose-900">Pengajuan Mitra Laundry Ditolak</h3>
            <p className="text-xs text-rose-700">{partnerApp.rejection_reason || 'Silakan periksa detail penolakan dan lakukan revisi data.'}</p>
          </div>
          <Link href="/register/partner/status">
            <Button variant="primary" size="md" className="shrink-0 font-bold">
              Revisi &amp; Lihat Detail
            </Button>
          </Link>
        </Card>
      ) : null}

      {/* 5. Category Section: Heading + Lihat semua → Link + Collapsible CategoryShortcut */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
            Kategori Layanan
          </h2>
          {hasMoreThanTwoCategoryRows && (
            <button
              type="button"
              aria-expanded={isCategoryExpanded}
              onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
              className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer select-none"
            >
              <span>{isCategoryExpanded ? 'Tampilkan lebih sedikit ↑' : 'Lihat semua →'}</span>
            </button>
          )}
        </div>

        {/* 2-Row Collapsible Category Shortcut Grid */}
        <CategoryShortcut
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          isExpanded={isCategoryExpanded}
          onToggleExpand={() => setIsCategoryExpanded(!isCategoryExpanded)}
          hideBottomToggle={true}
          onHasMoreThanTwoRowsChange={setHasMoreThanTwoCategoryRows}
        />
      </div>

      {/* 6. Mitra Laundry Terdekat & Partner List */}
      <div className="space-y-3.5 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-brand-primary shrink-0" />
              <span>Mitra Laundry Terdekat</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Pilih dari mitra laundry terbaik di sekitar Anda
            </p>
          </div>
          <Link href="/customer/laundries" className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1 shrink-0">
            Lihat Semua →
          </Link>
        </div>

        {/* 7. Laundry Partner Cards */}
        {isMarketplaceLoading ? (
          <div className="flex flex-col gap-3.5">
            {[1, 2, 3].map((i) => (
              <LaundryCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredPartners.length > 0 ? (
          <div className="flex flex-col gap-3.5">
            {filteredPartners.slice(0, 5).map((item) => (
              <LaundryPartnerCard key={item.laundry.id} item={item} />
            ))}
          </div>
        ) : (
          <Card variant="white" className="p-8 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">
              {searchQuery
                ? `Belum Ada Laundry dengan Pencarian "${searchQuery}"`
                : selectedCategory !== 'Semua'
                ? `Belum Ada Laundry untuk Kategori "${selectedCategory}"`
                : 'Belum Ada Mitra Laundry Terdekat'}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `Tidak ditemukan mitra laundry yang cocok dengan kata kunci "${searchQuery}".`
                : selectedCategory !== 'Semua'
                ? `Tidak ditemukan mitra laundry yang menyediakan layanan ${selectedCategory} di sekitar lokasi Anda.`
                : 'Belum ada mitra laundry yang terdaftar di sekitar lokasi Anda.'}
            </p>
            {(selectedCategory !== 'Semua' || searchQuery) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCategory('Semua');
                  setSearchQuery('');
                }}
                className="mt-2 text-xs font-semibold"
              >
                Reset Filter &amp; Pencarian
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
        <Card variant="white" className="p-4 flex items-center justify-between hover:border-brand-secondary transition-all">
          <div className="space-y-0.5">
            <h3 className="font-bold text-slate-900 text-sm">🔍 Cari Laundry</h3>
            <p className="text-xs text-slate-500">Jelajahi mitra laundry terdekat</p>
          </div>
          <Link href="/customer/laundries">
            <Button variant="outline" size="sm" className="font-bold border-brand-secondary/40 text-brand-primary">
              Jelajahi →
            </Button>
          </Link>
        </Card>

        <Card variant="white" className="p-4 flex items-center justify-between hover:border-brand-secondary transition-all">
          <div className="space-y-0.5">
            <h3 className="font-bold text-slate-900 text-sm">📜 Riwayat Pesanan</h3>
            <p className="text-xs text-slate-500">Arsip pesanan laundry selesai</p>
          </div>
          <Link href="/customer/orders">
            <Button variant="outline" size="sm" className="font-bold border-slate-200">
              Buka →
            </Button>
          </Link>
        </Card>

        <Card variant="white" className="p-4 flex items-center justify-between hover:border-brand-secondary transition-all">
          <div className="space-y-0.5">
            <h3 className="font-bold text-slate-900 text-sm">📍 Alamat Saya</h3>
            <p className="text-xs text-slate-500">Atur lokasi penjemputan &amp; pengantaran</p>
          </div>
          <Link href="/customer/addresses">
            <Button variant="outline" size="sm" className="font-bold border-slate-200">
              Atur →
            </Button>
          </Link>
        </Card>
      </div>

      {/* Past Orders History Summary */}
      {pastOrders.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Riwayat Pesanan Selesai</h2>
            <Link href="/customer/orders/history" className="text-xs font-bold text-brand-primary hover:underline">
              Lihat Semua Riwayat ({pastOrders.length}) →
            </Link>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {pastOrders.slice(0, 3).map((o) => (
                <div key={o.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{o.trackingNumber}</p>
                    <p className="text-slate-500">{o.serviceName} • {formatDateIndo(o.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-brand-primary">{formatIDR(o.totalPrice)}</p>
                    <Badge variant={normalizeOrderStatus(o.status) === 'delivered' ? 'emerald' : 'rose'} size="sm">
                      {normalizeOrderStatus(o.status) === 'delivered' ? 'Selesai' : 'Dibatalkan'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
