'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { partnerApplicationService, PartnerApplicationRecord } from '@/services/partnerApplicationService';
import { isSupabaseConfigured } from '@/services/supabase';
import { Order } from '@/types/order';
import { UserProfile } from '@/types/user';
import { formatIDR, formatDateIndo } from '@/utils/formatters';
import { getStatusConfig } from '@/utils/helpers';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PlusCircle, ShoppingBag, Truck, MapPin, Clock, ArrowRight, Eye } from 'lucide-react';

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [partnerApp, setPartnerApp] = useState<PartnerApplicationRecord | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
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
          const liveOrders = await orderService.getOrdersByCustomerAsync(liveProfile.id);
          if (isMounted) setOrders(liveOrders);

          const livePartnerApp = await partnerApplicationService.getMyPartnerApplicationAsync();
          if (isMounted) setPartnerApp(livePartnerApp);
        } catch (err) {
          console.warn('Live dashboard load warning:', err);
          if (isMounted) setOrders([]);
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
          setOrders(currentUser ? orderService.getOrdersByCustomer(currentUser.id) : []);
        }
      }
    };

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const pastOrders = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Portal Customer Laundry</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Halo, {user?.fullName || 'Pelanggan Setia'}! 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Kelola pesanan pickup laundry Anda dengan mudah. Lacak status pencucian real-time langsung dari HP.
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={() => router.push('/customer/laundries')}
          leftIcon={<PlusCircle className="w-5 h-5" />}
          className="bg-white hover:bg-teal-50 text-teal-900 shadow-xl shrink-0 font-bold"
        >
          Buat Pesanan Pickup Baru
        </Button>
      </div>

      {/* Partner Application Status Card / CTA Banner */}
      {user?.role === 'laundry_owner' ? (
        <Card variant="white" className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
        <Card variant="white" className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
        <Card variant="white" className="bg-rose-50 border-rose-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
      ) : (
        <Card variant="white" className="bg-slate-900 text-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Punya Usaha Laundry Sendiri?</h3>
            <p className="text-xs text-slate-300">Daftarkan laundry Anda sebagai mitra FreshWash dan dapatkan jangkauan ribuan pelanggan baru.</p>
          </div>
          <Link href="/register/partner">
            <Button variant="primary" size="md" className="shrink-0 font-bold bg-teal-500 hover:bg-teal-400 text-slate-900 border-none">
              Daftar Jadi Mitra
            </Button>
          </Link>
        </Card>
      )}

      {/* Active Orders Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Pesanan Aktif Berjalan</h2>
            <p className="text-xs text-slate-500">Pesanan yang sedang diproses atau ditugaskan kurir</p>
          </div>
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
            {activeOrders.length} Pesanan Aktif
          </span>
        </div>

        {activeOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeOrders.map((o) => {
              const cfg = getStatusConfig(o.status);
              return (
                <Card key={o.id} variant="white" className="hover:border-teal-300 transition-all space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400">Nomor Resi:</span>
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

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <Link
                      href={`/orders/track/${o.trackingNumber}`}
                      className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"
                    >
                      <Truck className="w-4 h-4" /> Live Tracking Status
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
          <Card variant="white" className="p-8 text-center space-y-3">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Belum Ada Pesanan Aktif</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Anda tidak memiliki pesanan laundry yang sedang berjalan. Buat pesanan baru sekarang!
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/customer/laundries')}
              className="mt-2"
            >
              Buat Order Baru
            </Button>
          </Card>
        )}
      </div>

      {/* Past Orders History */}
      {pastOrders.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Riwayat Pesanan Selesai</h2>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {pastOrders.map((o) => (
                <div key={o.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{o.trackingNumber}</p>
                    <p className="text-slate-500">{o.serviceName} • {formatDateIndo(o.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-teal-700">{formatIDR(o.totalPrice)}</p>
                    <Badge variant="emerald" size="sm">
                      Selesai
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
