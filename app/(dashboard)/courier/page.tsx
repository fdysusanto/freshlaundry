'use client';

import React, { useState, useEffect } from 'react';
import { authService } from '@/services/authService';
import { supabase } from '@/services/supabase';
import { orderService } from '@/services/orderService';
import { courierJobPoolService, CourierJobPoolResponse, getWibTodayDateString } from '@/services/courierJobPoolService';
import { Order, OrderStatus } from '@/types/order';
import { UserProfile } from '@/types/user';
import { CourierDateSelector } from '@/components/courier/CourierDateSelector';
import { JobPoolSlotCard } from '@/components/courier/JobPoolSlotCard';
import { CourierOrderCard } from '@/components/courier/CourierOrderCard';
import { StatusUpdateModal } from '@/components/courier/StatusUpdateModal';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Truck, CheckCircle2, Clock, RefreshCw, PackageCheck, Layers, AlertCircle } from 'lucide-react';

export default function CourierDashboardPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getWibTodayDateString());
  const [jobPool, setJobPool] = useState<CourierJobPoolResponse | null>(null);
  const [claimedOrders, setClaimedOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'job_pool' | 'my_jobs' | 'completed'>('job_pool');
  const [selectedUpdateOrder, setSelectedUpdateOrder] = useState<Order | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoadingPool, setIsLoadingPool] = useState<boolean>(true);
  const [claimingSlotKey, setClaimingSlotKey] = useState<string | null>(null);

  // Load Job Pool Aggregate Data (STRICT ZERO PII)
  const loadJobPoolData = async (dateStr: string) => {
    setIsLoadingPool(true);
    try {
      const data = await courierJobPoolService.getCourierJobPoolAsync(dateStr, currentUser?.id);
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

  // Handle Slot Claim (POST /api/courier/claim-slot)
  const handleClaimSlot = async (jobType: 'pickup' | 'delivery', timeSlot: string) => {
    if (!currentUser) return;
    const slotKey = `${jobType}_${timeSlot}`;
    setClaimingSlotKey(slotKey);

    try {
      const sessionRes = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
      const token = sessionRes?.data?.session?.access_token;

      const res = await fetch('/api/courier/claim-slot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          date: selectedDate,
          jobType,
          timeSlot,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errCode = data.error?.code;
        const errMessage = data.error?.message || data.message || 'Gagal melakukan claim slot job.';

        if (errCode === 'SLOT_CLAIM_NOT_YET_OPEN') {
          alert(`Waktu klaim untuk slot ${timeSlot} belum dibuka. Klaim baru dibuka pada 15 menit sebelum slot dimulai.`);
        } else if (errCode === 'MAX_CAPACITY_REACHED') {
          alert(`Kapasitas Anda untuk slot ${timeSlot} (${selectedDate}) sudah penuh (Maksimal 5 order).`);
        } else {
          alert(errMessage);
        }
        return;
      }

      if (data.claimedCount > 0) {
        alert(`Berhasil mengambil ${data.claimedCount} order untuk slot ${timeSlot} (${jobType.toUpperCase()})!`);
        setActiveTab('my_jobs'); // Switch to My Jobs tab automatically
      } else {
        alert(`Maaf, order pada slot ${timeSlot} sudah habis diambil oleh kurir lain.`);
      }

      // Refresh data
      await loadJobPoolData(selectedDate);
      await loadMyClaimedJobs();
    } catch (err: any) {
      alert(err.message || 'Gagal melakukan claim slot job.');
    } finally {
      setClaimingSlotKey(null);
    }
  };

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

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus, notes: string) => {
    if (!currentUser) return;
    try {
      await orderService.updateOrderStatusAsync(orderId, newStatus, notes, currentUser.id);
      loadMyClaimedJobs();
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui status order.');
    }
  };

  // Group claimed active tasks for My Jobs tab
  const activeClaimedTasks = claimedOrders.filter(
    (o) => o.status === 'assigned' || o.status === 'picked_up' || o.status === 'out_for_delivery'
  );

  const completedTasks = claimedOrders.filter(
    (o) => o.status === 'delivered' || o.status === 'in_washing'
  );

  const pickupActiveTasks = activeClaimedTasks.filter((o) => o.status === 'assigned' || o.status === 'picked_up');
  const deliveryActiveTasks = activeClaimedTasks.filter((o) => o.status === 'out_for_delivery');

  // Total available orders count across all slots for Job Pool badge
  const totalAvailableInPool = jobPool
    ? jobPool.pickupSlots.reduce((acc, s) => acc + s.availableOrders, 0) +
      jobPool.deliverySlots.reduce((acc, s) => acc + s.availableOrders, 0)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-800 via-amber-700 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold">
            <Truck className="w-3.5 h-3.5" />
            <span>Portal Kurir Driver — Slot-Based Job Pool Engine</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Logistik Driver: {currentUser?.fullName || 'Kurir Driver'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Pilih & klaim paket slot job (maksimal 5 order per slot) secara terpisah & real-time.
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
        <Card variant="white" className="border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Job Pool Tersedia</span>
            <Layers className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-3xl font-black text-slate-900">{isLoadingPool ? '...' : totalAvailableInPool}</p>
          <p className="text-xs text-slate-400 font-medium mt-1">Order di unassigned job pool</p>
        </Card>

        <Card variant="white" className="border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Tugas Saya (Aktif)</span>
            <Truck className="w-5 h-5 text-sky-600" />
          </div>
          <p className="text-3xl font-black text-slate-900">{activeClaimedTasks.length}</p>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {pickupActiveTasks.length} Pickup • {deliveryActiveTasks.length} Delivery
          </p>
        </Card>

        <Card variant="white" className="border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Tugas Selesai</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-slate-900">{completedTasks.length}</p>
          <p className="text-xs text-slate-400 font-medium mt-1">Riwayat penjemputan & pengantaran</p>
        </Card>
      </div>

      {/* Main Navigation Tabs */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('job_pool')}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'job_pool'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            [JOB POOL] Slot Job ({isLoadingPool ? '...' : totalAvailableInPool})
          </button>
          <button
            onClick={() => setActiveTab('my_jobs')}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'my_jobs'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            [TUGAS SAYA] ({activeClaimedTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            [SELESAI] ({completedTasks.length})
          </button>
        </div>

        {/* TAB CONTENT 1: [JOB POOL] */}
        {activeTab === 'job_pool' && (
          <div className="space-y-8">
            {/* PICKUP JOB POOL SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Badge variant="amber">PICKUP JOB POOL</Badge>
                  <span>Slot Penjemputan (Customer → Laundry Outlet)</span>
                </h2>
                <span className="text-xs font-semibold text-slate-400">
                  {jobPool ? jobPool.pickupSlots.reduce((a, b) => a + b.availableOrders, 0) : 0} order tersedia
                </span>
              </div>

              {isLoadingPool ? (
                <Card variant="white" className="p-8 text-center text-slate-400 text-xs italic">
                  Memuat data Pickup Job Pool...
                </Card>
              ) : jobPool?.pickupSlots && jobPool.pickupSlots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {jobPool.pickupSlots.map((slot) => (
                    <JobPoolSlotCard
                      key={`pickup_${slot.timeSlot}`}
                      slot={slot}
                      onClaim={handleClaimSlot}
                      isClaiming={claimingSlotKey === `pickup_${slot.timeSlot}`}
                    />
                  ))}
                </div>
              ) : (
                <Card variant="white" className="p-6 text-center text-slate-400 text-xs italic border-dashed">
                  Tidak ada slot pickup tersedia.
                </Card>
              )}
            </div>

            {/* DELIVERY JOB POOL SECTION */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Badge variant="purple">DELIVERY JOB POOL</Badge>
                  <span>Slot Pengantaran (Laundry Outlet → Customer)</span>
                </h2>
                <span className="text-xs font-semibold text-slate-400">
                  {jobPool ? jobPool.deliverySlots.reduce((a, b) => a + b.availableOrders, 0) : 0} order tersedia
                </span>
              </div>

              {isLoadingPool ? (
                <Card variant="white" className="p-8 text-center text-slate-400 text-xs italic">
                  Memuat data Delivery Job Pool...
                </Card>
              ) : jobPool?.deliverySlots && jobPool.deliverySlots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {jobPool.deliverySlots.map((slot) => (
                    <JobPoolSlotCard
                      key={`delivery_${slot.timeSlot}`}
                      slot={slot}
                      onClaim={handleClaimSlot}
                      isClaiming={claimingSlotKey === `delivery_${slot.timeSlot}`}
                    />
                  ))}
                </div>
              ) : (
                <Card variant="white" className="p-6 text-center text-slate-400 text-xs italic border-dashed">
                  Tidak ada slot delivery tersedia.
                </Card>
              )}
            </div>
          </div>
        )}

        {/* TAB CONTENT 2: [TUGAS SAYA] */}
        {activeTab === 'my_jobs' && (
          <div className="space-y-8">
            {/* ACTIVE PICKUP ASSIGNMENTS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Badge variant="emerald">PICKUP AKTIF</Badge>
                  <span>Order Penjemputan dalam Penanganan Anda</span>
                </h2>
                <span className="text-xs font-semibold text-slate-400">{pickupActiveTasks.length} tugas</span>
              </div>
              {pickupActiveTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pickupActiveTasks.map((o) => (
                    <CourierOrderCard
                      key={o.id}
                      order={o}
                      onUpdateClick={(target) => setSelectedUpdateOrder(target)}
                      onArrivedClick={handleArrivedAtOutlet}
                      onPickupClick={handlePickupOrder}
                    />
                  ))}
                </div>
              ) : (
                <Card variant="white" className="p-6 text-center text-slate-400 text-xs italic border-dashed">
                  Belum ada tugas pickup yang berhasil di-claim.
                </Card>
              )}
            </div>

            {/* ACTIVE DELIVERY ASSIGNMENTS */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Badge variant="purple">DELIVERY AKTIF</Badge>
                  <span>Order Pengantaran dalam Penanganan Anda</span>
                </h2>
                <span className="text-xs font-semibold text-slate-400">{deliveryActiveTasks.length} tugas</span>
              </div>
              {deliveryActiveTasks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {deliveryActiveTasks.map((o) => (
                    <CourierOrderCard
                      key={o.id}
                      order={o}
                      onUpdateClick={(target) => setSelectedUpdateOrder(target)}
                      onArrivedClick={handleArrivedAtOutlet}
                      onPickupClick={handlePickupOrder}
                    />
                  ))}
                </div>
              ) : (
                <Card variant="white" className="p-6 text-center text-slate-400 text-xs italic border-dashed">
                  Belum ada tugas pengantaran yang berhasil di-claim.
                </Card>
              )}
            </div>
          </div>
        )}

        {/* TAB CONTENT 3: [SELESAI] */}
        {activeTab === 'completed' && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Badge variant="emerald">RIWAYAT SELESAI</Badge>
              <span>Riwayat Tugas Penjemputan & Pengantaran Selesai</span>
            </h2>
            {completedTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {completedTasks.map((o) => (
                  <CourierOrderCard
                    key={o.id}
                    order={o}
                    onUpdateClick={(target) => setSelectedUpdateOrder(target)}
                    onArrivedClick={handleArrivedAtOutlet}
                    onPickupClick={handlePickupOrder}
                  />
                ))}
              </div>
            ) : (
              <Card variant="white" className="p-8 text-center text-slate-400 italic">
                Belum ada riwayat tugas selesai.
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Driver Update Status Modal */}
      <StatusUpdateModal
        isOpen={Boolean(selectedUpdateOrder)}
        onClose={() => setSelectedUpdateOrder(null)}
        order={selectedUpdateOrder}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
  );
}
