'use client';

import React from 'react';
import Link from 'next/link';
import { Order, OrderStatus } from '@/types/order';
import { getStatusConfig } from '@/utils/helpers';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { MapPin, Phone, Clock, ArrowRight, Store, Calendar, Compass, Navigation, MessageCircle } from 'lucide-react';

interface CourierOrderCardProps {
  order: Order;
  onUpdateClick: (order: Order) => void;
  onArrivedClick?: (order: Order) => void;
  onPickupClick?: (order: Order) => void;
  onWeighClick?: (order: Order) => void;
}

export const CourierOrderCard: React.FC<CourierOrderCardProps> = ({
  order,
  onUpdateClick,
  onArrivedClick,
  onPickupClick,
  onWeighClick,
}) => {
  const statusCfg = getStatusConfig(order.status);
  const isDelivery = order.assignmentType === 'delivery' || order.status === 'ready_for_delivery' || order.status === 'out_for_delivery';
  const isPickupTask = !isDelivery && (order.status === 'pending' || order.status === 'assigned' || order.status === 'picked_up');

  // Check arrival event in logs
  const hasArrivedAtLaundry = (order.logs || []).some(
    (l) => l.notes?.includes('courier_arrived') || l.notes?.includes('Tiba di Outlet') || l.notes?.includes('sampai di outlet')
  );

  const isPickedUpFromCustomer = order.status === 'picked_up';

  const handleCustomerQuickAction = () => {
    alert('Navigasi ke Customer akan segera tersedia.');
  };

  const handleLaundryQuickAction = () => {
    alert('Navigasi ke Laundry akan segera tersedia.');
  };

  const handleWhatsAppQuickAction = () => {
    alert('WhatsApp Customer akan segera tersedia.');
  };

  return (
    <Card variant="white" className="hover:shadow-lg transition-shadow border-slate-200 space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <span className="text-xs font-bold text-slate-400">Resi Order:</span>
          <p className="text-sm font-black text-slate-900">{order.trackingNumber}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={isDelivery ? 'purple' : 'amber'}>
            {isDelivery ? 'DELIVERY' : 'PICKUP'}
          </Badge>
          <Badge variant={isPickedUpFromCustomer ? (hasArrivedAtLaundry ? 'blue' : 'emerald') : 'emerald'}>
            {isPickupTask
              ? !isPickedUpFromCustomer
                ? 'Menuju Customer'
                : !hasArrivedAtLaundry
                ? 'Menuju Outlet'
                : 'Di Outlet Laundry'
              : statusCfg.label}
          </Badge>
        </div>
      </div>

      {/* Authorized Customer & Route Details (Compact inline icon buttons embedded on the right) */}
      <div className="space-y-3 text-xs">
        {!isDelivery ? (
          <>
            {/* Customer Address Row (Pickup Task) */}
            <div className="flex items-start justify-between gap-3 min-w-0 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800">Asal (Customer):</p>
                  <p className="text-slate-700 font-semibold truncate">{order.customerName}</p>
                  <p className="text-slate-600 leading-snug break-words">{order.pickupAddress}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCustomerQuickAction}
                className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-teal-700 flex items-center justify-center shrink-0 shadow-2xs transition-colors cursor-pointer active:scale-95"
                title="Navigasi ke Customer"
              >
                <Compass className="w-4 h-4 text-teal-600" />
              </button>
            </div>

            {/* Laundry Outlet Row (Pickup Task) */}
            <div className="flex items-start justify-between gap-3 min-w-0 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <Store className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800">Tujuan (Outlet Laundry):</p>
                  <p className="text-slate-600 font-medium break-words">{order.laundryName || 'FreshWash Partner Outlet'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLaundryQuickAction}
                className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs transition-colors cursor-pointer active:scale-95"
                title="Navigasi ke Laundry"
              >
                <Navigation className="w-4 h-4 text-amber-600" />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Laundry Outlet Row (Delivery Task) */}
            <div className="flex items-start justify-between gap-3 min-w-0 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <Store className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800">Asal (Outlet Laundry):</p>
                  <p className="text-slate-600 font-medium break-words">{order.laundryName || 'FreshWash Partner Outlet'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLaundryQuickAction}
                className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-teal-700 flex items-center justify-center shrink-0 shadow-2xs transition-colors cursor-pointer active:scale-95"
                title="Navigasi ke Laundry"
              >
                <Navigation className="w-4 h-4 text-teal-600" />
              </button>
            </div>

            {/* Customer Address Row (Delivery Task) */}
            <div className="flex items-start justify-between gap-3 min-w-0 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <MapPin className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800">Tujuan (Customer):</p>
                  <p className="text-slate-700 font-semibold truncate">{order.customerName}</p>
                  <p className="text-slate-600 leading-snug break-words">{order.deliveryAddress || order.pickupAddress}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCustomerQuickAction}
                className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs transition-colors cursor-pointer active:scale-95"
                title="Navigasi ke Customer"
              >
                <Compass className="w-4 h-4 text-purple-600" />
              </button>
            </div>
          </>
        )}

        {/* Schedule & Customer Phone Row */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 min-w-0">
          <div className="flex items-center justify-between text-slate-700">
            <span className="flex items-center gap-1 font-semibold text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Jadwal {isDelivery ? 'Delivery' : 'Pickup'}:
            </span>
            <span className="font-bold text-slate-900">
              {isDelivery ? (order.deliveryDate || order.pickupDate) : order.pickupDate}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-700">
            <span className="flex items-center gap-1 font-semibold text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Slot Waktu:
            </span>
            <span className="font-bold text-slate-900">
              {isDelivery ? (order.deliveryTimeSlot || '15:00 - 17:00 WIB') : order.pickupTimeSlot}
            </span>
          </div>

          {/* Customer Phone Row with Embedded WhatsApp Icon Button */}
          <div className="flex items-center justify-between text-slate-700 pt-1.5 border-t border-slate-200/60 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="flex items-center gap-1 text-slate-500 shrink-0">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Telepon:
              </span>
              <span className="font-semibold text-slate-800 truncate">{order.customerPhone || '0812xxxx'}</span>
            </div>
            <button
              type="button"
              onClick={handleWhatsAppQuickAction}
              className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs transition-colors cursor-pointer active:scale-95 ml-2"
              title="WhatsApp Customer"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
            </button>
          </div>
        </div>

        {/* Operational Progress Status */}
        {isPickupTask && (
          <div className="p-3 rounded-2xl border text-xs space-y-1.5 bg-amber-50/50 border-amber-200/60">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Status Pickup Customer:</span>
              <span className={isPickedUpFromCustomer ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>
                {isPickedUpFromCustomer ? '✓ Sudah Di-pickup' : '🚴 Menuju Customer'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Berat Timbangan Digital:</span>
              <span className="font-bold text-slate-900">
                {order.finalWeightKg ? `${order.finalWeightKg} kg` : `Estimasi ${order.estimatedWeightKg || 5} kg`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Status Antar ke Outlet:</span>
              <span className={hasArrivedAtLaundry ? 'font-bold text-emerald-700' : 'font-bold text-slate-600 italic'}>
                {hasArrivedAtLaundry ? '📍 Sudah Tiba di Outlet' : isPickedUpFromCustomer ? '🚚 Dalam Perjalanan ke Outlet' : 'Belum'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Primary Action Buttons Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <Link href={`/orders/${order.id}`} className="text-xs font-bold text-slate-600 hover:text-teal-600 flex items-center gap-1">
          Detail <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        <div className="flex items-center gap-1.5">
          {isPickupTask && onWeighClick && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onWeighClick(order)}
              className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold"
            >
              ⚖️ {order.finalWeightKg ? `${order.finalWeightKg} kg` : 'Input Berat'}
            </Button>
          )}

          {isPickupTask ? (
            !isPickedUpFromCustomer ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => onPickupClick && onPickupClick(order)}
                className="bg-teal-600 hover:bg-teal-500 font-bold"
              >
                Pickup dari Customer
              </Button>
            ) : !hasArrivedAtLaundry ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => onArrivedClick && onArrivedClick(order)}
                className="bg-emerald-600 hover:bg-emerald-500 font-bold"
              >
                Tiba di Outlet Laundry
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled className="text-slate-600 border-slate-300 font-bold opacity-80 cursor-not-allowed">
                Menunggu Verifikasi Laundry
              </Button>
            )
          ) : (
            <Button size="sm" variant="primary" onClick={() => onUpdateClick(order)} className="bg-purple-600 hover:bg-purple-500 font-bold">
              Update Status Delivery
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
