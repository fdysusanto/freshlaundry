'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { authService } from '@/services/authService';
import { supabase } from '@/services/supabase';
import { orderService } from '@/services/orderService';
import { courierJobPoolService, CourierJobPoolResponse, getWibTodayDateString } from '@/services/courierJobPoolService';
import { Order } from '@/types/order';
import { UserProfile } from '@/types/user';
import { CourierDateSelector } from '@/components/courier/CourierDateSelector';
import { CourierOrderCard } from '@/components/courier/CourierOrderCard';
import { StatusUpdateModal } from '@/components/courier/StatusUpdateModal';
import { CourierWeighModal } from '@/components/courier/CourierWeighModal';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Truck, CheckCircle2, RefreshCw, PackageCheck, Layers, ArrowRight, User } from 'lucide-react';

export default function CourierDashboardPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getWibTodayDateString());
  const [jobPool, setJobPool] = useState<CourierJobPoolResponse | null>(null);
  const [claimedOrders, setClaimedOrders] = useState<Order[]>([]);
  const [selectedUpdateOrder, setSelectedUpdateOrder] = useState<Order | null>(null);
  const [selectedWeighOrder, setSelectedWeighOrder] = useState<Order | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoadingPool, setIsLoadingPool] = useState<boolean>(true);

  // Load Job Pool Aggregate Data
  const loadJobPoolData = async (dateStr: string) => {
    setIsLoadingPool(true);
    try {
      let data: CourierJobPoolResponse | null = null;

      if (supabase && typeof window !== 'undefined') {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const res = await fetch(`/api/courier/job-pool?date=${dateStr}`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          const result = await res.json();
          if (res.ok && result.success && result.data) {
            data = result.data;
          }
        }
      }

      if (!data) {
        data = await courierJobPoolService.getCourierJobPoolAsync(dateStr, currentUser?.id);
      }

      setJobPool(data);
    } catch (err) {
      console.warn('[COURIER-JOB-POOL-LOAD-ERR]', err);
    } finally {
      setIsLoadingPool(false);
    }
  };

  // Load Authenticated Courier's Claimed Active & Historical Orders
  const loadMyClaimedJobs = async () => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    if (!user) return;
    try {
      const courierOrders = await orderService.getOrdersByCourierAsync(user.id);
      setClaimedOrders(courierOrders);
    } catch {
      const courierOrders = orderService.getOrdersByCourier(user.id);
      setClaimedOrders(courierOrders);
    }
  };

  useEffect(() => {
    loadMyClaimedJobs();
  }, []);

  useEffect(() => {
    loadJobPoolData(selectedDate);
  }, [selectedDate, currentUser?.id]);

  // Courier Heartbeat Loop (every 30s)
  useEffect(() => {
    if (!currentUser) return;
    const triggerHeartbeat = async () => {
      try {
        const { dispatchService } = await import('@/services/dispatchService');
        await dispatchService.updateCourierHeartbeatAsync(
          currentUser.id,
          -6.2415,
          106.7972,
          '327401',
          '3274011001',
          isOnline
        );
      } catch (err) {
        console.warn('[COURIER-HEARTBEAT-ERR]', err);
      }
    };

    triggerHeartbeat();
    const interval = setInterval(triggerHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [currentUser, isOnline]);

  const handleArrivedAtOutlet = async (order: Order) => {
    if (!currentUser) return;
    try {
      await orderService.markCourierArrivedAtLaundryAsync(order.id, currentUser.id);
      alert(`Kedatangan Anda di outlet laundry untuk order #${order.trackingNumber} berhasil dicatat!\nSilakan tunggu Owner/Staff menimbang cucian.`);
      loadMyClaimedJobs();
    } catch (err: any) {
      alert(err.message || 'Gagal mencatat kedatangan kurir.');
    }
  };

  const handlePickupOrder = async (order: Order) => {
    if (!currentUser) return;
    try {
      const sessionRes = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
      const token = sessionRes?.data?.session?.access_token;
      const res = await fetch(`/api/orders/${order.id}/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetStatus: 'picked_up',
          notes: 'Cucian berhasil di-pickup oleh kurir.',
          userId: currentUser.id,
          role: 'courier',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal melakukan pickup laundry.');
      }
      alert(`Cucian order #${order.trackingNumber} berhasil di-pickup! Status kini 'picked_up'.`);
      loadMyClaimedJobs();
    } catch (err: any) {
      alert(err.message || 'Gagal melakukan pickup laundry.');
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: any, notes: string) => {
    if (!currentUser) return;
    try {
      await orderService.updateOrderStatusAsync(orderId, newStatus, notes, currentUser.id);
      loadMyClaimedJobs();
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui status order.');
    }
  };

  const activeClaimedTasks = claimedOrders.filter(
    (o) => o.status === 'assigned' || o.status === 'picked_up' || o.status === 'out_for_delivery'
  );

  const completedTasks = claimedOrders.filter(
    (o) => o.status === 'delivered' || o.status === 'in_washing'
  );

  const pickupActiveTasks = activeClaimedTasks.filter((o) => o.status === 'assigned' || o.status === 'picked_up');
  const deliveryActiveTasks = activeClaimedTasks.filter((o) => o.status === 'out_for_delivery');

  const totalAvailableInPool = jobPool
    ? jobPool.pickupSlots.reduce((acc, s) => acc + s.availableOrders, 0) +
      jobPool.deliverySlots.reduce((acc, s) => acc + s.availableOrders, 0)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-800 via-amber-700 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold">
            <Truck className="w-3.5 h-3.5" />
            <span>Portal Kurir Driver — Home Dashboard</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Logistik Driver: {currentUser?.fullName || 'Kurir Driver'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Overview ketersediaan job pool, status tugas berjalan, dan performa operasional.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOnline(!isOnline)}
            className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              isOnline
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30'
                : 'bg-rose-500/20 border-rose-400/40 text-rose-300 hover:bg-rose-500/30'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            Status: {isOnline ? 'ONLINE' : 'OFFLINE'}
          </button>
          <button
            onClick={() => {
              loadJobPoolData(selectedDate);
              loadMyClaimedJobs();
            }}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/20 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* WIB Date Selector */}
      <CourierDateSelector
        selectedDate={selectedDate}
        onDateChange={(newDate) => setSelectedDate(newDate)}
      />

      {/* Driver KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Link href="/courier/job-pool" className="block group">
          <Card variant="white" className="border-slate-200 group-hover:border-amber-400 transition-all group-hover:shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Job Pool Tersedia</span>
              <Layers className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-3xl font-black text-slate-900">{isLoadingPool ? '...' : totalAvailableInPool}</p>
            <p className="text-xs text-slate-400 font-medium mt-1">Order di unassigned job pool</p>
          </Card>
        </Link>

        <Link href="/courier/active-tasks" className="block group">
          <Card variant="white" className="border-slate-200 group-hover:border-sky-400 transition-all group-hover:shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Tugas Saya (Aktif)</span>
              <Truck className="w-5 h-5 text-sky-600" />
            </div>
            <p className="text-3xl font-black text-slate-900">{activeClaimedTasks.length}</p>
            <p className="text-xs text-slate-400 font-medium mt-1">
              {pickupActiveTasks.length} Pickup • {deliveryActiveTasks.length} Delivery
            </p>
          </Card>
        </Link>

        <Link href="/courier/active-tasks" className="block group">
          <Card variant="white" className="border-slate-200 group-hover:border-emerald-400 transition-all group-hover:shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Tugas Selesai</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-black text-slate-900">{completedTasks.length}</p>
            <p className="text-xs text-slate-400 font-medium mt-1">Riwayat penjemputan & pengantaran</p>
          </Card>
        </Link>
      </div>

      {/* Quick Navigation Action Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/courier/job-pool"
          className="p-5 rounded-2xl bg-amber-500/10 border border-amber-300 hover:bg-amber-500/15 transition-colors flex items-center justify-between text-amber-950 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-md shadow-amber-600/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black text-sm">Cek & Klaim Job Pool</p>
              <p className="text-xs text-amber-800 font-medium">Slot order penjemputan & pengantaran</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-amber-700 group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/courier/active-tasks"
          className="p-5 rounded-2xl bg-sky-500/10 border border-sky-300 hover:bg-sky-500/15 transition-colors flex items-center justify-between text-sky-950 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-bold shadow-md shadow-sky-600/20">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black text-sm">Kelola Tugas Berjalan</p>
              <p className="text-xs text-sky-800 font-medium">{activeClaimedTasks.length} tugas aktif perlu diproses</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-sky-700 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Overview Active Tasks */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Badge variant="emerald">RINGKASAN TUGAS AKTIF</Badge>
            <span>Tugas Penjemputan & Pengantaran Terdekat</span>
          </h2>
          <Link href="/courier/active-tasks" className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1">
            Lihat Semua ({activeClaimedTasks.length}) <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {activeClaimedTasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeClaimedTasks.slice(0, 3).map((o) => (
              <CourierOrderCard
                key={o.id}
                order={o}
                onUpdateClick={(target) => setSelectedUpdateOrder(target)}
                onArrivedClick={handleArrivedAtOutlet}
                onPickupClick={handlePickupOrder}
                onWeighClick={(target) => setSelectedWeighOrder(target)}
              />
            ))}
          </div>
        ) : (
          <Card variant="white" className="p-8 text-center text-slate-400 text-xs italic border-dashed">
            Belum ada tugas aktif. Silakan masuk ke <Link href="/courier/job-pool" className="text-amber-600 underline font-bold">Job Pool</Link> untuk mengambil job.
          </Card>
        )}
      </div>

      {/* Driver Update Status Modal */}
      <StatusUpdateModal
        isOpen={Boolean(selectedUpdateOrder)}
        onClose={() => setSelectedUpdateOrder(null)}
        order={selectedUpdateOrder}
        onUpdateStatus={handleUpdateStatus}
      />

      {/* Driver Digital Weighing Modal */}
      {selectedWeighOrder && (
        <CourierWeighModal
          order={selectedWeighOrder}
          onClose={() => setSelectedWeighOrder(null)}
          onSuccess={() => {
            setSelectedWeighOrder(null);
            loadMyClaimedJobs();
          }}
        />
      )}
    </div>
  );
}
