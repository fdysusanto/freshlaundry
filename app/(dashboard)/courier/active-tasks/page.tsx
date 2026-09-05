'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { authService } from '@/services/authService';
import { supabase } from '@/services/supabase';
import { orderService } from '@/services/orderService';
import { Order, OrderStatus } from '@/types/order';
import { UserProfile } from '@/types/user';
import { CourierOrderCard } from '@/components/courier/CourierOrderCard';
import { StatusUpdateModal } from '@/components/courier/StatusUpdateModal';
import { CourierWeighModal } from '@/components/courier/CourierWeighModal';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Truck, PackageCheck, RefreshCw, Layers } from 'lucide-react';

export default function CourierActiveTasksPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [claimedOrders, setClaimedOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [selectedUpdateOrder, setSelectedUpdateOrder] = useState<Order | null>(null);
  const [selectedWeighOrder, setSelectedWeighOrder] = useState<Order | null>(null);

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

  const activeClaimedTasks = claimedOrders.filter(
    (o) => o.status === 'assigned' || o.status === 'picked_up' || o.status === 'out_for_delivery'
  );

  const completedTasks = claimedOrders.filter(
    (o) => o.status === 'delivered' || o.status === 'in_washing'
  );

  const pickupActiveTasks = activeClaimedTasks.filter((o) => o.status === 'assigned' || o.status === 'picked_up');
  const deliveryActiveTasks = activeClaimedTasks.filter((o) => o.status === 'out_for_delivery');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sky-800 via-teal-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-bold mb-2">
            <Truck className="w-3.5 h-3.5" />
            <span>Tugas Berjalan Logistics Driver</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">🚚 Tugas Berjalan</h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Manajemen order penjemputan & pengantaran yang aktif dalam penanganan Anda.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadMyClaimedJobs()}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/20 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Tugas
          </button>
        </div>
      </div>

      {/* Toggle Tab Filters */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'active'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            Tugas Aktif ({activeClaimedTasks.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            Selesai ({completedTasks.length})
          </button>
        </div>

        <Link
          href="/courier/job-pool"
          className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200"
        >
          <Layers className="w-3.5 h-3.5" /> Ambil Job Pool Baru
        </Link>
      </div>

      {/* ACTIVE TASKS VIEW */}
      {activeTab === 'active' && (
        <div className="space-y-8">
          {/* ACTIVE PICKUP ASSIGNMENTS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Badge variant="emerald">PICKUP AKTIF</Badge>
                <span>Order Penjemputan (Customer → Outlet Laundry)</span>
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
                    onWeighClick={(target) => setSelectedWeighOrder(target)}
                  />
                ))}
              </div>
            ) : (
              <Card variant="white" className="p-6 text-center text-slate-400 text-xs italic border-dashed">
                Belum ada tugas pickup aktif. Silakan klaim slot di Job Pool.
              </Card>
            )}
          </div>

          {/* ACTIVE DELIVERY ASSIGNMENTS */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Badge variant="purple">DELIVERY AKTIF</Badge>
                <span>Order Pengantaran (Outlet Laundry → Customer)</span>
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
                Belum ada tugas pengantaran aktif. Silakan klaim slot di Job Pool.
              </Card>
            )}
          </div>
        </div>
      )}

      {/* COMPLETED TASKS VIEW */}
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
