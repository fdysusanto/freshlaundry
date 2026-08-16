import React from 'react';
import { Order } from '@/types/order';
import { formatIDR } from '@/utils/formatters';
import { Card } from '../ui/Card';
import { ShoppingBag, DollarSign, Clock, Users } from 'lucide-react';

interface MetricsOverviewProps {
  orders: Order[];
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ orders }) => {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalPrice, 0);
  const activeInProcess = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  ).length;
  const pendingAssignment = orders.filter((o) => o.status === 'pending').length;
  const activeCouriersCount = new Set(orders.map((o) => o.courierId).filter(Boolean)).size;

  const metrics = [
    {
      label: 'Total Pesanan Masuk',
      value: totalOrders.toString(),
      subtext: `${pendingAssignment} belum dapat kurir`,
      icon: ShoppingBag,
      color: 'bg-teal-50 text-teal-600',
    },
    {
      label: 'Total Estimasi Omset',
      value: formatIDR(totalRevenue),
      subtext: 'Seluruh pesanan',
      icon: DollarSign,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Pesanan Sedang Berjalan',
      value: activeInProcess.toString(),
      subtext: 'Proses pickup, cuci & delivery',
      icon: Clock,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Kurir Aktif Bertugas',
      value: `${activeCouriersCount} Driver`,
      subtext: activeCouriersCount > 0 ? 'Armada kurir terdaftar' : 'Belum ada kurir bertugas',
      icon: Users,
      color: 'bg-purple-50 text-purple-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {metrics.map((m, i) => {
        const Icon = m.icon;
        return (
          <Card key={i} variant="white" className="border-slate-200/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {m.label}
              </span>
              <div className={`w-9 h-9 rounded-xl ${m.color} flex items-center justify-center font-bold`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{m.value}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">{m.subtext}</p>
          </Card>
        );
      })}
    </div>
  );
};
