'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { isSupabaseConfigured } from '@/services/supabase';
import { paymentService } from '@/services/paymentService';
import { calculateOrderShortfall } from '@/utils/paymentShortfall';
import { Order, normalizeOrderStatus } from '@/types/order';
import { UserProfile } from '@/types/user';
import { formatIDR, formatDateIndo, formatDateIndoWithRelative } from '@/utils/formatters';
import { getStatusConfig } from '@/utils/helpers';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Package, Truck, Eye, PlusCircle, ShoppingBag, AlertTriangle } from 'lucide-react';

function CustomerOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adjStatuses, setAdjStatuses] = useState<Record<string, { exists: boolean; status: 'paid' | 'pending' | 'none'; amount: number }>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Tab State: Default activeTab is 'active', or 'history' if ?tab=history
  const [activeTab, setActiveTab] = useState<'active' | 'history'>(() => {
    return tabParam === 'history' ? 'history' : 'active';
  });

  // Sync tab state if query parameter changes
  useEffect(() => {
    if (tabParam === 'history') {
      setActiveTab('history');
    } else if (tabParam === 'active') {
      setActiveTab('active');
    }
  }, [tabParam]);

  useEffect(() => {
    let isMounted = true;

    const loadOrders = async () => {
      setIsLoading(true);
      try {
        let loadedOrders: Order[] = [];
        if (isSupabaseConfigured) {
          const liveProfile = await authService.fetchCurrentProfile();
          if (!liveProfile) {
            if (isMounted) router.push('/login');
            return;
          }
          if (liveProfile.role !== 'customer') {
            if (isMounted) router.push('/');
            return;
          }
          if (isMounted) setUser(liveProfile);

          loadedOrders = await orderService.getOrdersByCustomerAsync(liveProfile.id);
        } else {
          const currentUser = authService.getCurrentUser();
          if (currentUser) {
            if (isMounted) {
              setUser(currentUser);
              loadedOrders = orderService.getOrdersByCustomer(currentUser.id);
            }
          }
        }

        if (isMounted) {
          setOrders(loadedOrders);

          // Perform SINGLE BATCH QUERY for all loaded orders (O(1) database query)
          const orderIds = loadedOrders.map((o) => o.id);
          if (orderIds.length > 0) {
            const batchMap = await paymentService.getAdjustmentPaymentStatusesBatchAsync(orderIds);
            if (isMounted) setAdjStatuses(batchMap);
          }
        }
      } catch (err) {
        console.warn('Failed loading customer orders:', err);
        if (isMounted) setOrders([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadOrders();
    return () => {
      isMounted = false;
    };
  }, [router]);

  // Sort orders newest -> oldest
  const sortedOrders = useMemo(() => {
    return [...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [orders]);

  // Active Orders (Non-terminal: neither delivered nor cancelled)
  const activeOrders = useMemo(() => {
    return sortedOrders.filter((o) => {
      const norm = normalizeOrderStatus(o.status);
      return norm !== 'delivered' && norm !== 'cancelled';
    });
  }, [sortedOrders]);

  // Historical Orders (Terminal: delivered or cancelled)
  const historicalOrders = useMemo(() => {
    return sortedOrders.filter((o) => {
      const norm = normalizeOrderStatus(o.status);
      return norm === 'delivered' || norm === 'cancelled';
    });
  }, [sortedOrders]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Memuat pesanan Anda...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 pb-24 md:pb-12">
      {/* 1. Header Title */}
      <div className="space-y-0.5">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Pesanan
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Kelola pesanan laundry aktif dan lihat riwayat transaksi Anda
        </p>
      </div>

      {/* 2. Segmented Tabs Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`py-2.5 px-4 text-xs sm:text-sm font-extrabold border-b-2 transition-colors cursor-pointer select-none flex items-center gap-2 ${
            activeTab === 'active'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-slate-500 hover:text-slate-700 font-semibold'
          }`}
        >
          <span>Pesanan Aktif</span>
          {activeOrders.length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'active'
                  ? 'bg-brand-surface text-brand-primary'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {activeOrders.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`py-2.5 px-4 text-xs sm:text-sm font-extrabold border-b-2 transition-colors cursor-pointer select-none flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-slate-500 hover:text-slate-700 font-semibold'
          }`}
        >
          <span>Riwayat Pesanan</span>
          {historicalOrders.length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'history'
                  ? 'bg-brand-surface text-brand-primary'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {historicalOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* 3. Tab Content: Active Orders Tab */}
      {activeTab === 'active' && (
        <>
          {activeOrders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {activeOrders.map((o) => {
                const cfg = getStatusConfig(o.status);
                const adjInfo = adjStatuses[o.id] || { exists: false, status: 'none', amount: 0 };
                const { isShortfall, amount: shortfallAmount } = calculateOrderShortfall(o, adjInfo.status, adjInfo.amount);
                return (
                  <Card key={o.id} variant="white" className="hover:border-brand-secondary transition-all space-y-3.5 shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Resi:</span>
                        <p className="text-xs sm:text-sm font-black text-slate-900">{o.trackingNumber}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isShortfall && (
                          <Badge variant="amber" className="font-black animate-pulse text-[10px]">
                            KURANG BAYAR
                          </Badge>
                        )}
                        <Badge variant={cfg.stepIndex >= 4 ? 'teal' : cfg.stepIndex >= 2 ? 'blue' : 'amber'}>
                          {cfg.label}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Mitra Laundry:</span>
                        <span className="font-bold text-slate-800">{o.laundryName || 'CUCIYAN Laundry Partner'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Jenis Layanan:</span>
                        <span className="font-semibold text-slate-800">{o.serviceName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Jadwal Pickup:</span>
                        <span className="font-semibold text-slate-800">
                          {formatDateIndoWithRelative(o.pickupDate)} ({o.pickupTimeSlot})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Jadwal Delivery:</span>
                        <span className="font-semibold text-indigo-700">
                          {o.deliveryDate ? `${formatDateIndoWithRelative(o.deliveryDate)} ${o.deliveryTimeSlot ? `(${o.deliveryTimeSlot})` : ''}` : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Kurir Ditugaskan:</span>
                        <span className="font-semibold text-brand-primary">
                          {o.courierName || 'Mencari Kurir Terdekat...'}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-100">
                        <span className="text-slate-500 font-bold">Total Biaya:</span>
                        <span className="font-black text-brand-primary text-sm">{formatIDR(o.totalPrice)}</span>
                      </div>

                      {isShortfall && (
                        <div className="p-3 bg-amber-50 rounded-2xl border-2 border-amber-300 text-xs text-amber-950 font-bold shadow-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-black text-amber-900 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              ⚠️ KURANG BAYAR
                            </p>
                            <span className="font-black text-amber-900 text-xs">+{formatIDR(shortfallAmount)}</span>
                          </div>
                          <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                            Berat ditimbang ({o.finalWeightKg} kg) &gt; estimasi ({o.estimatedWeightKg || 5} kg). Terdapat selisih pembayaran.
                          </p>
                          <div className="pt-1 flex items-center justify-end">
                            <Link href={`/orders/${o.id}`}>
                              <Button size="sm" variant="primary" className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 flex items-center gap-1">
                                Bayar Selisih {shortfallAmount > 0 ? formatIDR(shortfallAmount) : ''} →
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
                      <Link
                        href={`/orders/track/${o.trackingNumber}`}
                        className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1"
                      >
                        <Truck className="w-4 h-4" /> Live Tracking
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/orders/${o.id}`)}
                        rightIcon={<Eye className="w-4 h-4" />}
                        className="font-bold border-slate-300"
                      >
                        Rincian Order
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card variant="white" className="p-10 sm:p-14 text-center space-y-4 border-slate-200">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">Belum ada pesanan aktif</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Pesanan yang sedang berjalan akan muncul di sini.
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => router.push('/customer/laundries')}
                leftIcon={<PlusCircle className="w-4 h-4" />}
                className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold text-xs sm:text-sm"
              >
                Cari Laundry
              </Button>
            </Card>
          )}
        </>
      )}

      {/* 4. Tab Content: History Orders Tab */}
      {activeTab === 'history' && (
        <>
          {historicalOrders.length > 0 ? (
            <div className="space-y-3">
              {historicalOrders.map((o) => {
                const isDelivered = normalizeOrderStatus(o.status) === 'delivered';
                return (
                  <Card key={o.id} variant="white" className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-slate-200 hover:border-brand-secondary transition-all text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{o.trackingNumber}</span>
                        <Badge variant={isDelivered ? 'emerald' : 'rose'} size="sm" className="font-bold">
                          {isDelivered ? 'Selesai' : 'Dibatalkan'}
                        </Badge>
                      </div>
                      <p className="text-slate-600 font-medium">
                        {o.laundryName || 'Mitra Laundry'} • {o.serviceName}
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        Tanggal Transaksi: {formatDateIndo(o.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="sm:text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Total Pembayaran</span>
                        <p className="font-black text-brand-primary text-sm sm:text-base">{formatIDR(o.totalPrice)}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/orders/${o.id}`)}
                        rightIcon={<Eye className="w-4 h-4" />}
                        className="font-bold border-slate-300"
                      >
                        Detail
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card variant="white" className="p-10 sm:p-14 text-center space-y-4 border-slate-200">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">Belum ada riwayat pesanan</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Pesanan yang sudah selesai atau dibatalkan akan muncul di sini.
                </p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function CustomerOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Memuat pesanan Anda...</p>
        </div>
      }
    >
      <CustomerOrdersContent />
    </Suspense>
  );
}
