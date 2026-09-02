'use client';

import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getWibTodayDateString } from '@/services/courierJobPoolService';

interface CourierDateSelectorProps {
  selectedDate: string;
  onDateChange: (newDate: string) => void;
}

export const CourierDateSelector: React.FC<CourierDateSelectorProps> = ({
  selectedDate,
  onDateChange,
}) => {
  const todayWib = getWibTodayDateString();

  // Tomorrow WIB date calculation
  const todayMs = new Date(`${todayWib}T00:00:00+07:00`).getTime();
  const tomorrowMs = todayMs + 24 * 60 * 60 * 1000;
  const tomorrowWib = new Date(tomorrowMs).toISOString().split('T')[0];

  const isToday = selectedDate === todayWib;

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = new Date(`${dateStr}T00:00:00+07:00`);
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
        <Calendar className="w-4 h-4 text-amber-600" />
        <span>Jadwal Operasional Job Pool (WIB):</span>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <button
          type="button"
          onClick={() => onDateChange(todayWib)}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            isToday
              ? 'bg-amber-600 text-white shadow-xs shadow-amber-600/30 ring-2 ring-amber-500/20'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          }`}
        >
          HARI INI
        </button>

        <button
          type="button"
          onClick={() => onDateChange(tomorrowWib)}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            !isToday
              ? 'bg-amber-600 text-white shadow-xs shadow-amber-600/30 ring-2 ring-amber-500/20'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          }`}
        >
          BESOK
        </button>
      </div>

      <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60">
        {formatDateLabel(selectedDate)}
      </div>
    </div>
  );
};
