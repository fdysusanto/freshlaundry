'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { authService } from '@/services/authService';
import { supabase } from '@/services/supabase';
import { courierJobPoolService, CourierJobPoolResponse, getWibTodayDateString } from '@/services/courierJobPoolService';
import { UserProfile } from '@/types/user';
import { CourierDateSelector } from '@/components/courier/CourierDateSelector';
import { JobPoolSlotCard } from '@/components/courier/JobPoolSlotCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  ArrowLeft,
  RefreshCw,
  Package,
  Truck,
  CheckCircle2,
  ArrowRight,
  X,
  Layers,
  Clock,
  AlertCircle
} from 'lucide-react';

export default function CourierJobPoolPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getWibTodayDateString());
  const [jobPool, setJobPool] = useState<CourierJobPoolResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'pickup' | 'delivery'>('pickup');
  const [isLoadingPool, setIsLoadingPool] = useState<boolean>(true);
  const [claimingSlotKey, setClaimingSlotKey] = useState<string | null>(null);
  const [claimSuccessNotice, setClaimSuccessNotice] = useState<{
    text: string;
    count: number;
    jobType: 'pickup' | 'delivery';
    slotTime: string;
  } | null>(null);

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
  }, []);

  const loadJobPoolData = async (dateStr: string) => {
    setIsLoadingPool(true);
    try {
      let data: CourierJobPoolResponse | null = null;

      if (supabase && typeof window !== 'undefined') {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const res = await fetch(`/api/courier/job-pool?date=${dateStr}`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          const result = await res.json();
          if (res.ok && result.success && result.data) {
            data = result.data;
          }
        }
      }

      if (!data) {
        data = await courierJobPoolService.getCourierJobPoolAsync(dateStr, currentUser?.id);
      }

      setJobPool(data);
    } catch (err) {
      console.warn('[COURIER-JOB-POOL-LOAD-ERR]', err);
    } finally {
      setIsLoadingPool(false);
    }
  };

  useEffect(() => {
    loadJobPoolData(selectedDate);
  }, [selectedDate, currentUser?.id]);

  const handleClaimSlot = async (jobType: 'pickup' | 'delivery', timeSlot: string) => {
    if (!currentUser) return;
    const slotKey = `${jobType}_${timeSlot}`;
    setClaimingSlotKey(slotKey);
    setClaimSuccessNotice(null);

    try {
      const sessionRes = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
      const token = sessionRes?.data?.session?.access_token;

      const res = await fetch('/api/courier/claim-slot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          date: selectedDate,
          jobType,
          timeSlot,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errCode = data.error?.code;
        const errMessage = data.error?.message || data.message || 'Gagal melakukan claim slot job.';

        if (errCode === 'SLOT_CLAIM_NOT_YET_OPEN') {
          alert(`Waktu klaim untuk slot ${timeSlot} belum dibuka. Klaim baru dibuka pada 15 menit sebelum slot dimulai.`);
        } else if (errCode === 'MAX_CAPACITY_REACHED') {
          alert(`Kapasitas Anda untuk slot ${timeSlot} (${selectedDate}) sudah penuh (Maksimal 5 order).`);
        } else {
          alert(errMessage);
        }
        return;
      }

      if (data.claimedCount > 0) {
        setClaimSuccessNotice({
          text: `${data.claimedCount} order untuk slot ${timeSlot} (${jobType.toUpperCase()}) telah ditambahkan ke Tugas Berjalan.`,
          count: data.claimedCount,
          jobType,
          slotTime: timeSlot,
        });
      } else {
        alert(`Maaf, order pada slot ${timeSlot} sudah habis diambil oleh kurir lain.`);
      }

      // Refresh pool data in-place without forced redirect
      await loadJobPoolData(selectedDate);
    } catch (err: any) {
      alert(err.message || 'Gagal melakukan claim slot job.');
    } finally {
      setClaimingSlotKey(null);
    }
  };

  const pickupCount = jobPool
    ? jobPool.pickupSlots.reduce((acc, s) => acc + s.availableOrders, 0)
    : 0;

  const deliveryCount = jobPool
    ? jobPool.deliverySlots.reduce((acc, s) => acc + s.availableOrders, 0)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 min-w-0 overflow-x-hidden">
      {/* Mobile-First Clean Page Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/courier"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
              Job Pool
            </h1>
            <p className="text-xs text-slate-500 font-medium truncate">
              Temukan pekerjaan yang tersedia dan ambil slot yang sesuai.
            </p>
          </div>
        </div>

        <button
          onClick={() => loadJobPoolData(selectedDate)}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200/80 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          title="Refresh Job Pool"
        >
          <RefreshCw className={`w-4 h-4 ${isLoadingPool ? 'animate-spin text-amber-600' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* WIB Date Selector */}
      <CourierDateSelector
        selectedDate={selectedDate}
        onDateChange={(newDate) => {
          setSelectedDate(newDate);
          setClaimSuccessNotice(null);
        }}
      />

      {/* Horizontal Tabs: Pickup vs Delivery */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-6 min-w-0 overflow-x-auto text-sm font-bold">
          <button
            onClick={() => setActiveTab('pickup')}
            className={`pb-3 pt-1 px-1 flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'pickup'
                ? 'border-amber-600 text-amber-900 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <Package className={`w-4 h-4 ${activeTab === 'pickup' ? 'text-amber-600' : 'text-slate-400'}`} />
            <span>📦 Pickup</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'pickup'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black'
                  : 'bg-slate-100 text-slate-600 font-bold'
              }`}
            >
              {pickupCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('delivery')}
            className={`pb-3 pt-1 px-1 flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'delivery'
                ? 'border-purple-600 text-purple-900 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            <Truck className={`w-4 h-4 ${activeTab === 'delivery' ? 'text-purple-600' : 'text-slate-400'}`} />
            <span>🚚 Delivery</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'delivery'
                  ? 'bg-purple-100 text-purple-900 border border-purple-300 font-black'
                  : 'bg-slate-100 text-slate-600 font-bold'
              }`}
            >
              {deliveryCount}
            </span>
          </button>
        </div>
      </div>

      {/* After-Claim Success Feedback Banner (Stay on page + CTA link to Tugas Berjalan) */}
      {claimSuccessNotice && (
        <Card variant="white" className="p-4 border-emerald-300 bg-emerald-50/80 shadow-xs relative space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-emerald-950">✓ Job Berhasil Diambil!</h2>
                <p className="text-xs text-emerald-900 font-medium leading-relaxed mt-0.5">
                  {claimSuccessNotice.text}
                </p>
              </div>
            </div>
            <button
              onClick={() => setClaimSuccessNotice(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1 rounded-lg hover:bg-emerald-100/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] text-emerald-800 font-semibold italic">
              Anda tetap di halaman Job Pool untuk dapat mengambil slot lain.
            </span>
            <Link
              href="/courier/active-tasks"
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
            >
              LIHAT TUGAS BERJALAN <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>
      )}

      {/* TAB CONTENT AREA */}
      {activeTab === 'pickup' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="amber">📦 Pickup Job Pool</Badge>
              <span className="text-xs font-bold text-slate-600">Hari ini ({selectedDate})</span>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {pickupCount} order tersedia
            </span>
          </div>

          {isLoadingPool ? (
            <Card variant="white" className="p-8 text-center text-slate-400 text-xs italic">
              Memuat data Pickup Job Pool...
            </Card>
          ) : jobPool?.pickupSlots && jobPool.pickupSlots.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {jobPool.pickupSlots.map((slot) => (
                <JobPoolSlotCard
                  key={`pickup_${slot.timeSlot}`}
                  slot={slot}
                  onClaim={handleClaimSlot}
                  isClaiming={claimingSlotKey === `pickup_${slot.timeSlot}`}
                />
              ))}
            </div>
          ) : (
            /* PICKUP EMPTY STATE */
            <Card variant="white" className="p-8 sm:p-12 text-center border-dashed border-slate-300 space-y-4">
              <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto ring-8 ring-amber-50/50">
                <Package className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h2 className="text-base font-bold text-slate-800">Belum Ada Pickup Job</h2>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Saat ini belum ada pekerjaan penjemputan yang tersedia pada tanggal ini. Coba cek kembali beberapa saat lagi.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadJobPoolData(selectedDate)}
                className="border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 mx-auto"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                Refresh
              </Button>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'delivery' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="purple">🚚 Delivery Job Pool</Badge>
              <span className="text-xs font-bold text-slate-600">Hari ini ({selectedDate})</span>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {deliveryCount} order tersedia
            </span>
          </div>

          {isLoadingPool ? (
            <Card variant="white" className="p-8 text-center text-slate-400 text-xs italic">
              Memuat data Delivery Job Pool...
            </Card>
          ) : jobPool?.deliverySlots && jobPool.deliverySlots.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {jobPool.deliverySlots.map((slot) => (
                <JobPoolSlotCard
                  key={`delivery_${slot.timeSlot}`}
                  slot={slot}
                  onClaim={handleClaimSlot}
                  isClaiming={claimingSlotKey === `delivery_${slot.timeSlot}`}
                />
              ))}
            </div>
          ) : (
            /* DELIVERY EMPTY STATE */
            <Card variant="white" className="p-8 sm:p-12 text-center border-dashed border-slate-300 space-y-4">
              <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto ring-8 ring-purple-50/50">
                <Truck className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h2 className="text-base font-bold text-slate-800">Belum Ada Delivery Job</h2>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Saat ini belum ada pekerjaan pengantaran yang tersedia pada tanggal ini. Coba cek kembali beberapa saat lagi.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadJobPoolData(selectedDate)}
                className="border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 mx-auto"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                Refresh
              </Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
