'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Clock, Calendar, Truck, Check } from 'lucide-react';
import { Order } from '@/types/order';
import { formatIDR, formatDateTimeIndo } from '@/utils/formatters';
import { getStatusConfig } from '@/utils/helpers';

interface CompactOrderCardProps {
  order: Order;
  onClick?: () => void;
}

export const CompactOrderCard: React.FC<CompactOrderCardProps> = ({ order, onClick }) => {
  // Determine special visual presentation for picked_up orders needing weight verification
  const isNeedsWeightVerification =
    order.status === 'picked_up' && !order.weightFinalizedAt && !order.finalWeightKg;

  const statusCfg = getStatusConfig(order.status);

  // Relevant time representation based on status
  const renderRelevantTime = () => {
    if (order.status === 'pending' || order.status === 'assigned') {
      if (order.pickupTimeSlot) {
        return `📅 Pickup: ${order.pickupTimeSlot}`;
      }
      if (order.pickupDate) {
        return `📅 Pickup: ${order.pickupDate}`;
      }
    }
    if (order.status === 'ready_for_delivery' || order.status === 'out_for_delivery') {
      if (order.deliveryTimeSlot) {
        return `🚚 Antar: ${order.deliveryTimeSlot}`;
      }
      if (order.deliveryDate) {
        return `🚚 Antar: ${order.deliveryDate}`;
      }
    }
    if (order.status === 'delivered') {
      return `✓ Selesai ${formatDateTimeIndo(order.updatedAt || order.createdAt)}`;
    }
    // Default fallback to formatted update/create time
    return `🕒 ${formatDateTimeIndo(order.updatedAt || order.createdAt)}`;
  };

  const cardContent = (
    <div className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-brand-secondary hover:shadow-xs transition-all space-y-2 group cursor-pointer">
      {/* Top Row: Order Tracking Number & Price */}
      <div className="flex items-center justify-between">
        <span className="font-extrabold text-xs font-mono text-slate-900 tracking-tight group-hover:text-brand-primary transition-colors">
          #{order.trackingNumber}
        </span>
        {order.totalPrice ? (
          <span className="font-black text-xs text-brand-primary">{formatIDR(order.totalPrice)}</span>
        ) : null}
      </div>

      {/* Middle Row: Customer Name */}
      <div>
        <p className="text-xs font-bold text-slate-800 truncate">{order.customerName || 'Customer'}</p>
      </div>

      {/* Bottom Row: Status Badge, Relevant Time & Chevron */}
      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Status Badge */}
          {isNeedsWeightVerification ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-amber-100 text-amber-900 border-amber-300 shrink-0">
              ⚖️ Perlu Verifikasi Berat
            </span>
          ) : (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${statusCfg.bg} ${statusCfg.color}`}
            >
              {statusCfg.label}
            </span>
          )}

          {/* Time text */}
          <span className="text-[10px] font-medium text-slate-500 truncate">{renderRelevantTime()}</span>
        </div>

        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-secondary transition-colors shrink-0" />
      </div>
    </div>
  );

  if (onClick) {
    return <div onClick={onClick}>{cardContent}</div>;
  }

  return <Link href={`/orders/${order.id}`}>{cardContent}</Link>;
};

export const CompactOrderCardSkeleton: React.FC = () => {
  return (
    <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2.5 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="w-24 h-3.5 bg-slate-200 rounded-md" />
        <div className="w-16 h-3.5 bg-slate-200 rounded-md" />
      </div>
      <div className="w-32 h-3.5 bg-slate-200 rounded-md" />
      <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center">
        <div className="w-28 h-4 bg-slate-200 rounded-full" />
        <div className="w-4 h-4 bg-slate-200 rounded-full" />
      </div>
    </div>
  );
};
