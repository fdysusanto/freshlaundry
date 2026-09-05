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
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { History, ArrowLeft, Eye, ShoppingBag } from 'lucide-react';

export default function CustomerOrderHistoryPage() {
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
        console.warn('Failed loading customer order history:', err);
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

  // Terminal Orders Source of Truth: status is delivered or cancelled
  const pastOrders = orders.filter((o) => {
    const norm = normalizeOrderStatus(o.status);
    return norm === 'delivered' || norm === 'cancelled';
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-xs font-semibold text-slate-600">Memuat riwayat pesanan Anda...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6 pb-24 md:pb-12">
      {/* Back & Navigation Header */}
      <div className="flex items-center justify-between">
        <Link href="/customer/account" className="text-xs font-bold text-slate-500 hover:text-teal-700 flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Akun Saya
        </Link>
      </div>

      <div className="border-b border-slate-200 pb-4 space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold mb-1">
          <History className="w-3.5 h-3.5 text-teal-600" />
          <span>Arsip Pesanan Selesai</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Riwayat Pesanan</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Daftar pesanan laundry yang telah selesai dikerjakan atau dibatalkan.
        </p>
      </div>

      {pastOrders.length > 0 ? (
        <div className="space-y-3">
          {pastOrders.map((o) => {
            const isDelivered = normalizeOrderStatus(o.status) === 'delivered';
            return (
              <Card key={o.id} variant="white" className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-slate-200 hover:border-teal-300 transition-all text-xs">
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
                    <p className="font-black text-teal-700 text-sm sm:text-base">{formatIDR(o.totalPrice)}</p>
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
        <Card variant="white" className="p-12 text-center space-y-4 border-slate-200">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">Belum Ada Riwayat Pesanan</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Pesanan yang telah selesai atau dibatalkan akan tersimpan di halaman riwayat ini.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push('/customer/laundries')}
            className="bg-teal-600 hover:bg-teal-500 text-white font-bold"
          >
            Cari Laundry Sekarang
          </Button>
        </Card>
      )}
    </div>
  );
}
