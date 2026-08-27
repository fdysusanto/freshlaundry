'use client';

import React, { useState, useEffect } from 'react';
import { authService } from '@/services/authService';
import { supabase } from '@/services/supabase';
import { orderService } from '@/services/orderService';
import { Order, OrderStatus } from '@/types/order';
import { UserProfile } from '@/types/user';
import { TaskCard } from '@/components/courier/TaskCard';
import { StatusUpdateModal } from '@/components/courier/StatusUpdateModal';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Truck, CheckCircle2, Clock, MapPin, RefreshCw, PackageCheck } from 'lucide-react';

export default function CourierDashboardPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'assigned' | 'active' | 'completed'>('assigned');
  const [selectedUpdateOrder, setSelectedUpdateOrder] = useState<Order | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  const loadData = async () => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    if (!user) return;
    try {
      const courierOrders = await orderService.getOrdersByCourierAsync(user.id);
      setOrders(courierOrders);
    } catch {
      const courierOrders = orderService.getOrdersByCourier(user.id);
      setOrders(courierOrders);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Courier Heartbeat & Expired Batch Worker Loop (every 30s)
  useEffect(() => {
    if (!currentUser) return;
    const triggerHeartbeatAndWorker = async () => {
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
        await dispatchService.processExpiredDispatchBatchesAsync();
      } catch (err) {
        console.warn('[COURIER-HEARTBEAT-ERR]', err);
      }
    };

    triggerHeartbeatAndWorker();
    const interval = setInterval(triggerHeartbeatAndWorker, 30000);
    return () => clearInterval(interval);
  }, [currentUser, isOnline]);

  const handleAcceptTask = async (order: Order) => {
    if (!currentUser) return;
    try {
      const assignmentId = order.assignmentId || order.id;
      await orderService.acceptCourierAssignmentAsync(assignmentId, currentUser.id);
      alert(`Berhasil menerima tugas ${order.assignmentType === 'delivery' ? 'pengantaran (delivery)' : 'penjemputan (pickup)'} untuk order #${order.trackingNumber}!`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal menerima tugas kurir.');
    }
  };

  const handleArrivedAtOutlet = async (order: Order) => {
    if (!currentUser) return;
    try {
      await orderService.markCourierArrivedAtLaundryAsync(order.id, currentUser.id);
      alert(`Kedatangan Anda di outlet laundry untuk order #${order.trackingNumber} berhasil dicatat!\nSilakan tunggu Owner/Staff menimbang cucian.`);
      loadData();
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
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal melakukan pickup laundry.');
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus, notes: string) => {
    if (!currentUser) return;
    try {
      await orderService.updateOrderStatusAsync(orderId, newStatus, notes, currentUser.id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui status order.');
    }
  };

  // Group tasks into TUGAS (offered/pending/assigned), DALAM PENANGANAN (picked_up / out_for_delivery), and SELESAI
  const offeredOrPendingTasks = orders.filter((o) => 
    o.assignmentStatus === 'offered' || o.status === 'assigned' || o.status === 'pending' || (o.assignmentType === 'delivery' && o.status === 'ready_for_delivery')
  );

  const activeHandlingTasks = orders.filter((o) =>
    o.status === 'picked_up' || o.status === 'out_for_delivery'
  );

  const completedTasks = orders.filter((o) => 
    o.status === 'delivered' || o.status === 'in_washing' || o.assignmentStatus === 'completed'
  );

  // Split TUGAS into Pickup vs Delivery
  const pickupTugas = offeredOrPendingTasks.filter((o) => o.assignmentType !== 'delivery' && o.status !== 'ready_for_delivery');
  const deliveryTugas = offeredOrPendingTasks.filter((o) => o.assignmentType === 'delivery' || o.status === 'ready_for_delivery');

  // Split DALAM PENANGANAN into Pickup vs Delivery
  const pickupActive = activeHandlingTasks.filter((o) => o.status === 'picked_up');
  const deliveryActive = activeHandlingTasks.filter((o) => o.status === 'out_for_delivery');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-800 via-amber-700 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold">
            <Truck className="w-3.5 h-3.5" />
            <span>Portal Kurir Driver — First-Class Logistics Tasks</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Tugas Logistik: {currentUser?.fullName || 'Kurir Driver'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Kelola penjemputan (Pickup) & pengantaran (Delivery) laundry secara terpisah & real-time.
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
            Status: {isOnline ? 'ONLINE (SIAP TUGAS)' : 'OFFLINE'}
          </button>
          <button
            onClick={loadData}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/20 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Data
          </button>
        </div>
      </div>

      {/* Driver KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card variant="white" className="border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Tugas Tersedia / Offered</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-3xl font-black text-slate-900">{offeredOrPendingTasks.length}</p>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {pickupTugas.length} Pickup • {deliveryTugas.length} Delivery
          </p>
        </Card>

        <Card variant="white" className="border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Dalam Penanganan</span>
            <MapPin className="w-5 h-5 text-sky-600" />
          </div>
          <p className="text-3xl font-black text-slate-900">{activeHandlingTasks.length}</p>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {pickupActive.length} Di-pickup • {deliveryActive.length} Diantar
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

      {/* Main Tabs Navigation */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('assigned')}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'assigned'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            [TUGAS] Penawaran & Penugasan ({offeredOrPendingTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'active'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            [DALAM PENANGANAN] ({activeHandlingTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            [SELESAI] ({completedTasks.length})
          </button>
        </div>

        {/* TAB CONTENT 1: [TUGAS] */}
        {activeTab === 'assigned' && (
          <div className="space-y-8">
            {/* PICKUP TASKS SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Badge variant="amber">PICKUP</Badge>
                  <span>Tugas Penjemputan (Customer → Laundry Outlet)</span>
                </h2>
                <span className="text-xs font-semibold text-slate-400">{pickupTugas.length} tugas</span>
              </div>
              {pickupTugas.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pickupTugas.map((o) => (
                    <TaskCard
                      key={o.id}
                      order={o}
                      onUpdateClick={(target) => setSelectedUpdateOrder(target)}
                      onAcceptClick={handleAcceptTask}
                      onArrivedClick={handleArrivedAtOutlet}
                      onPickupClick={handlePickupOrder}
                    />
                  ))}
                </div>
              ) : (
                <Card variant="white" className="p-6 text-center text-slate-400 text-xs italic border-dashed">
                  Belum ada penawaran atau tugas pickup saat ini.
                </Card>
              )}
            </div>

            {/* DELIVERY TASKS SECTION */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Badge variant="purple">DELIVERY</Badge>
                  <span>Tugas Pengantaran (Laundry Outlet → Customer)</span>
                </h2>
                <span className="text-xs font-semibold text-slate-400">{deliveryTugas.length} tugas</span>
              </div>
              {deliveryTugas.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {deliveryTugas.map((o) => (
                    <TaskCard
                      key={o.id}
                      order={o}
                      onUpdateClick={(target) => setSelectedUpdateOrder(target)}
                      onAcceptClick={handleAcceptTask}
                      onArrivedClick={handleArrivedAtOutlet}
                      onPickupClick={handlePickupOrder}
                    />
                  ))}
                </div>
              ) : (
                <Card variant="white" className="p-6 text-center text-slate-400 text-xs italic border-dashed">
                  Belum ada penawaran atau tugas delivery saat ini.
                </Card>
              )}
            </div>
          </div>
        )}

        {/* TAB CONTENT 2: [DALAM PENANGANAN] */}
        {activeTab === 'active' && (
          <div className="space-y-8">
            {/* ACTIVE PICKUP TASKS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Badge variant="emerald">PICKUP DALAM PROSES</Badge>
                  <span>Proses Penjemputan & Antar ke Outlet</span>
                </h2>
                <span className="text-xs font-semibold text-slate-400">{pickupActive.length} tugas</span>
              </div>
              {pickupActive.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pickupActive.map((o) => (
                    <TaskCard
                      key={o.id}
                      order={o}
                      onUpdateClick={(target) => setSelectedUpdateOrder(target)}
                      onAcceptClick={handleAcceptTask}
                      onArrivedClick={handleArrivedAtOutlet}
                      onPickupClick={handlePickupOrder}
                    />
                  ))}
                </div>
              ) : (
                <Card variant="white" className="p-6 text-center text-slate-400 text-xs italic border-dashed">
                  Tidak ada tugas pickup yang sedang aktif dalam perjalanan.
                </Card>
              )}
            </div>

            {/* ACTIVE DELIVERY TASKS */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Badge variant="purple">DELIVERY DALAM PROSES</Badge>
                  <span>Proses Pengantaran ke Customer</span>
                </h2>
                <span className="text-xs font-semibold text-slate-400">{deliveryActive.length} tugas</span>
              </div>
              {deliveryActive.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {deliveryActive.map((o) => (
                    <TaskCard
                      key={o.id}
                      order={o}
                      onUpdateClick={(target) => setSelectedUpdateOrder(target)}
                      onAcceptClick={handleAcceptTask}
                      onArrivedClick={handleArrivedAtOutlet}
                      onPickupClick={handlePickupOrder}
                    />
                  ))}
                </div>
              ) : (
                <Card variant="white" className="p-6 text-center text-slate-400 text-xs italic border-dashed">
                  Tidak ada tugas pengantaran yang sedang aktif dalam perjalanan.
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
                  <TaskCard
                    key={o.id}
                    order={o}
                    onUpdateClick={(target) => setSelectedUpdateOrder(target)}
                    onAcceptClick={handleAcceptTask}
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
