'use client';

import React, { Suspense } from 'react';
import { OwnerBranchProvider } from '@/components/owner/OwnerBranchContext';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Memuat data cabang laundry...</div>}>
      <OwnerBranchProvider>
        {children}
      </OwnerBranchProvider>
    </Suspense>
  );
}
