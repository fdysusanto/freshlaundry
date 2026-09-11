'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useOwnerBranch } from './OwnerBranchContext';
import { Store, ChevronDown, Check, Plus, MapPin, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const OwnerBranchSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { ownedLaundries, activeLaundry, activeLaundryId, setActiveLaundryId, isLoading } = useOwnerBranch();
  const [isOpen, setIsOpen] = useState(false);
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

          {/* Placeholder CTA for Add Branch */}
          <div className="p-2 border-t border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowAddBranchModal(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-brand-primary text-slate-600 hover:text-brand-primary text-xs font-bold transition-all cursor-pointer bg-white"
            >
              <Plus className="w-4 h-4 text-brand-primary" />
              <span>+ Tambah Cabang Laundry</span>
            </button>
          </div>
        </div>
      )}

      {/* Add Branch Information Modal Placeholder */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-surface text-brand-primary flex items-center justify-center font-bold shrink-0 border border-brand-primary/20">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-tight">Pengajuan Cabang Laundry Baru</h3>
                  <p className="text-xs text-slate-500 font-medium">Informasi Ekspansi Mitra CUCIYAN</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBranchModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 font-medium leading-relaxed">
              <div className="p-3.5 bg-amber-50 border border-amber-200/70 rounded-2xl text-amber-900 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="font-semibold">
                  Fitur pengajuan cabang laundry baru akan tersedia secara bertahap pada pembaharuan sistem berikutnya.
                </span>
              </div>
              <p>
                Setiap penambahan cabang usaha baru nantinya wajib melalui proses pengajuan dan verifikasi persetujuan otorisasi oleh <strong>Admin CUCIYAN</strong> sebelum cabang terdaftar dapat menerima pesanan di marketplace.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddBranchModal(false)}
                className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold cursor-pointer"
              >
                Mengerti
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

