'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { courierJobPoolService, TomorrowJobPoolSummary, getWibTomorrowDateString } from '@/services/courierJobPoolService';
import { UserProfile } from '@/types/user';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDateIndo } from '@/utils/formatters';
import { User, LogOut, ShieldCheck, Truck, CheckCircle2, Clock, MapPin, Phone, Mail, Package, ArrowRight } from 'lucide-react';

export default function CourierAccountPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [tomorrowPool, setTomorrowPool] = useState<TomorrowJobPoolSummary | null>(null);

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    if (user) {
      const fetchOrders = async () => {
        try {
          const courierOrders = await orderService.getOrdersByCourierAsync(user.id);
          setCompletedCount(courierOrders.filter((o) => o.status === 'delivered' || o.status === 'in_washing').length);
          setActiveCount(courierOrders.filter((o) => o.status === 'assigned' || o.status === 'picked_up' || o.status === 'out_for_delivery').length);
        } catch {
          const courierOrders = orderService.getOrdersByCourier(user.id);
          setCompletedCount(courierOrders.filter((o) => o.status === 'delivered' || o.status === 'in_washing').length);
          setActiveCount(courierOrders.filter((o) => o.status === 'assigned' || o.status === 'picked_up' || o.status === 'out_for_delivery').length);
        }
      };
      fetchOrders();
    }

    // Read-only operational forecast query for tomorrow's job pool
    courierJobPoolService
      .getTomorrowJobPoolSummaryAsync()
      .then((summary) => setTomorrowPool(summary))
      .catch((err) => console.warn('Failed loading tomorrow job pool summary:', err));
  }, []);

  const handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari akun Kurir?')) {
      await authService.logout();
      router.push('/login');
    }
  };

  const targetJobPoolUrl = tomorrowPool?.date
    ? `/courier/job-pool?date=${tomorrowPool.date}`
    : `/courier/job-pool?date=${getWibTomorrowDateString()}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-24">
      {/* Header Profile Card */}
      <Card variant="white" className="p-6 border-slate-200 shadow-md">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-amber-600/30">
            {currentUser?.fullName?.charAt(0).toUpperCase() || 'K'}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                {currentUser?.fullName || 'Kurir Driver'}
              </h1>
              <Badge variant="emerald" className="font-bold text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> VERIFIED DRIVER
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium">Logistik Partner CUCIYAN</p>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {currentUser?.email || 'courier@freshlaundry.com'}
              </span>
              {currentUser?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {currentUser.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Driver Statistics */}
      <div className="grid grid-cols-2 gap-4">
        <Card variant="white" className="p-5 border-slate-200 text-center">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-2">
            <Truck className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-slate-900">{activeCount}</p>
          <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">Tugas Aktif</p>
        </Card>

        <Card variant="white" className="p-5 border-slate-200 text-center">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-slate-900">{completedCount}</p>
          <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">Tugas Selesai</p>
        </Card>
      </div>

      {/* Tomorrow Job Pool Forecast Summary Card (Clickable Entry Point to Tomorrow Job Pool) */}
      <Link href={targetJobPoolUrl} className="block group">
        <Card
          variant="white"
          className="p-5 border-amber-200 bg-amber-50/40 space-y-3 shadow-xs group-hover:border-amber-400 group-hover:bg-amber-50/80 group-hover:shadow-md transition-all cursor-pointer relative"
        >
          <div className="flex items-center justify-between border-b border-amber-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-black text-amber-900 uppercase tracking-tight flex items-center gap-1.5">
                  📦 JOB POOL BESOK
                </h2>
                <p className="text-[11px] text-amber-800 font-medium">
                  {tomorrowPool?.date ? formatDateIndo(tomorrowPool.date) : 'Persiapan Logistik Operasional'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="amber" className="font-black text-[10px] hidden sm:inline-flex">
                ESTIMASI OPERASIONAL
              </Badge>
              <span className="text-xs font-bold text-amber-700 group-hover:text-amber-900 flex items-center gap-1 group-hover:translate-x-0.5 transition-all bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200">
                Lihat Job Besok <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          {tomorrowPool ? (
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900">
                  ± {tomorrowPool.totalCount} JOB
                </span>
                <span className="text-xs font-bold text-slate-500 sm:hidden">
                  ESTIMASI OPERASIONAL
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold text-slate-700 bg-white/90 p-3 rounded-xl border border-amber-200/80 shadow-2xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                  Pickup: <strong className="text-slate-900">{tomorrowPool.pickupCount}</strong>
                </span>
                <span className="text-slate-300">·</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                  Delivery: <strong className="text-slate-900">{tomorrowPool.deliveryCount}</strong>
                </span>
              </div>

              <p className="text-[11px] text-amber-800 font-medium italic">
                * Jumlah sementara untuk persiapan kerja besok. Angka ini dapat berubah sesuai order masuk, pembatalan, atau perubahan jadwal.
              </p>
            </div>
          ) : (
            <div className="p-4 text-center text-xs font-medium text-slate-500">
              Memuat estimasi job pool besok...
            </div>
          )}
        </Card>
      </Link>

      {/* Driver Information Details */}
      <Card variant="white" className="p-5 border-slate-200 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
          Informasi Operasional Kurir
        </h2>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-semibold text-slate-600">Peran Akun:</span>
            <span className="font-bold text-slate-900 capitalize">{currentUser?.role || 'Courier'}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-semibold text-slate-600">Wilayah Layanan:</span>
            <span className="font-bold text-slate-900">DKI Jakarta & Sejuta Kota</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-semibold text-slate-600">Batas Maksimal Klaim Order per Slot:</span>
            <span className="font-bold text-amber-700">Maksimal 5 Order</span>
          </div>
        </div>
      </Card>

      {/* Logout Action */}
      <Card variant="white" className="p-4 border-slate-200">
        <button
          onClick={handleLogout}
          className="w-full py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 border border-rose-200 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> Keluar dari Akun Kurir
        </button>
      </Card>
    </div>
  );
}
