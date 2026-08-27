import React from 'react';
import Link from 'next/link';
import { Order } from '@/types/order';
import { formatIDR } from '@/utils/formatters';
import { getStatusConfig } from '@/utils/helpers';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { MapPin, Phone, Clock, ArrowRight, Store, Truck, CheckCircle2, Calendar } from 'lucide-react';

interface TaskCardProps {
  order: Order;
  onUpdateClick: (order: Order) => void;
  onAcceptClick?: (order: Order) => void;
  onArrivedClick?: (order: Order) => void;
  onPickupClick?: (order: Order) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  order,
  onUpdateClick,
  onAcceptClick,
  onArrivedClick,
  onPickupClick,
}) => {
  const statusCfg = getStatusConfig(order.status);
  const isOffered = order.assignmentStatus === 'offered';
  const isDelivery = order.assignmentType === 'delivery' || order.status === 'ready_for_delivery' || order.status === 'out_for_delivery';
  const isPickupTask = !isDelivery && (order.status === 'pending' || order.status === 'assigned' || order.status === 'picked_up');

  // Check arrival event in logs
  const hasArrivedAtLaundry = (order.logs || []).some(
    (l) => l.notes?.includes('courier_arrived') || l.notes?.includes('Tiba di Outlet') || l.notes?.includes('sampai di outlet')
  );

  const isPickedUpFromCustomer = order.status === 'picked_up';

  return (
    <Card variant="white" className="hover:shadow-xl transition-shadow border-slate-200 space-y-4">
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
          <Badge variant={isOffered ? 'amber' : isPickedUpFromCustomer ? (hasArrivedAtLaundry ? 'blue' : 'emerald') : 'emerald'}>
            {isOffered
              ? `Penawaran ${isDelivery ? 'Pengantaran' : 'Penjemputan'}`
              : isPickupTask
              ? !isPickedUpFromCustomer
                ? 'Menuju Customer'
                : !hasArrivedAtLaundry
                ? 'Menuju Outlet'
                : 'Di Outlet Laundry'
              : statusCfg.label}
          </Badge>
        </div>
      </div>

      {/* Main Details */}
      <div className="space-y-3 text-xs">
        {/* Routing Origin & Destination */}
        {!isDelivery ? (
          <>
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Asal (Customer):</p>
                <p className="text-slate-700 font-semibold">{order.customerName}</p>
                <p className="text-slate-600 leading-snug">{order.pickupAddress}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Store className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Tujuan (Outlet Laundry):</p>
                <p className="text-slate-600 font-medium">{order.laundryName || 'FreshWash Partner Outlet'}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2.5">
              <Store className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Asal (Outlet Laundry):</p>
                <p className="text-slate-600 font-medium">{order.laundryName || 'FreshWash Partner Outlet'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800">Tujuan (Customer):</p>
                <p className="text-slate-700 font-semibold">{order.customerName}</p>
                <p className="text-slate-600 leading-snug">{order.deliveryAddress || order.pickupAddress}</p>
              </div>
            </div>
          </>
        )}

        {/* Schedule & Phone */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
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
          <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
            <span className="flex items-center gap-1 text-slate-500">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              Telepon:
            </span>
            <span className="font-semibold text-slate-800">{order.customerPhone || '0812xxxx'}</span>
          </div>
        </div>

        {/* Operational Progress Status for Pickup Tasks */}
        {isPickupTask && (
          <div className="p-3 rounded-2xl border text-xs space-y-1.5 bg-amber-50/50 border-amber-200/60">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 font-medium">Status Pickup Customer:</span>
              <span className={isPickedUpFromCustomer ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>
                {isPickedUpFromCustomer ? '✓ Sudah Di-pickup' : '🚴 Menuju Customer'}
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

      {/* Action Buttons Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <Link href={`/orders/${order.id}`} className="text-xs font-bold text-slate-600 hover:text-teal-600 flex items-center gap-1">
          Detail <ArrowRight className="w-3.5 h-3.5" />
        </Link>

        {isOffered && onAcceptClick ? (
          <Button
            size="sm"
            variant="primary"
            onClick={() => onAcceptClick(order)}
            className={isDelivery ? 'bg-purple-600 hover:bg-purple-500 font-bold' : 'bg-amber-600 hover:bg-amber-500 font-bold'}
          >
            Terima Tugas {isDelivery ? 'Delivery' : 'Pickup'}
          </Button>
        ) : isPickupTask ? (
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
    </Card>
  );
};
