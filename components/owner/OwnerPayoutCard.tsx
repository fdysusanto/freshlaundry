'use client';

import React from 'react';
import Link from 'next/link';
import { Wallet, TrendingUp, Info, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatIDR } from '@/utils/formatters';

interface OwnerPayoutCardProps {
  totalRevenue: number;
  completedOrdersCount: number;
  onViewDetails?: () => void;
}

export const OwnerPayoutCard: React.FC<OwnerPayoutCardProps> = ({
  totalRevenue,
  completedOrdersCount,
  onViewDetails,
}) => {
  return (
    <Card variant="white" className="p-5 sm:p-6 border-slate-200/80 bg-gradient-to-br from-brand-primary via-slate-900 to-brand-secondary text-white shadow-xl rounded-3xl relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-brand-secondary/10 rounded-full blur-2xl pointer-events-none" />

      <div className="space-y-4 relative z-10">
        {/* Header Label */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand-primary/20 text-brand-secondary border border-brand-secondary/20">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Pendapatan Laundry</h3>
              <p className="text-[11px] text-slate-400 font-medium">Berdasarkan pesanan selesai</p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-brand-primary/20 text-brand-secondary border border-brand-secondary/30">
            Bruto Selesai
          </span>
        </div>

        {/* Amount Display */}
        <div className="space-y-1">
          <div className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {formatIDR(totalRevenue)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Akumulasi dari <strong>{completedOrdersCount} pesanan selesai</strong></span>
          </div>
        </div>

        {/* Honesty Banner: Revenue vs Withdrawable Payout */}
        <div className="p-3 rounded-2xl bg-white/10 border border-white/10 text-[11px] text-slate-300 space-y-1 backdrop-blur-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Catatan Pencairan (Payout):</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            Angka ini mencerminkan total pendapatan bruto pesanan berstatus selesai. Pencairan otomatis ke rekening mitra diselesaikan secara berkala oleh Admin Platform.
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-1 flex items-center justify-between border-t border-slate-700/60">
          <span className="text-[11px] font-semibold text-slate-400">Rincian Finansial Pesanan</span>
          {onViewDetails ? (
            <button
              onClick={onViewDetails}
              className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-secondary hover:text-brand-secondary/80 transition-colors cursor-pointer"
            >
              Lihat Detail Pesanan <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <Link
              href="/owner?tab=orders"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-secondary hover:text-brand-secondary/80 transition-colors"
            >
              Lihat Detail Pesanan <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
};
