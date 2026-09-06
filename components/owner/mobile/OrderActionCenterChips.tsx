'use client';

import React, { useMemo } from 'react';
import { Order } from '@/types/order';

export type OrderFilterCategory = 'all' | 'weight_verification' | 'ready_to_wash' | 'ready_for_delivery' | 'delivered';

interface OrderActionCenterChipsProps {
  orders: Order[];
  activeFilter: OrderFilterCategory;
  onFilterChange: (filter: OrderFilterCategory) => void;
}

export const OrderActionCenterChips: React.FC<OrderActionCenterChipsProps> = ({
  orders,
  activeFilter,
  onFilterChange,
}) => {
  const counts = useMemo(() => {
    const weightVerification = orders.filter(
      (o) => o.status === 'picked_up' && !o.weightFinalizedAt && !o.finalWeightKg
    ).length;

    const readyToWash = orders.filter(
      (o) => o.status === 'picked_up' && (Boolean(o.weightFinalizedAt) || Boolean(o.finalWeightKg))
    ).length;

    const readyForDelivery = orders.filter((o) => o.status === 'ready_for_delivery').length;

    const delivered = orders.filter((o) => o.status === 'delivered').length;

    const allActive = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length;

    return {
      allActive,
      weightVerification,
      readyToWash,
      readyForDelivery,
      delivered,
    };
  }, [orders]);

  const chips: { id: OrderFilterCategory; label: string; count: number; icon: string }[] = [
    { id: 'all', label: 'Semua Aktif', count: counts.allActive, icon: '📋' },
    { id: 'weight_verification', label: 'Timbang', count: counts.weightVerification, icon: '⚖️' },
    { id: 'ready_to_wash', label: 'Cuci', count: counts.readyToWash, icon: '🧼' },
    { id: 'ready_for_delivery', label: 'Antar', count: counts.readyForDelivery, icon: '📦' },
    { id: 'delivered', label: 'Selesai', count: counts.delivered, icon: '✓' },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
      {chips.map((chip) => {
        const isActive = activeFilter === chip.id;

        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onFilterChange(chip.id)}
            className={`px-3 py-1.5 rounded-full font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
              isActive
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{chip.icon} {chip.label}</span>
            {chip.count > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {chip.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
