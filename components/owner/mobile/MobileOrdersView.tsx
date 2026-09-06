'use client';

import React, { useState, useMemo } from 'react';
import { Search, Sparkles, CheckCircle2, Scale, Package, Truck, X } from 'lucide-react';
import { Order, OrderStatus } from '@/types/order';
import { MobileOrderCard } from './MobileOrderCard';
import { OrderActionCenterChips, OrderFilterCategory } from './OrderActionCenterChips';

interface MobileOrdersViewProps {
  orders: Order[];
  onVerifyWeight: (order: Order) => void;
  onTransitionStatus: (order: Order, targetStatus: OrderStatus, notes: string) => void;
  processingOrderId?: string | null;
  initialFilter?: OrderFilterCategory;
}

export const MobileOrdersView: React.FC<MobileOrdersViewProps> = ({
  orders,
  onVerifyWeight,
  onTransitionStatus,
  processingOrderId = null,
  initialFilter = 'all',
}) => {
  const [activeFilter, setActiveFilter] = useState<OrderFilterCategory>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Filter & Sort orders based on search & active filter chip
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        // Search filter (customer name or tracking number)
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          order.trackingNumber.toLowerCase().includes(q) ||
          order.customerName?.toLowerCase().includes(q);

        if (!matchesQuery) return false;

        // Action Center Category filter
        if (activeFilter === 'weight_verification') {
          return order.status === 'picked_up' && !order.weightFinalizedAt && !order.finalWeightKg;
        }
        if (activeFilter === 'ready_to_wash') {
          return order.status === 'picked_up' && (Boolean(order.weightFinalizedAt) || Boolean(order.finalWeightKg));
        }
        if (activeFilter === 'ready_for_delivery') {
          return order.status === 'ready_for_delivery';
        }
        if (activeFilter === 'delivered') {
          return order.status === 'delivered';
        }

        // 'all' filter: Active orders first (exclude delivered/cancelled)
        return order.status !== 'delivered' && order.status !== 'cancelled';
      })
      .sort((a, b) => {
        // Priority sort: Perlu Timbang ➔ Siap Dicuci ➔ Siap Antar ➔ Sedang Dicuci ➔ Newest
        const getPrio = (o: Order) => {
          if (o.status === 'picked_up' && !o.weightFinalizedAt && !o.finalWeightKg) return 1;
          if (o.status === 'picked_up' && (o.weightFinalizedAt || o.finalWeightKg)) return 2;
          if (o.status === 'ready_for_delivery') return 3;
          if (o.status === 'in_washing') return 4;
          return 5;
        };

        const pA = getPrio(a);
        const pB = getPrio(b);
        if (pA !== pB) return pA - pB;

        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tB - tA;
      });
  }, [orders, activeFilter, searchQuery]);

  // Render Compact Empty State
  const renderEmptyState = () => {
    if (activeFilter === 'weight_verification') {
      return (
        <div className="p-6 text-center space-y-1.5 bg-amber-50/50 rounded-2xl border border-dashed border-amber-200">
          <Scale className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="font-bold text-xs text-slate-800">Semua pesanan sudah diverifikasi</p>
          <p className="text-[11px] text-slate-500">Tidak ada cucian yang menunggu verifikasi berat saat ini.</p>
        </div>
      );
    }
    if (activeFilter === 'ready_to_wash') {
      return (
        <div className="p-6 text-center space-y-1.5 bg-emerald-50/50 rounded-2xl border border-dashed border-emerald-200">
          <Sparkles className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="font-bold text-xs text-slate-800">Tidak ada cucian menunggu diproses</p>
          <p className="text-[11px] text-slate-500">Seluruh cucian yang terverifikasi telah masuk mesin cuci.</p>
        </div>
      );
    }
    if (activeFilter === 'ready_for_delivery') {
      return (
        <div className="p-6 text-center space-y-1.5 bg-purple-50/50 rounded-2xl border border-dashed border-purple-200">
          <Truck className="w-8 h-8 text-purple-500 mx-auto" />
          <p className="font-bold text-xs text-slate-800">Tidak ada cucian menunggu pengantaran</p>
          <p className="text-[11px] text-slate-500">Semua pesanan selesai telah diambil kurir pengantar.</p>
        </div>
      );
    }
    if (activeFilter === 'delivered') {
      return (
        <div className="p-6 text-center space-y-1.5 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="font-bold text-xs text-slate-800">Belum ada riwayat pesanan selesai</p>
        </div>
      );
    }

    return (
      <div className="p-6 text-center space-y-1.5 bg-teal-50/30 rounded-2xl border border-dashed border-teal-200">
        <Package className="w-8 h-8 text-teal-600 mx-auto" />
        <p className="font-bold text-xs text-slate-800">✨ Belum Ada Pesanan Aktif</p>
        <p className="text-[11px] text-slate-500">Pesanan baru yang masuk akan langsung muncul di sini.</p>
      </div>
    );
  };

  return (
    <div className="space-y-3.5">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Pesanan</h3>
          <p className="text-xs text-slate-500 font-medium">Kelola operasional &amp; proses pesanan</p>
        </div>

        {/* Compact Search Trigger / Input */}
        {isSearchExpanded ? (
          <div className="relative flex-1 max-w-[200px]">
            <input
              type="text"
              autoFocus
              placeholder="Cari customer / resi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-medium pl-8 pr-7 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setIsSearchExpanded(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsSearchExpanded(true)}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
          >
            <Search className="w-4 h-4 text-slate-500" />
            <span>Cari</span>
          </button>
        )}
      </div>

      {/* Action Center Horizontal Filter Chips */}
      <OrderActionCenterChips
        orders={orders}
        activeFilter={activeFilter}
        onFilterChange={(f) => setActiveFilter(f)}
      />

      {/* Order Cards List */}
      {filteredOrders.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-2.5">
          {filteredOrders.map((order) => (
            <MobileOrderCard
              key={order.id}
              order={order}
              onVerifyWeight={onVerifyWeight}
              onTransitionStatus={onTransitionStatus}
              isProcessing={processingOrderId === order.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};
