'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { laundryService } from '@/services/laundryService';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { Order, OrderStatus } from '@/types/order';
import { Laundry } from '@/types/laundry';
import { UserProfile } from '@/types/user';
import { MetricsOverview } from '@/components/admin/MetricsOverview';
import { OrderTable } from '@/components/admin/OrderTable';
import { AdminPhotoManagementModal } from '@/components/admin/AdminPhotoManagementModal';
import { ShieldCheck, RefreshCw, AlertTriangle, Lock, Inbox, Store, Image as ImageIcon, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [laundries, setLaundries] = useState<Laundry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);

  // Photo modal state
  const [selectedLaundryForPhoto, setSelectedLaundryForPhoto] = useState<Laundry | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsUnauthorized(false);

    try {
      let profile: UserProfile | null = null;
      if (isSupabaseConfigured) {
        profile = await authService.fetchCurrentProfile();
      } else {
        profile = authService.getCurrentUser();
      }

      setCurrentUser(profile);

      if (!profile || profile.role !== 'platform_admin') {
        setIsUnauthorized(true);
        setIsLoading(false);
        return;
      }

      // Fetch all orders & laundries for Platform Admin
      const [fetchedOrders, fetchedLaundries] = await Promise.all([
        orderService.getAllOrdersAsync(),
        laundryService.getLaundriesAsync(),
      ]);

      setOrders(fetchedOrders);
      setLaundries(fetchedLaundries);
    } catch (err: any) {
      console.error('[ADMIN-DASHBOARD] Error loading Supabase data:', err);
      setErrorMessage(err.message || 'Gagal terhubung ke database Supabase.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus, notes: string) => {
    if (!currentUser) return;
    try {
      const sessionRes = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
      const token = sessionRes?.data?.session?.access_token;
      const res = await fetch(`/api/orders/${orderId}/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          targetStatus: newStatus,
          notes,
          userId: currentUser.id,
          role: currentUser.role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memperbarui status order.');
      }
      await loadData();
    } catch (err: any) {
      alert(`Gagal memperbarui status order: ${err.message}`);
    }
  };

  if (isUnauthorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl mx-auto flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900">Akses Ditolak (403 Forbidden)</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Halaman ini khusus untuk peranan <strong>Platform Admin</strong>. Akun Anda saat ini tidak memiliki otorisasi.
          </p>
        </div>
        <Button variant="primary" onClick={() => router.push('/customer')}>
          Kembali ke Dashboard Utama
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Platform Admin Panel</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Monitoring &amp; Otorisasi Admin
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Kelola transaksi, penugasan kurir, dan foto storefront mitra laundry resmi dari database.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="p-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-2xl border border-white/20 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Data
        </button>
      </div>

      {errorMessage && (
        <div className="p-6 bg-red-50 rounded-2xl border border-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-red-800">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <h3 className="font-bold text-sm">Gagal Memuat Data Supabase</h3>
              <p className="text-xs text-red-600">{errorMessage}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="border-red-300 text-red-700 hover:bg-red-100">
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Metrics KPI */}
      <MetricsOverview orders={orders} />

      {/* REQUIREMENT #12: PLATFORM ADMIN PHOTO MANAGEMENT SECTION */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-purple-600" />
              <span>Manajemen Foto Storefront Mitra (Platform Admin)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Admin Platform bertanggung jawab penuh mengunggah dan menandai foto storefront utama yang muncul di marketplace.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {laundries.map((lnd) => (
            <div key={lnd.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs line-clamp-1">{lnd.name}</span>
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  {lnd.code}
                </span>
              </div>

              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-200">
                <img
                  src={lnd.logoUrl || 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80'}
                  alt={`Storefront ${lnd.name}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-slate-900/80 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400" /> ★ Foto Utama
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedLaundryForPhoto(lnd);
                  setIsPhotoModalOpen(true);
                }}
                leftIcon={<ImageIcon className="w-3.5 h-3.5" />}
                className="w-full text-xs font-bold border-purple-300 text-purple-700 hover:bg-purple-50 cursor-pointer"
              >
                Kelola / Ganti Foto Utama
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Order Management Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Tabel Manajemen Seluruh Order</h2>
          <span className="text-xs font-bold text-slate-500">
            {isLoading ? 'Memuat data...' : `Total ${orders.length} Transaksi Terdaftar`}
          </span>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-600" />
            <p className="text-xs font-semibold">Mengambil data dari database Supabase...</p>
          </div>
        ) : orders.length === 0 && !errorMessage ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
            <Inbox className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-base font-bold text-slate-800">Belum Ada Transaksi</h3>
          </div>
        ) : (
          <OrderTable
            orders={orders}
            onUpdateStatus={handleUpdateStatus}
          />
        )}
      </div>

      {/* Admin Photo Modal */}
      <AdminPhotoManagementModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        laundry={selectedLaundryForPhoto}
        onPhotoUpdated={() => loadData()}
      />
    </div>
  );
}
