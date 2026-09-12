'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnerBranch } from './OwnerBranchContext';
import { Store, ChevronDown, Check, Plus, MapPin, Sparkles } from 'lucide-react';

export const OwnerBranchSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const router = useRouter();
  const { ownedLaundries, activeLaundry, activeLaundryId, setActiveLaundryId, isLoading, currentUser } = useOwnerBranch();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isStaffRole = currentUser?.role === 'laundry_staff';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 animate-pulse w-48 h-10 ${className}`}>
        <div className="w-5 h-5 rounded-full bg-slate-200" />
        <div className="h-4 bg-slate-200 rounded flex-1" />
      </div>
    );
  }

  if (!ownedLaundries.length || !activeLaundry) {
    return null;
  }

  // If staff role, show fixed branch pill badge without dropdown
  if (isStaffRole) {
    return (
      <div className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold bg-slate-50 border-slate-200 text-slate-800 shadow-2xs ${className}`}>
        <div className="w-7 h-7 rounded-lg bg-brand-surface text-brand-primary flex items-center justify-center shrink-0 border border-brand-primary/20">
          <Store className="w-4 h-4" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
            Outlet Staf
          </span>
          <span className="font-extrabold text-slate-900 truncate max-w-[150px] sm:max-w-[200px]">
            {activeLaundry.name}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button — Enabled for both single and multi branch owners */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs hover:border-brand-primary active:scale-[0.99] cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="w-7 h-7 rounded-lg bg-brand-surface text-brand-primary flex items-center justify-center shrink-0 border border-brand-primary/20">
          <Store className="w-4 h-4" />
        </div>

        <div className="flex flex-col text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
            Cabang Aktif
          </span>
          <span className="font-extrabold text-slate-900 truncate max-w-[150px] sm:max-w-[200px]">
            {activeLaundry.name}
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 shrink-0 ml-1 ${
            isOpen ? 'rotate-180 text-brand-primary' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Pilih Cabang Laundry ({ownedLaundries.length})
            </span>
            <Sparkles className="w-3.5 h-3.5 text-brand-primary" />
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
            {ownedLaundries.map((laundry) => {
              const isSelected = laundry.id === activeLaundryId;
              return (
                <button
                  key={laundry.id}
                  type="button"
                  onClick={() => {
                    setActiveLaundryId(laundry.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-start justify-between gap-3 p-3 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-brand-surface border border-brand-primary/30 text-brand-primary font-bold shadow-2xs'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${
                        isSelected
                          ? 'bg-brand-primary text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {laundry.code ? laundry.code.slice(0, 3).toUpperCase() : 'LND'}
                    </div>

                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate text-slate-900">
                        {laundry.name}
                      </div>
                      {laundry.address && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                          <span className="truncate">{laundry.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-brand-primary shrink-0 mt-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* CTA for Add Branch (Hidden for Staff) */}
          {!isStaffRole && (
            <div className="p-2 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push('/owner/branches/create');
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-brand-primary text-slate-600 hover:text-brand-primary text-xs font-bold transition-all cursor-pointer bg-white"
              >
                <Plus className="w-4 h-4 text-brand-primary" />
                <span>+ Tambah Cabang Laundry</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

