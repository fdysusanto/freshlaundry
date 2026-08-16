'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { adminPartnerService } from '@/services/adminPartnerService';
import { PartnerApplicationRecord } from '@/services/partnerApplicationService';
import { isSupabaseConfigured } from '@/services/supabase';
import { formatDateIndo } from '@/utils/formatters';
import { PartnerApplicationDetailModal } from '@/components/admin/PartnerApplicationDetailModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  ShieldCheck,
  Store,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';

export default function AdminPartnerApplicationsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [applications, setApplications] = useState<PartnerApplicationRecord[]>([]);
  const [selectedApp, setSelectedApp] = useState<PartnerApplicationRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured) {
        const profile = await authService.fetchCurrentProfile();
        if (!profile || profile.role !== 'platform_admin') {
          router.push('/customer');
          return;
        }

        const data = await adminPartnerService.getPartnerApplicationsAsync();
        setApplications(data);
      }
    } catch (err: any) {
      console.warn('Error loading partner applications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [router]);

  const handleOpenDetail = (app: PartnerApplicationRecord) => {
    setSelectedApp(app);
    setIsModalOpen(true);
  };

  const handleApprove = async (appId: string) => {
    setFeedbackMessage(null);
    try {
      const res = await adminPartnerService.approvePartnerApplicationAsync(appId);
      setFeedbackMessage({
        type: 'success',
        text: res.message || 'Pengajuan mitra berhasil disetujui.',
      });
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Gagal memproses approval mitra.',
      });
      throw err;
    }
  };

  const handleReject = async (appId: string, reason: string) => {
    setFeedbackMessage(null);
    try {
      const res = await adminPartnerService.rejectPartnerApplicationAsync(appId, reason);
      setFeedbackMessage({
        type: 'success',
        text: res.message || 'Pengajuan mitra berhasil ditolak.',
      });
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Gagal memproses penolakan mitra.',
      });
      throw err;
    }
  };

  // Filtered applications
  const filteredApps = applications.filter((app) => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      app.laundry_name.toLowerCase().includes(query) ||
      app.owner_full_name.toLowerCase().includes(query) ||
      app.city.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  const countPending = applications.filter((a) => a.status === 'pending').length;
  const countApproved = applications.filter((a) => a.status === 'approved').length;
  const countRejected = applications.filter((a) => a.status === 'rejected').length;

  if (isLoading) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Memuat portal approval mitra laundry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Navigation Back & Header */}
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-xs font-bold text-slate-500 hover:text-purple-700 flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Admin Control Panel
        </Link>
        <button
          onClick={loadData}
          className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Platform Admin Portal</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Verifikasi &amp; Approval Mitra Laundry
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Kelola pengajuan pendaftaran outlet laundry mitra. Tinjau draf layanan dan rekening pencairan sebelum melakukan approval resmi.
          </p>
        </div>

        {/* Stats Summary Pills */}
        <div className="flex flex-wrap gap-3 relative z-10 shrink-0">
          <div className="bg-amber-500/20 border border-amber-400/40 rounded-2xl p-3 text-center min-w-[90px]">
            <span className="block text-2xl font-black text-amber-300">{countPending}</span>
            <span className="text-[10px] font-bold text-amber-200 uppercase">Pending</span>
          </div>
          <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-2xl p-3 text-center min-w-[90px]">
            <span className="block text-2xl font-black text-emerald-300">{countApproved}</span>
            <span className="text-[10px] font-bold text-emerald-200 uppercase">Approved</span>
          </div>
          <div className="bg-rose-500/20 border border-rose-400/40 rounded-2xl p-3 text-center min-w-[90px]">
            <span className="block text-2xl font-black text-rose-300">{countRejected}</span>
            <span className="text-[10px] font-bold text-rose-200 uppercase">Rejected</span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
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

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 text-xs w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Semua ({applications.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Pending ({countPending})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              statusFilter === 'approved' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Disetujui ({countApproved})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              statusFilter === 'rejected' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Ditolak ({countRejected})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari toko, pemilik, atau kota..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Main Applications Table */}
      <Card variant="white" className="shadow-xl overflow-hidden p-0">
        {filteredApps.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Store className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-500">Tidak ada pengajuan mitra yang cocok dengan kriteria kueri Anda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Nama Laundry</th>
                  <th className="py-3 px-4">Kota / Kecamatan</th>
                  <th className="py-3 px-4">Pemilik Usaha</th>
                  <th className="py-3 px-4">WhatsApp</th>
                  <th className="py-3 px-4 text-center">Layanan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApps.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-500">
                      {formatDateIndo(app.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <strong className="font-bold text-slate-900 block">{app.laundry_name}</strong>
                      <span className="text-[11px] text-slate-400 font-mono">ID: {app.id.slice(0, 8)}...</span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {app.city}, {app.district}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {app.owner_full_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {app.owner_phone}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-teal-700">
                      {app.services?.length || 0} layanan
                    </td>
                    <td className="py-3 px-4">
                      {app.status === 'pending' && (
                        <Badge variant="amber" className="font-bold text-[11px]">
                          PENDING
                        </Badge>
                      )}
                      {app.status === 'approved' && (
                        <Badge variant="emerald" className="font-bold text-[11px]">
                          APPROVED
                        </Badge>
                      )}
                      {app.status === 'rejected' && (
                        <Badge variant="rose" className="font-bold text-[11px]">
                          REJECTED
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetail(app)}
                        rightIcon={<Eye className="w-3.5 h-3.5" />}
                        className="font-bold"
                      >
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail Modal Component */}
      <PartnerApplicationDetailModal
        application={selectedApp}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedApp(null);
        }}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}
