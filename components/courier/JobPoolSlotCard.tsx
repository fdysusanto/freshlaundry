'use client';

import React from 'react';
import { JobPoolSlotMetadata } from '@/services/courierJobPoolService';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Clock, Lock, CheckCircle2, Package, AlertCircle } from 'lucide-react';

interface JobPoolSlotCardProps {
  slot: JobPoolSlotMetadata;
  onClaim: (jobType: 'pickup' | 'delivery', timeSlot: string) => void;
  isClaiming?: boolean;
}

export const JobPoolSlotCard: React.FC<JobPoolSlotCardProps> = ({
  slot,
  onClaim,
  isClaiming = false,
}) => {
  const isPickup = slot.jobType === 'pickup';
  const hasAvailableOrders = slot.availableOrders > 0;
  const isFullCapacity =
    (slot.remainingCapacity !== undefined && slot.remainingCapacity <= 0) || slot.claimStatus === 'full';

  // Format claimableAt time in WIB (HH:mm)
  const formatClaimableTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jakarta',
      });
    } catch {
      return '15 mnt sebelum slot';
    }
  };

  const claimableTimeStr = formatClaimableTime(slot.claimableAt);

  return (
    <Card
      variant="white"
      className={`border-slate-200 p-5 space-y-4 transition-all relative overflow-hidden ${
        hasAvailableOrders
          ? isPickup
            ? 'border-amber-300 ring-1 ring-amber-500/10 shadow-xs'
            : 'border-purple-300 ring-1 ring-purple-500/10 shadow-xs'
          : 'bg-slate-50/60'
      }`}
    >
      {/* Header Badge & Slot Time */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <Badge variant={isPickup ? 'amber' : 'purple'} className="font-bold text-xs">
          {isPickup ? 'PICKUP SLOT' : 'DELIVERY SLOT'}
        </Badge>
        <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{slot.timeSlot}</span>
        </div>
      </div>

      {/* Available Orders & Capacity Info — ALWAYS VISIBLE INDEPENDENT OF CLAIM STATUS */}
      <div className="space-y-2 py-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Order Tersedia di Pool:</span>
          {hasAvailableOrders ? (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border ${
                isPickup
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'bg-purple-50 text-purple-900 border-purple-200'
              }`}
            >
              <Package className={`w-4 h-4 ${isPickup ? 'text-amber-600' : 'text-purple-600'}`} />
              <span>{slot.availableOrders} ORDER TERSEDIA</span>
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-400 italic">
              Tidak ada order tersedia
            </span>
          )}
        </div>

        <div className="p-2.5 rounded-xl bg-slate-100/80 border border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
          <span className="font-medium">Kapasitas Maksimal:</span>
          <span className="font-bold text-slate-800">Maks {slot.maxCapacityPerCourier} Order / Kurir</span>
        </div>
      </div>

      {/* Claim Availability Action Footer */}
      <div className="pt-2 border-t border-slate-100">
        {isFullCapacity ? (
          <Button
            size="md"
            variant="outline"
            disabled
            className="w-full py-2.5 font-bold text-xs bg-slate-100 text-slate-500 border-slate-300 cursor-not-allowed flex items-center justify-center gap-1.5 font-semibold"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            KAPASITAS PENUH (MAKSIMAL 5 ORDER)
          </Button>
        ) : slot.claimStatus === 'locked' ? (
          <div className="space-y-1.5 text-center">
            <Button
              size="md"
              variant="outline"
              disabled
              className="w-full py-2.5 font-bold text-xs bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              BELUM DIBUKA
            </Button>
            <p className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" />
              Klaim dibuka pukul <strong className="text-slate-800">{claimableTimeStr} WIB</strong> (15 mnt sebelum slot)
            </p>
          </div>
        ) : !hasAvailableOrders || slot.claimStatus === 'empty' ? (
          <Button
            size="md"
            variant="outline"
            disabled
            className="w-full py-2.5 font-bold text-xs bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            TIDAK ADA ORDER
          </Button>
        ) : (
          <Button
            size="md"
            variant="primary"
            disabled={isClaiming}
            onClick={() => onClaim(slot.jobType, slot.timeSlot)}
            className={`w-full py-2.5 font-bold text-xs shadow-md transition-all cursor-pointer ${
              isPickup
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
            }`}
          >
            {isClaiming ? 'MENGAMBIL JOB...' : 'AMBIL JOB'}
          </Button>
        )}
      </div>
    </Card>
  );
};
