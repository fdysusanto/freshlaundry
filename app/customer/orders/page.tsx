'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { isSupabaseConfigured } from '@/services/supabase';
import { Order, normalizeOrderStatus } from '@/types/order';
import { UserProfile } from '@/types/user';
import { formatIDR, formatDateIndo } from '@/utils/formatters';
import { getStatusConfig } from '@/utils/helpers';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Package, Truck, Eye, PlusCircle, History, ArrowRight } from 'lucide-react';

export default function CustomerActiveOrdersPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadOrders = async () => {
      setIsLoading(true);
      try {
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

          const liveOrders = await orderService.getOrdersByCustomerAsync(liveProfile.id);
          if (isMounted) setOrders(liveOrders);
        } else {
          const currentUser = authService.getCurrentUser();
          if (currentUser) {
            if (isMounted) {
              setUser(currentUser);
              setOrders(orderService.getOrdersByCustomer(currentUser.id));
            }
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

  // Active Orders Source of Truth: status is neither delivered nor cancelled
  const activeOrders = orders.filter((o) => {
    const norm = normalizeOrderStatus(o.status);
    return norm !== 'delivered' && norm !== 'cancelled';
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Memuat pesanan aktif Anda...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6 pb-24 md:pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold mb-2">
            <Package className="w-3.5 h-3.5 text-teal-600" />
            <span>Pusat Pesanan Aktif</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Pesanan Aktif</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Lacak status penjemputan, pencucian, dan pengantaran laundry Anda secara real-time.
          </p>
        </div>

        <Link href="/customer/orders/history">
          <Button variant="outline" size="sm" leftIcon={<History className="w-4 h-4 text-teal-600" />} className="font-bold border-slate-300">
            Riwayat Selesai
          </Button>
        </Link>
      </div>

      {/* Active Orders List */}
      {activeOrders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeOrders.map((o) => {
            const cfg = getStatusConfig(o.status);
            return (
              <Card key={o.id} variant="white" className="hover:border-teal-300 transition-all space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Nomor Resi:</span>
                    <p className="text-sm font-black text-slate-900">{o.trackingNumber}</p>
                  </div>
                  <Badge variant={cfg.stepIndex >= 4 ? 'teal' : cfg.stepIndex >= 2 ? 'blue' : 'amber'}>
                    {cfg.label}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mitra Laundry:</span>
                    <span className="font-bold text-slate-800">{o.laundryName || 'FreshWash Laundry Partner'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jenis Layanan:</span>
                    <span className="font-semibold text-slate-800">{o.serviceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jadwal Pickup:</span>
                    <span className="font-semibold text-slate-800">
                      {formatDateIndo(o.pickupDate)} ({o.pickupTimeSlot})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jadwal Delivery:</span>
                    <span className="font-semibold text-indigo-700">
                      {o.deliveryDate ? `${formatDateIndo(o.deliveryDate)} ${o.deliveryTimeSlot ? `(${o.deliveryTimeSlot})` : ''}` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Kurir Ditugaskan:</span>
                    <span className="font-semibold text-teal-700">
                      {o.courierName || 'Mencari Kurir Terdekat...'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-100">
                    <span className="text-slate-500 font-bold">Total Biaya:</span>
                    <span className="font-black text-teal-700 text-sm">{formatIDR(o.totalPrice)}</span>
                  </div>

                  {o.finalWeightKg && o.estimatedWeightKg && o.finalWeightKg > o.estimatedWeightKg && (
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs flex items-center justify-between text-amber-900 font-bold">
                      <span>⚠️ Perlu Pelunasan Selisih Berat ({o.finalWeightKg} kg)</span>
                      <Link href={`/orders/${o.id}`}>
                        <span className="text-amber-700 underline text-[11px] cursor-pointer">Bayar →</span>
                      </Link>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
                  <Link
                    href={`/orders/track/${o.trackingNumber}`}
                    className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"
                  >
                    <Truck className="w-4 h-4" /> Live Tracking
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/orders/${o.id}`)}
                    rightIcon={<Eye className="w-4 h-4" />}
                  >
                    Rincian Order
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card variant="white" className="p-12 text-center space-y-4 border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">📦 Belum Ada Pesanan Aktif</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Saat ini Anda tidak memiliki pesanan laundry yang sedang berjalan. Cari outlet laundry terdekat dan buat pesanan baru!
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push('/customer/laundries')}
            leftIcon={<PlusCircle className="w-4 h-4" />}
            className="bg-teal-600 hover:bg-teal-500 text-white font-bold"
          >
            Cari Laundry &amp; Buat Pesanan
          </Button>
        </Card>
      )}
    </div>
  );
}
