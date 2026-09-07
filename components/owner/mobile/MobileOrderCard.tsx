'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Scale, Sparkles, CheckCircle2, Package, Truck, Clock } from 'lucide-react';
import { Order, OrderStatus } from '@/types/order';
import { getStatusConfig } from '@/utils/helpers';
import { Button } from '@/components/ui/Button';

interface MobileOrderCardProps {
  order: Order;
  onVerifyWeight: (order: Order) => void;
  onTransitionStatus: (order: Order, targetStatus: OrderStatus, notes: string) => void;
  isProcessing?: boolean;
}

export const MobileOrderCard: React.FC<MobileOrderCardProps> = ({
  order,
  onVerifyWeight,
  onTransitionStatus,
  isProcessing = false,
}) => {
  const isNeedsWeight =
    order.status === 'picked_up' && !order.weightFinalizedAt && !order.finalWeightKg;
  const isReadyToWash =
    order.status === 'picked_up' && (Boolean(order.weightFinalizedAt) || Boolean(order.finalWeightKg));
  const isInWashing = order.status === 'in_washing';
  const isReadyForDelivery = order.status === 'ready_for_delivery';
  const isOutForDelivery = order.status === 'out_for_delivery';
  const isDelivered = order.status === 'delivered';

  const statusCfg = getStatusConfig(order.status);

  // Render primary action button or helper text based on matrix
  const renderPrimaryAction = () => {
    if (isNeedsWeight) {
      return (
        <Button
          variant="primary"
          size="sm"
          className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
          disabled={isProcessing}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onVerifyWeight(order);
          }}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Verifikasi Berat</span>
        </Button>
      );
    }

    if (isReadyToWash) {
      return (
        <Button
          variant="primary"
          size="sm"
          className="bg-brand-primary hover:bg-brand-primary/90 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
          disabled={isProcessing}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTransitionStatus(order, 'in_washing', 'Laundry outlet mulai mencuci cucian customer');
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isProcessing ? 'Memproses...' : 'Mulai Pencucian'}</span>
        </Button>
      );
    }

    if (isInWashing) {
      return (
        <Button
          variant="primary"
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
          disabled={isProcessing}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTransitionStatus(order, 'ready_for_delivery', 'Cucian selesai & siap diantar');
          }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{isProcessing ? 'Memproses...' : 'Selesai Dicuci'}</span>
        </Button>
      );
    }

    if (isReadyForDelivery) {
      return (
        <span className="text-[10px] font-bold text-slate-500 italic bg-slate-100 px-2 py-1 rounded-lg shrink-0">
          📦 Menunggu Kurir
        </span>
      );
    }

    if (isOutForDelivery) {
      return (
        <span className="text-[10px] font-bold text-blue-700 italic bg-blue-50 px-2 py-1 rounded-lg shrink-0">
          🚚 Sedang Diantar
        </span>
      );
    }

    if (order.status === 'assigned') {
      return (
        <span className="text-[10px] font-semibold text-slate-500 italic shrink-0">
          Kurir menuju lokasi
        </span>
      );
    }

    if (order.status === 'pending') {
      return (
        <span className="text-[10px] font-semibold text-slate-500 italic shrink-0">
          Menunggu pickup
        </span>
      );
    }

    return null;
  };

  return (
    <Link href={`/orders/${order.id}`} className="block focus:outline-hidden">
      <div className="p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-brand-secondary hover:shadow-xs transition-all space-y-2 group">
        {/* ROW 1: Customer Name & Chevron */}
        <div className="flex items-center justify-between">
          <h4 className="font-extrabold text-sm text-slate-900 truncate group-hover:text-brand-primary transition-colors">
            {order.customerName || 'Customer'}
          </h4>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-secondary transition-colors shrink-0" />
        </div>

        {/* ROW 2: Tracking Number */}
        <div className="text-[11px] font-extrabold font-mono text-slate-500 tracking-tight">
          #{order.trackingNumber}
        </div>

        {/* ROW 3: Status Badge & Primary Action Button */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          {/* Status Badge */}
          {isNeedsWeight ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
              ⚖️ Perlu Verifikasi Berat
            </span>
          ) : (
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusCfg.bg} ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          )}

          {/* Primary Action Button */}
          {renderPrimaryAction()}
        </div>
      </div>
    </Link>
  );
};
