'use client';

import React, { useMemo } from 'react';
import { Scale, Package, Sparkles, Truck, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Order } from '@/types/order';

interface OwnerActionCenterProps {
  orders: Order[];
  onNavigateToOrders: (statusFilter: string, isWeightVerificationOnly?: boolean) => void;
}

export const OwnerActionCenter: React.FC<OwnerActionCenterProps> = ({
  orders,
  onNavigateToOrders,
}) => {
  const actionData = useMemo(() => {
    // 1. Perlu Verifikasi Berat: picked_up AND !weightFinalizedAt
    const weightVerificationOrders = orders.filter(
      (o) => o.status === 'picked_up' && !o.weightFinalizedAt && !o.finalWeightKg
    );

    // 2. Siap Dicuci: picked_up AND (weightFinalizedAt OR finalWeightKg)
    const readyToWashOrders = orders.filter(
      (o) => o.status === 'picked_up' && (Boolean(o.weightFinalizedAt) || Boolean(o.finalWeightKg))
    );

    // 3. Siap Diantar: ready_for_delivery
    const readyForDeliveryOrders = orders.filter((o) => o.status === 'ready_for_delivery');

    // 4. Sedang Dicuci: in_washing
    const washingOrders = orders.filter((o) => o.status === 'in_washing');

    return {
      weightVerificationCount: weightVerificationOrders.length,
      readyToWashCount: readyToWashOrders.length,
      readyForDeliveryCount: readyForDeliveryOrders.length,
      washingCount: washingOrders.length,
      totalActionNeeded:
        weightVerificationOrders.length +
        readyToWashOrders.length +
        readyForDeliveryOrders.length +
        washingOrders.length,
    };
  }, [orders]);

  const cards = [
    {
      id: 'weight_verification',
      title: 'Perlu Verifikasi Berat',
      count: actionData.weightVerificationCount,
      icon: Scale,
      color: 'amber',
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
      cardBg: 'bg-amber-50/40 border-amber-200 hover:border-amber-300',
      iconBg: 'bg-amber-100 text-amber-700',
      description: 'Pesanan dijemput & menunggu verifikasi berat.',
      onClick: () => onNavigateToOrders('picked_up', true),
    },
    {
      id: 'ready_to_wash',
      title: 'Siap Dicuci',
      count: actionData.readyToWashCount,
      icon: Package,
      color: 'emerald',
      badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      cardBg: 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300',
      iconBg: 'bg-emerald-100 text-emerald-700',
      description: 'Berat diverifikasi, siap masuk proses cuci.',
      onClick: () => onNavigateToOrders('picked_up', false),
    },
    {
      id: 'ready_for_delivery',
      title: 'Siap Diantar',
      count: actionData.readyForDeliveryCount,
      icon: Truck,
      color: 'purple',
      badgeBg: 'bg-purple-100 text-purple-900 border-purple-300',
      cardBg: 'bg-purple-50/40 border-purple-200 hover:border-purple-300',
      iconBg: 'bg-purple-100 text-purple-700',
      description: 'Pencucian selesai & siap diantar kurir.',
      onClick: () => onNavigateToOrders('ready_for_delivery', false),
    },
    {
      id: 'in_washing',
      title: 'Sedang Dicuci',
      count: actionData.washingCount,
      icon: Sparkles,
      color: 'teal',
      badgeBg: 'bg-teal-100 text-teal-900 border-teal-300',
      cardBg: 'bg-teal-50/40 border-teal-200 hover:border-teal-300',
      iconBg: 'bg-teal-100 text-teal-700',
      description: 'Pesanan sedang dalam proses laundry.',
      onClick: () => onNavigateToOrders('in_washing', false),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
          <span>🔥 Operational Action Center</span>
          {actionData.totalActionNeeded > 0 && (
            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
              {actionData.totalActionNeeded} Tugas
            </span>
          )}
        </h3>
        <span className="text-xs text-slate-500 font-semibold">Tindakan Langsung Hari Ini</span>
      </div>

      {/* Empty State when no actions needed */}
      {actionData.totalActionNeeded === 0 ? (
        <Card variant="white" className="p-6 text-center space-y-2 border-emerald-200 bg-emerald-50/30">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h4 className="text-sm font-bold text-slate-900">✨ Semua Pesanan Terkendali</h4>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Tidak ada pekerjaan operasional yang membutuhkan tindakan langsung saat ini. Seluruh pesanan telah diproses dengan lancar.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {cards.map((card) => {
            const Icon = card.icon;
            const hasItems = card.count > 0;

            return (
              <div
                key={card.id}
                onClick={card.onClick}
                className={`p-4 rounded-3xl border transition-all cursor-pointer space-y-3 relative group ${
                  hasItems ? card.cardBg : 'bg-white border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-2xl ${card.iconBg} shadow-xs`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${card.badgeBg}`}>
                    {card.count} Pesanan
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-teal-800 transition-colors">
                    {card.title}
                  </h4>
                  <p className="text-[11px] text-slate-600 font-medium leading-snug">{card.description}</p>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-slate-700 group-hover:text-teal-700">
                  <span>Lihat Pesanan</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
