'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { orderService } from '@/services/orderService';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { Order } from '@/types/order';
import { formatIDR, formatDateIndo, formatDateTimeIndo } from '@/utils/formatters';
import { getStatusConfig } from '@/utils/helpers';
import { Stepper } from '@/components/ui/Stepper';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { paymentService } from '@/services/paymentService';
import { PaymentAttempt } from '@/types/payment';
import { Truck, MapPin, Calendar, Clock, ArrowLeft, Phone, User, FileText, Store, CreditCard, ShieldCheck, AlertCircle, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { triggerPaymentFlow } from '@/utils/midtransSnap';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = (params?.id as string) || '';
  const [order, setOrder] = useState<Order | null>(null);
  const [pendingAdjustment, setPendingAdjustment] = useState<PaymentAttempt | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const handlePayNow = async (actionType: 'create' | 'create_adjustment' = 'create') => {
    if (!order) return;
    setIsPaying(true);
    setPayError('');

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
          action: actionType,
          paymentMethod: 'qris',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memproses pembuatan transaksi pembayaran.');
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
        onSuccess: () => {
          setPayError('');
          orderService.getOrderByIdAsync(order.id).then(async (updated) => {
            if (updated) setOrder(updated);
            const adj = await paymentService.getPendingAdjustmentPaymentAttemptAsync(order.id);
            setPendingAdjustment(adj);
          });
        },
        onPending: () => {
          setPayError('Pembayaran masih menunggu penyelesaian.');
        },
        onError: (errMsg) => {
          setPayError(errMsg || 'Gagal memproses pembayaran via gateway.');
        },
        onClose: () => {
          setIsPaying(false);
        },
      });

      if (!triggered) {
        throw new Error('Token atau URL pembayaran tidak ditemukan dari response payment gateway.');
      }
    } catch (err: any) {
      setPayError(err.message || 'Gagal memproses pembayaran.');
    } finally {
      setIsPaying(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (orderId) {
      const loadDetail = async () => {
        if (typeof window !== 'undefined') {
          console.log('[ORDER-PAGE] Initializing order detail view for orderId:', orderId);
        }
        try {
          const liveOrder = await orderService.getOrderByIdAsync(orderId);
          if (liveOrder && isMounted) {
            setOrder(liveOrder);
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
                console.warn('[ORDER-PAGE] Error fetching/creating adjustment attempt:', adjFetchErr);
              }
            } else {
              if (isMounted) setPendingAdjustment(null);
            }
            return;
          }
        } catch (err: any) {
          if (typeof window !== 'undefined') {
            console.warn('[ORDER-PAGE] Error calling getOrderByIdAsync:', err?.message || err);
          }
        }
        if (isMounted && !isSupabaseConfigured) {
          const localOrder = orderService.getOrderById(orderId);
          setOrder(localOrder);
          if (localOrder) {
            paymentService.getAdjustmentPaymentStatusAsync(localOrder.id).then((adjStatus) => {
              if (isMounted) {
                setPendingAdjustment(adjStatus.status === 'pending' ? adjStatus.attempt : null);
              }
            });
          }
        } else if (isMounted) {
          setOrder(null);
        }
      };

      loadDetail();
    }

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-lg font-bold text-slate-700">Pesanan Tidak Ditemukan</p>
        <p className="text-xs text-slate-500">ID pesanan `{orderId}` tidak tersedia di database.</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/customer/laundries')}>
          Kembali ke Marketplace Laundry
        </Button>
      </div>
    );
  }

  const statusCfg = getStatusConfig(order.status);
  const cfg = statusCfg;
  const items = order.items || [];
  const subtotal = order.subtotal ?? 0;
  const platformFee = order.platformFee ?? 2000;
  const deliveryFee = order.deliveryFee ?? 0;
  const discount = order.discount ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Top Header & Back Action */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <Link href={`/orders/track/${order.trackingNumber}`}>
          <Button variant="primary" size="sm" leftIcon={<Truck className="w-4 h-4" />}>
            Lacak Live Tracking
          </Button>
        </Link>
      </div>

      {/* Main Order Card Header */}
      <Card variant="white" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-bold text-slate-400">Nomor Resi Transaksi:</span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              #{order.trackingNumber}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={pendingAdjustment ? 'amber' : order.paymentStatus === 'paid' ? 'emerald' : 'amber'}>
              {pendingAdjustment ? 'Perlu Selisih' : order.paymentStatus === 'paid' ? 'Lunas' : 'Belum Dibayar'}
            </Badge>
            <Badge variant={cfg.stepIndex >= 6 ? 'emerald' : cfg.stepIndex >= 3 ? 'blue' : 'amber'}>
              {cfg.label}
            </Badge>
          </div>
        </div>

        {/* Selected Laundry Store Info */}
        <div className="p-4 bg-teal-50/60 rounded-2xl border border-teal-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white font-black text-base flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-teal-800 tracking-widest block">
                Mitra Laundry Pengolah:
              </span>
              <p className="text-sm font-bold text-slate-900">{order.laundryName || 'FreshWash Laundry Partner'}</p>
            </div>
          </div>
          <Link href={`/customer/laundries/${order.laundryId || 'lnd_001'}`}>
            <span className="text-xs font-bold text-teal-700 hover:underline">
              Lihat Profil Mitra →
            </span>
          </Link>
        </div>

        {/* Payment CTA Banner */}
        {pendingAdjustment ? (
          <div className="p-5 bg-amber-50 rounded-2xl border-2 border-amber-300 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-black text-amber-900 uppercase tracking-tight">
                    ⚠️ Pembayaran Tambahan Diperlukan
                  </h3>
                  <p className="text-xs text-amber-800 font-medium">
                    Berat cucian setelah ditimbang ({order.finalWeightKg} kg) lebih besar dari estimasi awal ({order.estimatedWeightKg || 5} kg). Pesanan belum dapat diproses ke tahap pencucian sampai pembayaran selisih dilunasi.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-white/90 rounded-xl border border-amber-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Berat Estimasi:</span>
                <span className="font-bold text-slate-800">{order.estimatedWeightKg || 5} kg</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Berat Aktual:</span>
                <span className="font-extrabold text-amber-900">{order.finalWeightKg} kg</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Harga Total Aktual:</span>
                <span className="font-extrabold text-slate-900">{formatIDR(order.totalPrice)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Kekurangan Selisih:</span>
                <span className="font-black text-amber-700 text-sm">+{formatIDR(pendingAdjustment.amount)}</span>
              </div>
            </div>

            {payError && (
              <div className="p-3 bg-red-100 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{payError}</span>
              </div>
            )}

            <Button
              variant="primary"
              size="md"
              disabled={isPaying}
              onClick={() => handlePayNow('create_adjustment')}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
              rightIcon={<ExternalLink className="w-4 h-4" />}
            >
              {isPaying ? 'Menghubungkan ke Gateway Pembayaran...' : `Bayar Selisih ${formatIDR(pendingAdjustment.amount)}`}
            </Button>
          </div>
        ) : order.paymentStatus === 'paid' ? (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-900">Pembayaran Berhasil (Lunas)</p>
              <p className="text-[11px] text-emerald-700">Terima kasih, pembayaran pesanan Anda telah terverifikasi resmi.</p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-900">Pembayaran Belum Selesai</p>
                  <p className="text-[11px] text-amber-700">
                    Silakan lakukan pembayaran sebesar <strong>{formatIDR(order.totalPrice)}</strong> melalui Midtrans Secure Payment untuk melanjutkan proses pesanan.
                  </p>
                </div>
              </div>
            </div>

            {payError && (
              <div className="p-3 bg-red-100 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{payError}</span>
              </div>
            )}

            <Button
              variant="primary"
              size="md"
              disabled={isPaying}
              onClick={() => handlePayNow('create')}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer"
              rightIcon={<ExternalLink className="w-4 h-4" />}
            >
              {isPaying ? 'Menghubungkan ke Gateway Pembayaran...' : 'Bayar Sekarang'}
            </Button>
          </div>
        )}

        {/* Visual Stepper Timeline */}
        <div className="pt-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Status Perjalanan Pakaian:
          </p>
          <Stepper currentStatus={order.status} />
        </div>

        {/* Grid Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          {/* Customer & Courier Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Informasi Pemesan & Penjemputan
            </h3>
            <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-teal-600 shrink-0" />
                <span>
                  Pemesan: <strong>{order.customerName}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-teal-600 shrink-0" />
                <span>
                  WhatsApp: <strong>{order.customerPhone}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                <Truck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Kurir Pickup:{' '}
                  <strong className="text-amber-700">
                    {order.pickupCourier ? order.pickupCourier.name : 'Mencari Kurir Pickup...'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60">
                <Truck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Kurir Delivery:{' '}
                  <strong className={order.deliveryCourier ? 'text-indigo-700 font-bold' : 'text-slate-500 italic'}>
                    {order.deliveryCourier ? order.deliveryCourier.name : 'Belum Ditugaskan'}
                  </strong>
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-700">Alamat Penjemputan:</p>
                  <p className="text-slate-600">{order.pickupAddress}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Service & Fee Breakdown Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Layanan & Rincian Pembayaran
            </h3>
            <div className="p-4 bg-slate-50 rounded-xl space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Jenis Layanan:</span>
                <span className="font-bold text-slate-800">{order.serviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estimasi Kiloan:</span>
                <span className="font-semibold text-slate-800">{order.estimatedWeightKg || 5} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Berat Aktual Timbangan:</span>
                <span className={order.finalWeightKg ? 'font-bold text-teal-700' : 'font-medium text-amber-600 italic'}>
                  {order.finalWeightKg ? `${order.finalWeightKg} kg (Sudah Diverifikasi)` : 'Belum Ditimbang'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jadwal Pickup:</span>
                <span className="font-semibold text-slate-800">
                  {formatDateIndo(order.pickupDate)} ({order.pickupTimeSlot})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jadwal Delivery:</span>
                <span className="font-semibold text-indigo-700">
                  {order.deliveryDate ? `${formatDateIndo(order.deliveryDate)} ${order.deliveryTimeSlot ? `(${order.deliveryTimeSlot})` : ''}` : '-'}
                </span>
              </div>
              {order.notes && (
                <div className="flex items-start gap-1.5 pt-2 border-t border-slate-200 text-slate-600">
                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>Catatan: {order.notes}</span>
                </div>
              )}

              {/* Rincian Fee Transparan */}
              <div className="pt-3 border-t border-slate-200 space-y-1.5">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal Layanan:</span>
                  <span className="font-semibold text-slate-800">{formatIDR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Ongkos Kirim Pickup &amp; Delivery:</span>
                  <span className="font-bold text-emerald-600">GRATIS</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Biaya Layanan Platform:</span>
                  <span className="font-semibold text-slate-800">{formatIDR(platformFee)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold">
                  <span className="text-slate-900">Total Tagihan (Aktual):</span>
                  <span className="font-black text-teal-700">{formatIDR(order.totalPrice)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Log History */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Riwayat Jejak Waktu (Status Log)
          </h3>
          <div className="space-y-2">
            {order.logs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-800">{log.notes || getStatusConfig(log.status).label}</p>
                  <p className="text-[11px] text-slate-400">Petugas Update: {log.updatedBy}</p>
                </div>
                <span className="text-slate-500 text-[11px] font-medium">
                  {formatDateTimeIndo(log.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
