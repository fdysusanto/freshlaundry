'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { formatIDR, formatDateIndo } from '@/utils/formatters';
import { AdminRefundModal, PendingRefundItem } from '@/components/admin/AdminRefundModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Lock,
  Inbox,
  ArrowLeft,
  Search,
  CheckCircle2,
  RotateCcw,
  DollarSign,
  Clock,
  User,
  Store,
  CreditCard,
} from 'lucide-react';

export default function AdminRefundsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUnauthorized, setIsUnauthorized] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [refunds, setRefunds] = useState<PendingRefundItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<PendingRefundItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsUnauthorized(false);

    try {
      // 1. Authorize User Role
      let profile: any = authService.getCurrentUser();
      if (!profile || profile.role !== 'platform_admin') {
        profile = await authService.fetchCurrentProfile();
      }

      if (!profile || profile.role !== 'platform_admin') {
        setIsUnauthorized(true);
        setIsLoading(false);
        return;
      }

      // 2. Build Auth Headers & Fetch Pending Refunds from API
      const headers: Record<string, string> = {};
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      }

      const res = await fetch('/api/admin/refunds', {
        method: 'GET',
        headers,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengambil data antrean refund.');
      }

      setRefunds(data.refunds || []);
    } catch (err: any) {
      console.error('[ADMIN-REFUNDS-PAGE] Error loading refunds:', err);
      setErrorMessage(err.message || 'Gagal terhubung ke server admin.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenModal = (item: PendingRefundItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleSuccessRefund = () => {
    setFeedbackMessage({
      type: 'success',
      text: 'Pengembalian dana (refund) manual berhasil dikonfirmasi dan dicatat ke sistem.',
    });
    loadData();
  };

  // Filter queue by search query
  const filteredRefunds = refunds.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.trackingNumber.toLowerCase().includes(q) ||
      item.customerName.toLowerCase().includes(q) ||
      (item.customerPhone || '').includes(q) ||
      (item.laundryName || '').toLowerCase().includes(q) ||
      item.orderId.toLowerCase().includes(q)
    );
  });

  const totalRefundAmount = refunds.reduce((sum, item) => sum + (item.paymentAmount || 0), 0);

  if (isUnauthorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl mx-auto flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900">Akses Ditolak (403 Forbidden)</h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Halaman Manajemen Refund ini khusus untuk peranan <strong>Platform Admin</strong>. Akun Anda saat ini tidak memiliki otorisasi.
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
      {/* Navigation Back */}
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-xs font-bold text-slate-500 hover:text-purple-700 flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Admin Control Panel
        </Link>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Data
        </button>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Platform Admin Manual Refund Panel</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Antrean Pengembalian Dana (Refund)
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Kelola transaksi pembatalan yang membutuhkan pengembalian dana manual dari rekening platform FreshLaundry ke customer.
          </p>
        </div>

        {/* Stats Pills */}
        <div className="flex flex-wrap gap-3 relative z-10 shrink-0">
          <div className="bg-amber-500/20 border border-amber-400/40 rounded-2xl p-4 text-center min-w-[120px]">
            <span className="block text-2xl font-black text-amber-300">{refunds.length}</span>
            <span className="text-[10px] font-bold text-amber-200 uppercase tracking-wider">Antrean Pending</span>
          </div>
          <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-2xl p-4 text-center min-w-[140px]">
            <span className="block text-xl font-black text-emerald-300">{formatIDR(totalRefundAmount)}</span>
            <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider">Total Nominal</span>
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-700 font-bold text-xs"
          >
            Tutup
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-6 bg-rose-50 rounded-2xl border border-rose-200 flex items-center justify-between gap-4 text-rose-800">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <h3 className="font-bold text-sm">Terjadi Kesalahan</h3>
              <p className="text-xs text-rose-600">{errorMessage}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">Menunggu Pengembalian Dana</h2>
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
            {refunds.length} pesanan
          </span>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari tracking number, customer, atau toko..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Main Refund Queue Table */}
      <Card variant="white" className="shadow-xl overflow-hidden p-0">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-600" />
            <p className="text-xs font-semibold">Mengambil daftar antrean pengembalian dana...</p>
          </div>
        ) : filteredRefunds.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Inbox className="w-12 h-12 mx-auto text-slate-300" />
            <h3 className="text-base font-bold text-slate-800">
              Belum ada pengembalian dana yang menunggu diproses.
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Seluruh transaksi pembatalan atau refund manual yang sah telah selesai dikonfirmasi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Waktu Batal</th>
                  <th className="py-3 px-4">Nomor Order</th>
                  <th className="py-3 px-4">Pelanggan</th>
                  <th className="py-3 px-4">Mitra Laundry</th>
                  <th className="py-3 px-4">Nominal Refund</th>
                  <th className="py-3 px-4">Status Refund</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRefunds.map((item) => (
                  <tr key={item.orderId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-medium">
                      {formatDateIndo(item.createdAt)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      #{item.trackingNumber}
                    </td>
                    <td className="py-3 px-4">
                      <strong className="font-bold text-slate-900 block">{item.customerName}</strong>
                      <span className="text-[11px] text-slate-400 font-mono">{item.customerPhone || item.customerEmail || '-'}</span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {item.laundryName}
                    </td>
                    <td className="py-3 px-4 font-black text-amber-900 text-sm">
                      {formatIDR(item.paymentAmount)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="amber" className="font-bold text-[11px]">
                        REFUND PENDING
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenModal(item)}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                      >
                        Proses Refund
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      <AdminRefundModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedItem(null);
        }}
        refundItem={selectedItem}
        onSuccess={handleSuccessRefund}
      />
    </div>
  );
}
