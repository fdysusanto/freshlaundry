'use client';

import React from 'react';
import { Package, CheckCircle2, Star } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface OwnerBusinessSummaryProps {
  activeOrdersCount: number;
  completedOrdersCount: number;
  rating: number;
  totalReviews: number;
}

export const OwnerBusinessSummary: React.FC<OwnerBusinessSummaryProps> = ({
  activeOrdersCount,
  completedOrdersCount,
  rating,
  totalReviews,
}) => {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-black text-slate-900">Ringkasan Hari Ini</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Pesanan Aktif */}
        <Card variant="white" className="p-4 border-blue-100 bg-blue-50/30 space-y-1">
          <div className="flex items-center justify-between text-blue-800">
            <span className="text-xs font-bold">Pesanan Aktif</span>
            <Package className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-900">{activeOrdersCount}</p>
          <p className="text-[11px] text-blue-700 font-medium">Dalam proses &amp; antar</p>
        </Card>

        {/* Card 2: Pesanan Selesai */}
        <Card variant="white" className="p-4 border-emerald-100 bg-emerald-50/30 space-y-1">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-bold">Pesanan Selesai</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-900">{completedOrdersCount}</p>
          <p className="text-[11px] text-emerald-700 font-medium">Berhasil terkirim</p>
        </Card>

        {/* Card 3: Rating Mitra */}
        <Card variant="white" className="p-4 border-purple-100 bg-purple-50/30 space-y-1">
          <div className="flex items-center justify-between text-purple-800">
            <span className="text-xs font-bold">Rating Mitra</span>
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-purple-900">★ {rating.toFixed(1)}</p>
          <p className="text-[11px] text-purple-700 font-medium">{totalReviews} ulasan customer</p>
        </Card>
      </div>
    </div>
  );
};
