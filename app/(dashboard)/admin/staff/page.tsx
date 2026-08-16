'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { laundryService } from '@/services/laundryService';
import { adminStaffService, LaundryStaffRecord } from '@/services/adminStaffService';
import { isSupabaseConfigured } from '@/services/supabase';
import { Laundry } from '@/types/laundry';
import { formatDateIndo } from '@/utils/formatters';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import {
  ShieldCheck,
  Users,
  UserPlus,
  Search,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Edit,
  UserCheck,
  UserX,
  Store,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function AdminStaffManagementPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [staffList, setStaffList] = useState<LaundryStaffRecord[]>([]);
  const [activeLaundries, setActiveLaundries] = useState<Laundry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<LaundryStaffRecord | null>(null);

  // Form Create State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedLaundryId, setSelectedLaundryId] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Edit Form State
  const [editLaundryId, setEditLaundryId] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // State Processing & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setFeedbackMessage(null);
    try {
      if (isSupabaseConfigured) {
        const profile = await authService.fetchCurrentProfile();
        if (!profile || profile.role !== 'platform_admin') {
          router.push('/customer');
          return;
        }

        const [staffData, laundriesData] = await Promise.all([
          adminStaffService.getStaffListAsync(),
          laundryService.getLaundriesAsync(),
        ]);

        setStaffList(staffData);
        setActiveLaundries(laundriesData.filter((l) => l.isActive));
        if (laundriesData.length > 0 && !selectedLaundryId) {
          setSelectedLaundryId(laundriesData[0].id);
        }
      }
    } catch (err: any) {
      console.warn('Error loading staff management data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [router]);

  const handleOpenCreateModal = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setIsActive(true);
    setModalError('');
    if (activeLaundries.length > 0) {
      setSelectedLaundryId(activeLaundries[0].id);
    }
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (staff: LaundryStaffRecord) => {
    setSelectedStaff(staff);
    setEditLaundryId(staff.laundryId);
    setEditIsActive(staff.isActive);
    setModalError('');
    setIsEditModalOpen(true);
  };

  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setIsSubmitting(true);

    try {
      const newStaff = await adminStaffService.createStaffAccountAsync({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        laundryId: selectedLaundryId,
        isActive,
      });

      setFeedbackMessage({
        type: 'success',
        text: `Akun Laundry Staff '${newStaff.fullName}' (${newStaff.email}) berhasil dibuat!`,
      });

      setIsCreateModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err.message || 'Gagal membuat akun staf laundry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setModalError('');
    setIsSubmitting(true);

    try {
      await adminStaffService.updateStaffAsync(selectedStaff.id, {
        laundryId: editLaundryId,
        isActive: editIsActive,
      });

      setFeedbackMessage({
        type: 'success',
        text: `Data staf '${selectedStaff.fullName}' berhasil diperbarui!`,
      });

      setIsEditModalOpen(false);
      setSelectedStaff(null);
      await loadData();
    } catch (err: any) {
      setModalError(err.message || 'Gagal memperbarui data staf.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActiveStatus = async (staff: LaundryStaffRecord) => {
    setFeedbackMessage(null);
    try {
      await adminStaffService.updateStaffAsync(staff.id, {
        isActive: !staff.isActive,
      });

      setFeedbackMessage({
        type: 'success',
        text: `Status staf '${staff.fullName}' diubah menjadi ${!staff.isActive ? 'Aktif' : 'Nonaktif'}.`,
      });
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Gagal mengubah status staf.',
      });
    }
  };

  // Filtered staff list
  const filteredStaff = staffList.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      !q ||
      s.fullName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.laundryName.toLowerCase().includes(q)
    );
  });

  const activeCount = staffList.filter((s) => s.isActive).length;
  const inactiveCount = staffList.filter((s) => !s.isActive).length;

  if (isLoading) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Memuat portal manajemen staff laundry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Back Navigation & Header */}
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
            <span>Platform Admin Control Panel</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Manajemen Akun Laundry Staff
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Buat akun Laundry Staff, atur penempatan outlet laundry, dan kelola status akses operasional staf secara terpusat.
          </p>
        </div>

        {/* Action Button & Summary Stats */}
        <div className="flex flex-wrap items-center gap-3 relative z-10 shrink-0">
          <div className="bg-white/10 border border-white/15 rounded-2xl p-3 text-center min-w-[80px]">
            <span className="block text-xl font-black text-purple-300">{staffList.length}</span>
            <span className="text-[10px] font-bold text-slate-300 uppercase">Total Staf</span>
          </div>
          <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-2xl p-3 text-center min-w-[80px]">
            <span className="block text-xl font-black text-emerald-300">{activeCount}</span>
            <span className="text-[10px] font-bold text-emerald-200 uppercase">Aktif</span>
          </div>
          <div className="bg-rose-500/20 border border-rose-400/40 rounded-2xl p-3 text-center min-w-[80px]">
            <span className="block text-xl font-black text-rose-300">{inactiveCount}</span>
            <span className="text-[10px] font-bold text-rose-200 uppercase">Nonaktif</span>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={handleOpenCreateModal}
            leftIcon={<UserPlus className="w-4 h-4" />}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg"
          >
            + Tambah Staff
          </Button>
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

      {/* Search Input */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, email, atau toko..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Main Staff Management Table */}
      <Card variant="white" className="shadow-xl overflow-hidden p-0">
        {filteredStaff.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-700">Belum Ada Akun Staff Terdaftar</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Gunakan tombol <strong>+ Tambah Staff</strong> di atas untuk membuat akun Laundry Staff baru.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Nama Staff</th>
                  <th className="py-3 px-4">Email Login</th>
                  <th className="py-3 px-4">Penempatan Laundry</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Tanggal Dibuat</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <strong className="font-bold text-slate-900 block">{staff.fullName}</strong>
                      <span className="text-[10px] text-slate-400 font-mono">Role: LAUNDRY_STAFF</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {staff.email}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-teal-800 flex items-center gap-1">
                        <Store className="w-3.5 h-3.5 text-teal-600" />
                        <span>{staff.laundryName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">Kode: {staff.laundryCode}</span>
                    </td>
                    <td className="py-3 px-4">
                      {staff.isActive ? (
                        <Badge variant="emerald" className="font-bold text-[11px]">
                          AKTIF
                        </Badge>
                      ) : (
                        <Badge variant="rose" className="font-bold text-[11px]">
                          NONAKTIF
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {formatDateIndo(staff.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditModal(staff)}
                        leftIcon={<Edit className="w-3.5 h-3.5" />}
                        className="font-bold text-xs"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActiveStatus(staff)}
                        className={`font-bold text-xs ${
                          staff.isActive
                            ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {staff.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* CREATE STAFF MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tambah Akun Laundry Staff Baru"
        maxWidth="md"
      >
        <form onSubmit={handleCreateStaffSubmit} className="space-y-4 text-xs">
          {modalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Nama Lengkap Staff *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Alamat Email Login *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Contoh: staff@tokolaundry.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Password Sementara * (min 6 karakter)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password sementara..."
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Pilih Outlet Laundry *</label>
            <select
              required
              value={selectedLaundryId}
              onChange={(e) => setSelectedLaundryId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-semibold cursor-pointer"
            >
              {activeLaundries.length === 0 ? (
                <option value="">Tidak ada toko laundry aktif</option>
              ) : (
                activeLaundries.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 block">Status Akun</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={isActive}
                  onChange={() => setIsActive(true)}
                  className="accent-purple-600"
                />
                <span className="font-semibold text-slate-800">Aktif</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={!isActive}
                  onChange={() => setIsActive(false)}
                  className="accent-purple-600"
                />
                <span className="font-semibold text-slate-800">Nonaktif</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting || activeLaundries.length === 0}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold"
            >
              {isSubmitting ? 'Membuat Akun...' : 'Buat Akun Staff'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* EDIT STAFF MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedStaff(null);
        }}
        title={`Edit Penempatan Staf (${selectedStaff?.fullName || ''})`}
        maxWidth="md"
      >
        <form onSubmit={handleEditStaffSubmit} className="space-y-4 text-xs">
          {modalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <p className="text-slate-500">Staf Laundry:</p>
            <p className="font-bold text-slate-900 text-sm">{selectedStaff?.fullName}</p>
            <p className="font-mono text-slate-600">{selectedStaff?.email}</p>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Penempatan Outlet Laundry *</label>
            <select
              required
              value={editLaundryId}
              onChange={(e) => setEditLaundryId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-purple-500 font-semibold cursor-pointer"
            >
              {activeLaundries.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 block">Status Akses Operational</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="editStatus"
                  checked={editIsActive}
                  onChange={() => setEditIsActive(true)}
                  className="accent-purple-600"
                />
                <span className="font-semibold text-slate-800">Aktif</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="editStatus"
                  checked={!editIsActive}
                  onChange={() => setEditIsActive(false)}
                  className="accent-purple-600"
                />
                <span className="font-semibold text-slate-800">Nonaktif</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedStaff(null);
              }}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
