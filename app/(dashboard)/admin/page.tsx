'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { Order, OrderStatus } from '@/types/order';
import { UserProfile } from '@/types/user';
import { MetricsOverview } from '@/components/admin/MetricsOverview';
import { OrderTable } from '@/components/admin/OrderTable';
import { ShieldCheck, RefreshCw, AlertTriangle, Lock, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsUnauthorized(false);

    try {
      // 1. Authoritative Profile Authorization Check
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

      // 2. Authoritative Supabase Query for All Transactions
      let fetchedOrders: Order[] = [];
      if (typeof window !== 'undefined') {
        const headers: Record<string, string> = {};
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
        }

        const res = await fetch('/api/admin/orders', { headers });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Gagal memuat transaksi dari server Supabase.');
        }

        fetchedOrders = data.orders || [];
      } else {
        fetchedOrders = await orderService.getAllOrdersAsync();
      }

      setOrders(fetchedOrders);
    } catch (err: any) {
      console.error('[ADMIN-DASHBOARD] Error loading Supabase transactions:', err);
      setErrorMessage(err.message || 'Gagal terhubung ke database Supabase.');
      setOrders([]); // STRICT: NEVER fall back to mock data on error!
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssignCourier = async (orderId: string, courierId: string, courierName: string) => {
    if (!currentUser) return;
    try {
      await orderService.assignCourierAsync(orderId, courierId, courierName, currentUser.id);
      await loadData();
    } catch (err: any) {
      alert(`Gagal menugaskan kurir: ${err.message}`);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus, notes: string) => {
    if (!currentUser) return;
    try {
      await orderService.transitionOrderStatusAsync(
        orderId,
        newStatus,
        { id: currentUser.id, role: currentUser.role },
        notes
      );
      await loadData();
    } catch (err: any) {
      alert(`Gagal memperbarui status order: ${err.message}`);
    }
  };

  // 1. UNAUTHORIZED ROLE SCREEN
  if (isUnauthorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl mx-auto flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900">Akses Ditolak (403 Forbidden)</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Halaman ini khusus untuk peranan <strong>Platform Admin</strong>. Akun Anda saat ini tidak memiliki otorisasi untuk melihat seluruh transaksi platform.
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
            <span>Admin Control Panel (Supabase Authoritative)</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Monitoring Operasional Laundry
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Pantau arus transaksi, penugasan armada kurir, serta performa layanan FreshWash secara real-time dari database Supabase.
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

      {/* ERROR STATE BANNER */}
      {errorMessage && (
        <div className="p-6 bg-red-50 rounded-2xl border border-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-red-800">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <h3 className="font-bold text-sm">Gagal Memuat Data Transaksi Supabase</h3>
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

      {/* Main Order Management Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Tabel Manajemen Seluruh Order</h2>
          <span className="text-xs font-bold text-slate-500">
            {isLoading ? 'Memuat data...' : `Total ${orders.length} Transaksi Terdaftar di Supabase`}
          </span>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-600" />
            <p className="text-xs font-semibold">Mengambil data transaksi autoritatif dari database Supabase...</p>
          </div>
        ) : orders.length === 0 && !errorMessage ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-3">
            <Inbox className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-base font-bold text-slate-800">Belum Ada Transaksi</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tabel <code>public.orders</code> pada database Supabase saat ini belum memiliki catatan pesanan. Pesanan baru yang dibuat oleh pelanggan akan otomatis muncul di sini.
            </p>
          </div>
        ) : (
          <OrderTable
            orders={orders}
            onAssignCourier={handleAssignCourier}
            onUpdateStatus={handleUpdateStatus}
          />
        )}
      </div>
    </div>
  );
}
