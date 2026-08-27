'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { orderService } from '@/services/orderService';
import { paymentService } from '@/services/paymentService';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { Order } from '@/types/order';
import { PaymentAttempt } from '@/types/payment';
import { getStatusConfig } from '@/utils/helpers';
import { formatIDR, formatDateIndo } from '@/utils/formatters';
import { Stepper } from '@/components/ui/Stepper';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Search, Sparkles, Truck, MapPin, CheckCircle2, AlertTriangle, AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react';
import { triggerPaymentFlow } from '@/utils/midtransSnap';

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.id as string) || '';
  const [searchInput, setSearchInput] = useState(rawId);
  const [order, setOrder] = useState<Order | null>(null);
  const [pendingAdjustment, setPendingAdjustment] = useState<PaymentAttempt | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPayingAdjustment, setIsPayingAdjustment] = useState(false);
  const [payAdjustmentError, setPayAdjustmentError] = useState('');

  const handlePayAdjustmentPayment = async () => {
    if (!order || isPayingAdjustment) return;
    setIsPayingAdjustment(true);
    setPayAdjustmentError('');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      }

      const res = await fetch(`/api/orders/${order.id}/payment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'create_adjustment',
          paymentMethod: 'qris',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memproses pembuatan transaksi pembayaran selisih.');
      }

      const paymentToken = data.payment?.paymentToken || data.payment?.rawResponse?.token;
      const paymentUrl = data.payment?.paymentUrl || data.payment?.rawResponse?.redirect_url;
      const invoiceUrl =
        data.payment?.invoiceUrl ||
        data.payment?.rawResponse?.invoice_url ||
        data.payment?.rawResponse?.invoiceUrl ||
        data.payment?.qrCodeUrl;

      const triggered = triggerPaymentFlow({
        paymentToken,
        paymentUrl,
        invoiceUrl,
        onSuccess: async () => {
          setPayAdjustmentError('');
          const updatedOrder = (await orderService.getOrderByIdAsync(order.id)) || orderService.getOrderByTracking(order.trackingNumber);
          if (updatedOrder) setOrder(updatedOrder);
          const adj = await paymentService.getPendingAdjustmentPaymentAttemptAsync(order.id);
          setPendingAdjustment(adj);
        },
        onPending: () => {
          setPayAdjustmentError('Pembayaran selisih masih menunggu penyelesaian.');
        },
        onError: (errMsg) => {
          setPayAdjustmentError(errMsg || 'Gagal memproses pembayaran selisih via gateway.');
        },
        onClose: () => {
          setIsPayingAdjustment(false);
        },
      });

      if (!triggered) {
        throw new Error('Token atau URL pembayaran selisih tidak ditemukan dari response payment gateway.');
      }
    } catch (err: any) {
      setPayAdjustmentError(err.message || 'Gagal memproses pembayaran selisih.');
    } finally {
      setIsPayingAdjustment(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (rawId) {
      const loadOrderData = async () => {
        const liveOrder = await orderService.getOrderByIdAsync(rawId) || orderService.getOrderByTracking(rawId);
        if (liveOrder && isMounted) {
          setOrder(liveOrder);
          setHasSearched(true);
          const adjStatus = await paymentService.getAdjustmentPaymentStatusAsync(liveOrder.id);
          if (adjStatus.status === 'paid') {
            if (isMounted) setPendingAdjustment(null);
          } else if (adjStatus.status === 'pending' && adjStatus.attempt) {
            if (isMounted) setPendingAdjustment(adjStatus.attempt);
          } else if (liveOrder.paymentStatus === 'paid' && liveOrder.finalWeightKg && liveOrder.estimatedWeightKg && liveOrder.finalWeightKg > liveOrder.estimatedWeightKg) {
            try {
              const sessionRes = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
              const token = sessionRes?.data?.session?.access_token;
              const res = await fetch(`/api/orders/${liveOrder.id}/payment`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ action: 'create_adjustment' }),
              });
              const data = await res.json();
              if (res.ok && data.success && data.payment) {
                if (data.payment.status === 'paid') {
                  if (isMounted) setPendingAdjustment(null);
                } else {
                  if (isMounted) setPendingAdjustment(data.payment);
                }
              }
            } catch (adjFetchErr) {
              console.warn('[TRACK-PAGE] Error fetching/creating adjustment attempt:', adjFetchErr);
            }
          } else {
            if (isMounted) setPendingAdjustment(null);
          }
          return;
        }

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
          {pendingAdjustment ? (
            <div className="p-4 bg-amber-50 rounded-2xl border-2 border-amber-300 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-2 flex-1">
                <p className="text-sm font-bold text-amber-900">⚠️ Menunggu Pembayaran Selisih ({formatIDR(pendingAdjustment.amount)})</p>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Pesanan telah ditimbang ({order.finalWeightKg} kg) dan terdapat penyesuaian harga. Silakan lunasi pembayaran selisih agar laundry dapat melanjutkan proses pencucian.
                </p>
                {payAdjustmentError && (
                  <div className="p-2.5 bg-red-100 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{payAdjustmentError}</span>
                  </div>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isPayingAdjustment}
                  onClick={handlePayAdjustmentPayment}
                  className="bg-amber-600 hover:bg-amber-500 font-bold cursor-pointer flex items-center gap-1.5"
                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  {isPayingAdjustment ? 'Memproses Pembayaran...' : `Bayar Selisih ${formatIDR(pendingAdjustment.amount)}`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-teal-50/80 rounded-2xl border border-teal-200 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-teal-900">{statusCfg?.label}</p>
                <p className="text-xs text-teal-700 leading-relaxed">{statusCfg?.description}</p>
              </div>
            </div>
          )}

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
              <p className="text-slate-600">Kurir Pickup: <strong>{order.pickupCourier ? order.pickupCourier.name : 'Mencari kurir...'}</strong></p>
              <p className="text-slate-600">Kurir Delivery: <strong className={order.deliveryCourier ? 'text-indigo-700 font-bold' : 'text-slate-500 italic'}>{order.deliveryCourier ? order.deliveryCourier.name : 'Belum Ditugaskan'}</strong></p>
              <p className="text-slate-600">Jadwal Pickup: <strong>{formatDateIndo(order.pickupDate)} ({order.pickupTimeSlot})</strong></p>
              <p className="text-slate-600">Jadwal Delivery: <strong>{order.deliveryDate ? `${formatDateIndo(order.deliveryDate)} ${order.deliveryTimeSlot ? `(${order.deliveryTimeSlot})` : ''}` : '-'}</strong></p>
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
