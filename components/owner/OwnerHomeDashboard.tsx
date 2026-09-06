'use client';

import React from 'react';
import { UserProfile } from '@/types/user';
import { Laundry } from '@/types/laundry';
import { Order } from '@/types/order';
import { OwnerPayoutCard } from './OwnerPayoutCard';
import { OwnerActionCenter } from './OwnerActionCenter';
import { OwnerBusinessSummary } from './OwnerBusinessSummary';
import { RecentOrders } from './RecentOrders';

interface OwnerHomeDashboardProps {
  currentUser: UserProfile | null;
  selectedLaundry: Laundry | null;
  laundryOrders: Order[];
  metrics: {
    totalOrders: number;
    completedOrdersCount: number;
    activeOrdersCount: number;
    pendingActionCount: number;
    totalRevenue: number;
  };
  onNavigateToOrders: (statusFilter?: string, isWeightVerificationOnly?: boolean) => void;
}

export const OwnerHomeDashboard: React.FC<OwnerHomeDashboardProps> = ({
  currentUser,
  selectedLaundry,
  laundryOrders,
  metrics,
  onNavigateToOrders,
}) => {
  return (
    <div className="space-y-6">
      {/* 1. GREETING HEADER */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Selamat Datang Kembali 👋
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Kelola operasional laundry <strong className="text-slate-800">{selectedLaundry?.name || 'FreshLaundry'}</strong> hari ini.
            </p>
          </div>
          <span className="self-start sm:self-auto text-xs font-extrabold px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
            Partner Portal
          </span>
        </div>
      </div>

      {/* 2. PAYOUT CARD */}
      <OwnerPayoutCard
        totalRevenue={metrics.totalRevenue}
        completedOrdersCount={metrics.completedOrdersCount}
        onViewDetails={() => onNavigateToOrders('delivered')}
      />

      {/* 3. OPERATIONAL ACTION CENTER */}
      <OwnerActionCenter
        orders={laundryOrders}
        onNavigateToOrders={(statusFilter, isWeightVerificationOnly) =>
          onNavigateToOrders(statusFilter, isWeightVerificationOnly)
        }
      />

      {/* 4. QUICK BUSINESS SUMMARY */}
      <OwnerBusinessSummary
        activeOrdersCount={metrics.activeOrdersCount}
        completedOrdersCount={metrics.completedOrdersCount}
        rating={selectedLaundry?.rating || 5.0}
        totalReviews={selectedLaundry?.totalReviews || 0}
      />

      {/* 5. RECENT ORDERS SECTION */}
      <RecentOrders
        orders={laundryOrders}
        onViewAllOrders={() => onNavigateToOrders()}
      />
    </div>
  );
};
