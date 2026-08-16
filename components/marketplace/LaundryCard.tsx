'use client';

import React from 'react';
import Link from 'next/link';
import { ExtendedLaundry } from '@/utils/constants';
import { formatIDR } from '@/utils/formatters';
import { Badge } from '@/components/ui/Badge';
import { Star, MapPin, Clock, ArrowRight, ShieldCheck } from 'lucide-react';

interface LaundryCardProps {
  laundry: ExtendedLaundry;
}

export const LaundryCard: React.FC<LaundryCardProps> = ({ laundry }) => {
  const getBadgeVariant = (badge?: string) => {
    switch (badge) {
      case 'Recommended':
        return 'teal';
      case 'Fast Pickup':
        return 'amber';
      case 'Premium':
        return 'purple';
      case 'Promo':
        return 'emerald';
      case 'Buka 24 Jam':
        return 'blue';
      default:
        return 'gray';
    }
  };

  return (
    <Link href={`/customer/laundries/${laundry.id}`} className="block group">
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-xl hover:border-teal-400 transition-all duration-300 relative flex flex-col justify-between h-full overflow-hidden">
        {/* Top Header Badge & Operating Status */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              {laundry.badge && (
                <Badge variant={getBadgeVariant(laundry.badge)} size="sm">
                  {laundry.badge}
                </Badge>
              )}
              {laundry.verificationStatus === 'verified' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  Terverifikasi
                </span>
              )}
            </div>

            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                laundry.isOpen
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {laundry.isOpen ? '• Buka' : '• Tutup'}
            </span>
          </div>

          {/* Laundry Avatar & Title */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform">
              {laundry.name.charAt(0)}
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1">
                {laundry.name}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{laundry.address}</span>
              </p>
            </div>
          </div>

          {/* Metrics Row: Rating, Distance, Est Pickup */}
          <div className="grid grid-cols-3 gap-2 py-3 px-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-semibold mb-4">
            <div className="text-center border-r border-slate-200/80 pr-1">
              <div className="flex items-center justify-center gap-1 text-amber-600 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{laundry.rating.toFixed(1)}</span>
              </div>
              <span className="text-[10px] text-slate-400 block font-normal">
                {laundry.totalReviews} Ulasan
              </span>
            </div>

            <div className="text-center border-r border-slate-200/80 px-1">
              <span className="text-slate-800 font-bold">{laundry.distanceKm} km</span>
              <span className="text-[10px] text-slate-400 block font-normal">Jarak Pickup</span>
            </div>

            <div className="text-center pl-1">
              <span className="text-teal-700 font-bold">~{laundry.estPickupMinutes} mnt</span>
              <span className="text-[10px] text-slate-400 block font-normal">Jemput Kurir</span>
            </div>
          </div>
        </div>

        {/* Bottom Footer Price & Action */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Mulai Dari
            </span>
            <span className="text-base font-black text-teal-700">
              {formatIDR(laundry.startingPrice)}
              <span className="text-xs font-normal text-slate-500"> / kg</span>
            </span>
          </div>

          <div className="w-9 h-9 rounded-xl bg-teal-50 group-hover:bg-teal-600 text-teal-700 group-hover:text-white flex items-center justify-center transition-all">
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
};
