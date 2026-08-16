import React from 'react';
import Link from 'next/link';
import { Order } from '@/types/order';
import { formatIDR, formatDateTimeIndo } from '@/utils/formatters';
import { getStatusConfig } from '@/utils/helpers';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { MapPin, Phone, Clock, ArrowRight } from 'lucide-react';

interface TaskCardProps {
  order: Order;
  onUpdateClick: (order: Order) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ order, onUpdateClick }) => {
  const statusCfg = getStatusConfig(order.status);

  return (
    <Card variant="white" className="hover:shadow-xl transition-shadow border-slate-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <span className="text-xs font-bold text-slate-400">Resi:</span>
          <p className="text-sm font-black text-slate-900">{order.trackingNumber}</p>
        </div>
        <Badge variant={statusCfg.stepIndex >= 6 ? 'emerald' : statusCfg.stepIndex >= 3 ? 'blue' : 'amber'}>
          {statusCfg.label}
        </Badge>
      </div>

      <div className="py-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-slate-800">{order.customerName}</p>
            <p className="text-slate-600 leading-snug">{order.pickupAddress}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100/80">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>{order.customerPhone}</span>
          </div>
          <div className="flex items-center gap-1 text-slate-600">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{order.pickupTimeSlot}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl">
          <span className="font-semibold text-slate-700">{order.serviceName}</span>
          <span className="font-bold text-teal-700">{formatIDR(order.totalPrice)}</span>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <Link
          href={`/orders/${order.id}`}
          className="text-xs font-bold text-slate-600 hover:text-teal-600 flex items-center gap-1"
        >
          Detail <ArrowRight className="w-3.5 h-3.5" />
        </Link>
        <Button size="sm" variant="primary" onClick={() => onUpdateClick(order)}>
          Update Status
        </Button>
      </div>
    </Card>
  );
};
