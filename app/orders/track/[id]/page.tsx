'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { orderService } from '@/services/orderService';
import { isSupabaseConfigured } from '@/services/supabase';
import { Order } from '@/types/order';
import { getStatusConfig } from '@/utils/helpers';
import { formatIDR, formatDateIndo } from '@/utils/formatters';
import { Stepper } from '@/components/ui/Stepper';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Search, Sparkles, Truck, MapPin, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.id as string) || '';
  const [searchInput, setSearchInput] = useState(rawId);
  const [order, setOrder] = useState<Order | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (rawId) {
      const loadOrderData = async () => {
        const publicTrack = await orderService.trackOrderByNumberAsync(rawId);
        if (publicTrack && isMounted) {
          const mappedOrder: Partial<Order> = {
            id: rawId,
            trackingNumber: publicTrack.trackingNumber,
            laundryName: publicTrack.laundryName,
            status: publicTrack.status,
            createdAt: publicTrack.createdAt,
            updatedAt: publicTrack.updatedAt,
            deliveryDate: publicTrack.estimatedDeliveryDate,
          };
          setOrder(mappedOrder as Order);
          setHasSearched(true);
          return;
        }

        const liveOrder = await orderService.getOrderByIdAsync(rawId);
        if (liveOrder && isMounted) {
          setOrder(liveOrder);
          setHasSearched(true);
          return;
        }

        const fallbackFound = !isSupabaseConfigured
          ? orderService.getOrderByTracking(rawId) || orderService.getOrderById(rawId)
          : null;

        if (isMounted) {
          setOrder(fallbackFound);
          setHasSearched(true);
        }
      };

      loadOrderData();
    }

    return () => {
      isMounted = false;
    };
  }, [rawId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    router.push(`/orders/track/${searchInput.trim()}`);
  };

  const statusCfg = order ? getStatusConfig(order.status) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
          <Sparkles className="w-4 h-4 text-teal-600 animate-spin" />
          <span>Real-time Order Tracker</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Lacak Status Laundry Anda
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Masukkan nomor resi tracking (mis. LND-K89A2B) untuk melihat posisi pencucian pakaian Anda secara langsung.
        </p>

        {/* Resi Search Form */}
        <form onSubmit={handleSearchSubmit} className="pt-2 flex items-center gap-2 max-w-md mx-auto">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Nomor Resi (mis. LND-K89A2B)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white text-xs font-bold text-slate-800 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 shadow-xs"
            />
          </div>
          <Button type="submit" variant="primary" size="md">
            Cari Status
          </Button>
        </form>
      </div>

      {order ? (
        <Card variant="white" className="space-y-6 shadow-xl border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-xs font-bold text-slate-400">Resi Pemesanan:</span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {order.trackingNumber}
              </h2>
            </div>
            <Badge variant="teal" size="md">
              {statusCfg?.label}
            </Badge>
          </div>

          {/* Stepper Component */}
          <div className="py-2">
            <Stepper currentStatus={order.status} />
          </div>

          {/* Current Status Highlight Box */}
          <div className="p-4 bg-teal-50/80 rounded-2xl border border-teal-200 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-teal-900">{statusCfg?.label}</p>
              <p className="text-xs text-teal-700 leading-relaxed">{statusCfg?.description}</p>
            </div>
          </div>

          {/* Details Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
            <div className="p-3.5 bg-slate-50 rounded-xl space-y-1.5">
              <p className="font-bold text-slate-700">Detail Pelanggan:</p>
              <p className="text-slate-600">Nama: <strong>{order.customerName}</strong></p>
              <p className="text-slate-600">Layanan: <strong>{order.serviceName}</strong></p>
              <p className="text-slate-600">Total Biaya: <strong className="text-teal-700">{formatIDR(order.totalPrice)}</strong></p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl space-y-1.5">
              <p className="font-bold text-slate-700">Kurir & Penjemputan:</p>
              <p className="text-slate-600">Kurir: <strong>{order.courierName || 'Mencari kurir...'}</strong></p>
              <p className="text-slate-600">Tanggal Pickup: <strong>{formatDateIndo(order.pickupDate)}</strong></p>
              <p className="text-slate-600">Slot Jam: <strong>{order.pickupTimeSlot}</strong></p>
            </div>
          </div>

          <div className="pt-2 flex justify-between items-center border-t border-slate-100">
            <button
              onClick={() => router.push('/customer')}
              className="text-xs font-bold text-slate-500 hover:text-teal-700 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard Customer
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/orders/${order.id}`)}
            >
              Lihat Detail Lengkap
            </Button>
          </div>
        </Card>
      ) : (
        hasSearched && (
          <Card variant="white" className="p-8 text-center space-y-3">
            <Truck className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Resi Tidak Ditemukan</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Nomor resi `{rawId}` tidak terdaftar dalam database kami. Pastikan tidak ada salah ketik.
            </p>
          </Card>
        )
      )}
    </div>
  );
}
