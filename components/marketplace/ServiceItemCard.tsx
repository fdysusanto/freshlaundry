'use client';

import React from 'react';
import { ServiceCatalogItem } from '@/utils/constants';
import { formatIDR } from '@/utils/formatters';
import { Check, Plus, Minus, Clock, Sparkles } from 'lucide-react';

interface ServiceItemCardProps {
  service: ServiceCatalogItem;
  isSelected: boolean;
  quantity: number;
  onToggleSelect: () => void;
  onQuantityChange: (newQty: number) => void;
}

export const ServiceItemCard: React.FC<ServiceItemCardProps> = ({
  service,
  isSelected,
  quantity,
  onToggleSelect,
  onQuantityChange,
}) => {
  const itemSubtotal = service.price * quantity;

  return (
    <div
      className={`p-5 rounded-3xl border transition-all duration-200 relative ${
        isSelected
          ? 'border-teal-500 bg-teal-50/40 ring-2 ring-teal-500/20 shadow-md'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        {/* Left Service Info */}
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-base text-slate-900">{service.name}</h4>
            {service.badge && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                {service.badge}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 leading-relaxed max-w-xl">{service.description}</p>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 pt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span>Est. {service.estimatedTime || `${service.estimatedHours} Jam`}</span>
            </span>
            <span>•</span>
            <span>Min. Order: {service.minOrder || `1 ${service.unit}`}</span>
          </div>
        </div>

        {/* Right Price & Select Button */}
        <div className="text-left sm:text-right shrink-0 flex flex-col justify-between space-y-3">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Tarif Layanan
            </span>
            <p className="text-lg font-black text-teal-700">
              {formatIDR(service.price)}
              <span className="text-xs font-semibold text-slate-500"> / {service.unit}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleSelect}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isSelected
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700'
            }`}
          >
            {isSelected ? (
              <>
                <Check className="w-4 h-4" />
                <span>Dipilih</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Pilih Layanan</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quantity / Weight Configurator (Visible if Selected) */}
      {isSelected && (
        <div className="mt-4 pt-4 border-t border-teal-200/60 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 p-4 rounded-2xl border border-teal-100">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700">
              Estimasi Jumlah ({service.unit === 'kg' ? 'Kiloan' : 'Jumlah Pcs'}):
            </span>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => onQuantityChange(Math.max(service.unit === 'kg' ? 3 : 1, quantity - 1))}
                className="w-7 h-7 rounded-lg bg-white shadow-xs text-slate-700 font-bold flex items-center justify-center hover:bg-slate-50 disabled:opacity-50"
                disabled={quantity <= (service.unit === 'kg' ? 3 : 1)}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-12 text-center text-xs font-black text-teal-800">
                {quantity} {service.unit}
              </span>
              <button
                type="button"
                onClick={() => onQuantityChange(quantity + 1)}
                className="w-7 h-7 rounded-lg bg-white shadow-xs text-slate-700 font-bold flex items-center justify-center hover:bg-slate-50"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="text-right flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Subtotal Layanan:</span>
            <span className="text-sm font-black text-teal-700 bg-teal-50 px-3 py-1 rounded-xl border border-teal-200">
              {formatIDR(itemSubtotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
