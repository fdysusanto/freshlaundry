'use client';

import React from 'react';

export const LaundryCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3 animate-pulse shadow-xs h-full">
      <div className="w-full aspect-[4/3] bg-slate-200 rounded-2xl" />
      <div className="space-y-2">
        <div className="h-4 bg-slate-200 rounded-md w-3/4" />
        <div className="h-3 bg-slate-200 rounded-md w-1/2" />
        <div className="h-3 bg-slate-100 rounded-md w-1/3" />
      </div>
      <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
        <div className="h-5 bg-slate-200 rounded-md w-24" />
        <div className="h-5 bg-slate-200 rounded-md w-12" />
      </div>
    </div>
  );
};

export const MarketplaceSectionSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1">
        <div className="h-4 bg-slate-200 rounded-md w-32 animate-pulse" />
        <div className="h-6 bg-slate-200 rounded-md w-64 animate-pulse" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-[80%] sm:w-[45%] md:w-[30%] lg:w-[23%] shrink-0">
            <LaundryCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
};
