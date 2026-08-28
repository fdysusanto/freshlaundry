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
import { Modal } from '@/components/ui/Modal';
import { TIME_SLOTS } from '@/utils/constants';
import { paymentService } from '@/services/paymentService';
import { PaymentAttempt } from '@/types/payment';
import { Truck, MapPin, Calendar, Clock, ArrowLeft, Phone, User, FileText, Store, CreditCard, ShieldCheck, AlertCircle, AlertTriangle, CheckCircle2, ExternalLink, Edit3 } from 'lucide-react';
import { triggerPaymentFlow } from '@/utils/midtransSnap';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = (params?.id as string) || '';
  const [order, setOrder] = useState<Order | null>(null);
  const [pendingAdjustment, setPendingAdjustment] = useState<PaymentAttempt | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState('');

  // Reschedule State & Handlers
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<'pickup' | 'delivery' | 'both'>('pickup');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTimeSlot, setPickupTimeSlot] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState('');
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduleSuccessMsg, setRescheduleSuccessMsg] = useState('');

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

  const openRescheduleModal = (target: 'pickup' | 'delivery' | 'both') => {
    if (!order) return;
    setRescheduleTarget(target);
    setPickupDate(order.pickupDate || '');
    setPickupTimeSlot(order.pickupTimeSlot || TIME_SLOTS[0]);
    setDeliveryDate(order.deliveryDate || '');
    setDeliveryTimeSlot(order.deliveryTimeSlot || TIME_SLOTS[0]);
    setRescheduleError('');
    setRescheduleSuccessMsg('');
    setIsRescheduleModalOpen(true);
  };

  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || isSubmittingReschedule) return;

    setRescheduleError('');
    setRescheduleSuccessMsg('');

    const targetIsPickup = rescheduleTarget === 'pickup' || rescheduleTarget === 'both';
    const targetIsDelivery = rescheduleTarget === 'delivery' || rescheduleTarget === 'both';

    if (targetIsPickup) {
      if (!pickupDate) {
        setRescheduleError('Silakan pilih tanggal pickup.');
        return;
      }
      if (!pickupTimeSlot) {
        setRescheduleError('Silakan pilih slot waktu pickup.');
        return;
      }
    }

    if (targetIsDelivery) {
      if (!deliveryDate) {
        setRescheduleError('Silakan pilih tanggal delivery.');
        return;
      }
      if (!deliveryTimeSlot) {
        setRescheduleError('Silakan pilih slot waktu delivery.');
        return;
      }
    }

    const effPickupDate = targetIsPickup ? pickupDate : order.pickupDate;
    const effPickupSlot = targetIsPickup ? pickupTimeSlot : order.pickupTimeSlot;
    const effDeliveryDate = targetIsDelivery ? deliveryDate : order.deliveryDate;
    const effDeliverySlot = targetIsDelivery ? deliveryTimeSlot : order.deliveryTimeSlot;

    if (effPickupDate && effDeliveryDate) {
      if (effDeliveryDate < effPickupDate) {
        setRescheduleError('Jadwal pengantaran (delivery) harus sama atau setelah jadwal penjemputan (pickup).');
        return;
      }
      if (effDeliveryDate === effPickupDate && effPickupSlot && effDeliverySlot) {
        const pMatch = effPickupSlot.match(/(\d{1,2}):(\d{2})/);
        const dMatch = effDeliverySlot.match(/(\d{1,2}):(\d{2})/);
        if (pMatch && dMatch) {
          const pHour = parseInt(pMatch[1], 10);
          const dHour = parseInt(dMatch[1], 10);
          if (dHour <= pHour) {
            setRescheduleError('Jadwal pengantaran pada hari yang sama harus setelah slot penjemputan.');
            return;
          }
        }
      }
    }

    setIsSubmittingReschedule(true);

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

      const payload: any = {};
      if (targetIsPickup) {
        payload.pickupDate = pickupDate;
        payload.pickupTimeSlot = pickupTimeSlot;
      }
      if (targetIsDelivery) {
        payload.deliveryDate = deliveryDate;
        payload.deliveryTimeSlot = deliveryTimeSlot;
      }

      const res = await fetch(`/api/orders/${order.id}/reschedule`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 409) {
          throw new Error(data.message || 'Jadwal tidak dapat diubah karena proses dispatch sedang berjalan.');
        } else if (res.status === 403) {
          throw new Error(data.message || 'Anda tidak memiliki akses untuk mengubah pesanan ini.');
        } else if (res.status === 401) {
          throw new Error(data.message || 'Sesi Anda telah berakhir. Silakan login kembali.');
        }
        throw new Error(data.message || 'Gagal mengubah jadwal pesanan.');
      }

      setRescheduleSuccessMsg('Jadwal pesanan berhasil diperbarui.');

      setTimeout(async () => {
        setIsRescheduleModalOpen(false);
        setRescheduleSuccessMsg('');
        const updated = await orderService.getOrderByIdAsync(order.id);
        if (updated) setOrder(updated);
      }, 1200);
    } catch (err: any) {
      setRescheduleError(err.message || 'Terjadi kesalahan saat memperbarui jadwal.');
    } finally {
      setIsSubmittingReschedule(false);
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

  const isPickupEditable =
    order.status === 'pending' &&
    order.paymentStatus === 'paid' &&
    !order.courierId;

  const isDeliveryEditable =
    !['out_for_delivery', 'delivered', 'cancelled'].includes(order.status);

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
            <Badge variant={pendingAdjustment ? 'amber' : order.paymentStatus === 'paid' ? 'emerald' : order.paymentStatus === 'refunded' ? 'gray' : 'amber'}>
              {pendingAdjustment ? 'Perlu Selisih' : order.paymentStatus === 'paid' ? 'Lunas' : order.paymentStatus === 'refund_pending' ? 'Menunggu Pengembalian Dana' : order.paymentStatus === 'refunded' ? 'Dana Dikembalikan' : 'Belum Dibayar'}
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
        ) : order.paymentStatus === 'refund_pending' ? ( <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-center gap-3"><div className="w-5 h-5 text-amber-600 shrink-0" /><div><p className="text-xs font-bold text-amber-900">Pesanan Dibatalkan - Pengembalian Dana Diproses</p><p className="text-[11px] text-amber-700">Pengembalian dana sedang diproses secara manual oleh FreshLaundry.</p></div></div> ) : order.paymentStatus === 'refunded' ? ( <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3"><div className="w-5 h-5 text-slate-600 shrink-0" /><div><p className="text-xs font-bold text-slate-900">Dana Dikembalikan</p><p className="text-[11px] text-slate-700">Pengembalian dana telah berhasil diproses.</p></div></div> ) : order.paymentStatus === 'paid' ? (
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
              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200/60">
                  <div>
                    <span className="text-slate-500 block text-[11px] font-medium">Jadwal Penjemputan (Pickup):</span>
                    <span className="font-bold text-slate-800">
                      {formatDateIndo(order.pickupDate)} ({order.pickupTimeSlot})
                    </span>
                  </div>
                  {isPickupEditable ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRescheduleModal('pickup')}
                      className="text-teal-700 border-teal-200 hover:bg-teal-50 shrink-0 font-bold cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 mr-1" /> Ubah Jadwal
                    </Button>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic bg-slate-100 px-2 py-1 rounded-md">Jadwal Terkunci</span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200/60">
                  <div>
                    <span className="text-slate-500 block text-[11px] font-medium">Jadwal Pengantaran (Delivery):</span>
                    <span className="font-bold text-indigo-700">
                      {order.deliveryDate ? `${formatDateIndo(order.deliveryDate)} ${order.deliveryTimeSlot ? `(${order.deliveryTimeSlot})` : ''}` : '-'}
                    </span>
                  </div>
                  {isDeliveryEditable ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openRescheduleModal('delivery')}
                      className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 shrink-0 font-bold cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 mr-1" /> Ubah Jadwal
                    </Button>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic bg-slate-100 px-2 py-1 rounded-md">Jadwal Terkunci</span>
                  )}
                </div>
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

      {/* Modal Reschedule Customer Order Schedule */}
      <Modal
        isOpen={isRescheduleModalOpen}
        onClose={() => !isSubmittingReschedule && setIsRescheduleModalOpen(false)}
        title={
          rescheduleTarget === 'pickup'
            ? 'Ubah Jadwal Penjemputan (Pickup)'
            : rescheduleTarget === 'delivery'
            ? 'Ubah Jadwal Pengantaran (Delivery)'
            : 'Ubah Jadwal Pesanan'
        }
      >
        <form onSubmit={handleSaveReschedule} className="space-y-4">
          {(rescheduleTarget === 'pickup' || rescheduleTarget === 'both') && (
            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600" /> Jadwal Penjemputan Baru
              </h4>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Pickup</label>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white font-medium"
                  disabled={isSubmittingReschedule}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Slot Waktu Pickup</label>
                <select
                  value={pickupTimeSlot}
                  onChange={(e) => setPickupTimeSlot(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white font-medium"
                  disabled={isSubmittingReschedule}
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {(rescheduleTarget === 'delivery' || rescheduleTarget === 'both') && (
            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" /> Jadwal Pengantaran Baru
              </h4>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Delivery</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-medium"
                  disabled={isSubmittingReschedule}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Slot Waktu Delivery</label>
                <select
                  value={deliveryTimeSlot}
                  onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-medium"
                  disabled={isSubmittingReschedule}
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {rescheduleError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{rescheduleError}</span>
            </div>
          )}

          {rescheduleSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{rescheduleSuccessMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmittingReschedule}
              onClick={() => setIsRescheduleModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmittingReschedule}
              className="bg-teal-700 hover:bg-teal-600 text-white font-bold cursor-pointer"
            >
              {isSubmittingReschedule ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}



