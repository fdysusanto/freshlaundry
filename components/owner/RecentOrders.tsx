'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ShoppingBag, Eye, ArrowRight, Clock, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Order } from '@/types/order';
import { formatIDR, formatDateTimeIndo } from '@/utils/formatters';
import { getStatusConfig } from '@/utils/helpers';
import { CompactOrderCard, CompactOrderCardSkeleton } from './CompactOrderCard';

interface RecentOrdersProps {
  orders: Order[];
  onViewAllOrders: () => void;
  isLoading?: boolean;
}

export const RecentOrders: React.FC<RecentOrdersProps> = ({
  orders,
  onViewAllOrders,
  isLoading = false,
}) => {
  // Sort orders for Home Display priority:
  // 1. Perlu Verifikasi Berat (picked_up && !weightFinalizedAt)
  // 2. Siap Dicuci (picked_up && weightFinalizedAt)
  // 3. Siap Diantar (ready_for_delivery)
  // 4. Sedang Dicuci (in_washing)
  // 5. Others
  const sortedHomeOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => {
        const getPriority = (o: Order) => {
          if (o.status === 'picked_up' && !o.weightFinalizedAt && !o.finalWeightKg) return 1;
          if (o.status === 'picked_up' && (o.weightFinalizedAt || o.finalWeightKg)) return 2;
          if (o.status === 'ready_for_delivery') return 3;
          if (o.status === 'in_washing') return 4;
          if (o.status === 'assigned' || o.status === 'pending') return 5;
          if (o.status === 'out_for_delivery') return 6;
          return 7;
        };

        const prioA = getPriority(a);
        const prioB = getPriority(b);
        if (prioA !== prioB) return prioA - prioB;

        // Secondary sort: newest created first
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 5);
  }, [orders]);

  if (isLoading) {
    return (
      <Card variant="white" className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-teal-600" />
            <span>Pesanan Aktif</span>
          </h3>
        </div>
        <div className="space-y-3">
          <CompactOrderCardSkeleton />
          <CompactOrderCardSkeleton />
          <CompactOrderCardSkeleton />
        </div>
      </Card>
    );
  }

  return (
    <Card variant="white" className="p-4 sm:p-6 space-y-4">
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-teal-600" />
          <span>Pesanan Aktif ({sortedHomeOrders.length})</span>
        </h3>
        <Button variant="outline" size="sm" onClick={onViewAllOrders} rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
          Lihat Semua Pesanan
        </Button>
      </div>

      {sortedHomeOrders.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-500 font-semibold space-y-1 bg-slate-50 rounded-2xl p-4 border border-dashed border-slate-200">
          <Sparkles className="w-7 h-7 text-teal-500 mx-auto" />
          <p className="font-bold text-slate-800">✨ Belum Ada Pesanan Aktif</p>
          <p className="text-[11px] text-slate-500">Pesanan baru yang membutuhkan penanganan akan muncul di sini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* MOBILE VIEW: COMPACT CARDS (No horizontal scroll, height <= 130px) */}
          <div className="block md:hidden space-y-2.5">
            {sortedHomeOrders.map((order) => (
              <CompactOrderCard key={order.id} order={order} />
            ))}
          </div>

          {/* DESKTOP VIEW: CLEAN TABLE */}
          <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50">
                  <th className="p-3">No. Tracking</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Layanan</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Total</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedHomeOrders.map((order) => {
                  const statusCfg = getStatusConfig(order.status);
                  const isNeedsWeight =
                    order.status === 'picked_up' && !order.weightFinalizedAt && !order.finalWeightKg;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-bold text-slate-800">#{order.trackingNumber}</td>
                      <td className="p-3 font-semibold text-slate-700">{order.customerName || 'Customer'}</td>
                      <td className="p-3 text-slate-600">{order.serviceType}</td>
                      <td className="p-3">
                        {isNeedsWeight ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                            ⚖️ Perlu Verifikasi Berat
                          </span>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.bg} ${statusCfg.color}`}
                          >
                            {statusCfg.label}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-black text-slate-900">{formatIDR(order.totalPrice)}</td>
                      <td className="p-3 text-right">
                        <Link href={`/orders/${order.id}`}>
                          <Button variant="outline" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
                            Detail
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
};
