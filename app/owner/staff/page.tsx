'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOwnerBranch } from '@/components/owner/OwnerBranchContext';
import { OwnerBranchSwitcher } from '@/components/owner/OwnerBranchSwitcher';
import { OwnerMobileNavigation } from '@/components/owner/OwnerMobileNavigation';
import { ownerStaffService, OwnerStaffRecord } from '@/services/ownerStaffService';
import { formatDateIndo } from '@/utils/formatters';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Users,
  UserCheck,
  UserX,
  PlusCircle,
  AlertCircle,
  Search,
  CheckCircle2,
  Store,
  ArrowLeft,
  X,
  Lock,
  Mail,
  Phone,
  User as UserIcon,
  ShieldAlert,
} from 'lucide-react';

export default function OwnerStaffManagementPage() {
  const router = useRouter();
  const {
    currentUser,
    ownedLaundries,
    activeLaundryId,
    activeLaundry,
    isLoading: isBranchLoading,
  } = useOwnerBranch();

  const [staffList, setStaffList] = useState<OwnerStaffRecord[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);

  // Toggle Action Loading State
  const [togglingStaffId, setTogglingStaffId] = useState<string | null>(null);

  // Add Staff Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    targetLaundryId: '',
  });

  // Guard for Staff Role (Staff members cannot access staff management)
  const isStaffRole = currentUser?.role === 'laundry_staff';

  const loadStaffData = useCallback(async () => {
    if (!activeLaundryId || isStaffRole) {
      setStaffList([]);
      setIsLoadingStaff(false);
      return;
    }

    setIsLoadingStaff(true);
    try {
      const data = await ownerStaffService.getStaffByLaundryAsync(activeLaundryId);
      setStaffList(data);
    } catch (err: any) {
      console.warn('[OWNER-STAFF-PAGE] Error loading staff data:', err);
    } finally {
      setIsLoadingStaff(false);
    }
  }, [activeLaundryId, isStaffRole]);

  useEffect(() => {
    loadStaffData();
  }, [loadStaffData]);

  // Set default targetLaundryId in modal when activeLaundryId changes
  useEffect(() => {
    if (activeLaundryId) {
      setFormData((prev) => ({ ...prev, targetLaundryId: activeLaundryId }));
    }
  }, [activeLaundryId]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        staff.fullName.toLowerCase().includes(q) ||
        staff.email.toLowerCase().includes(q) ||
        (staff.phone && staff.phone.includes(q));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && staff.isActive) ||
        (statusFilter === 'inactive' && !staff.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [staffList, searchQuery, statusFilter]);

  // Metrics computation
  const metrics = useMemo(() => {
    const total = staffList.length;
    const activeCount = staffList.filter((s) => s.isActive).length;
    const inactiveCount = staffList.filter((s) => !s.isActive).length;
    return { total, activeCount, inactiveCount };
  }, [staffList]);

  const handleToggleStatus = async (staff: OwnerStaffRecord) => {
    if (togglingStaffId) return;
    setTogglingStaffId(staff.id);
    try {
      const newStatus = !staff.isActive;
      await ownerStaffService.toggleStaffStatusAsync(staff.id, newStatus);
      await loadStaffData();
    } catch (err: any) {
      alert(`Gagal merubah status staf: ${err.message}`);
    } finally {
      setTogglingStaffId(null);
    }
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSuccess(null);

    const targetLaundry = formData.targetLaundryId || activeLaundryId;
    if (!targetLaundry) {
      setModalError('Pilih cabang laundry untuk staf baru.');
      return;
    }

    if (!formData.fullName.trim()) {
      setModalError('Nama lengkap staf wajib diisi.');
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      setModalError('Alamat email tidak valid.');
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      setModalError('Password sementara minimal 6 karakter.');
      return;
    }

    setIsSubmitting(true);
    try {
      await ownerStaffService.createStaffAccountAsync({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
        laundryId: targetLaundry,
        isActive: true,
      });

      setModalSuccess('Akun staf baru berhasil dibuat dan ditautkan ke cabang!');
      setFormData({
        fullName: '',
        email: '',
        password: '',
        phone: '',
        targetLaundryId: activeLaundryId || '',
      });
      await loadStaffData();

      setTimeout(() => {
        setIsModalOpen(false);
        setModalSuccess(null);
      }, 1500);
    } catch (err: any) {
      setModalError(err.message || 'Gagal mendaftarkan staf baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading State
  if (isBranchLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500">Memuat data cabang laundry...</p>
      </div>
    );
  }

  // 2. Staff Role Guard: Access Denied
  if (isStaffRole) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
        <Card variant="white" className="p-8 border-rose-200 bg-rose-50/40 space-y-4">
          <ShieldAlert className="w-14 h-14 text-rose-500 mx-auto" />
          <h1 className="text-xl font-black text-slate-900">Akses Terbatas — Staf Laundry</h1>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
            Halaman Manajemen Staf hanya dapat diakses oleh Pemilik Laundry (Owner). Anda saat ini login sebagai Staf Operasional.
          </p>
          <div className="pt-2">
            <Link href="/owner">
              <Button variant="primary" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                Kembali ke Dashboard Staf
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 pb-28 md:pb-12">
      {/* NAVIGATION BACK LINK & HEADER */}
      <div className="space-y-4">
        <Link href="/owner" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Dashboard Utama</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Manajemen Staf Per Cabang</h1>
              <span className="text-xs font-extrabold px-3 py-0.5 rounded-full bg-brand-surface text-brand-primary border border-brand-primary/20">
                Phase 2B
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Kelola dan daftarkan anggota staf operasional khusus untuk outlet <strong className="text-slate-800">{activeLaundry?.name || 'Cabang Terpilih'}</strong>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <OwnerBranchSwitcher />
            <Button
              variant="primary"
              size="md"
              leftIcon={<PlusCircle className="w-4 h-4" />}
              className="bg-brand-primary hover:bg-brand-primary/90 font-bold text-xs shadow-sm cursor-pointer w-full sm:w-auto min-h-[44px] flex items-center justify-center shrink-0"
              onClick={() => setIsModalOpen(true)}
            >
              + Tambah Staf Baru
            </Button>
          </div>
        </div>
      </div>

      {!activeLaundry ? (
        <Card variant="white" className="p-8 text-center space-y-3 border-amber-200 bg-amber-50/30">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Belum Ada Outlet Laundry Aktif</h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Silakan pilih outlet laundry aktif dari menu switcher di atas untuk mengelola staf cabang.
          </p>
        </Card>
      ) : (
        <>
          {/* SUMMARY METRICS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card variant="white" className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-200">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Total Staf Cabang</p>
                <h3 className="text-2xl font-black text-slate-900 mt-0.5">{metrics.total} Orang</h3>
              </div>
            </Card>

            <Card variant="white" className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Staf Aktif</p>
                <h3 className="text-2xl font-black text-emerald-700 mt-0.5">{metrics.activeCount} Orang</h3>
              </div>
            </Card>

            <Card variant="white" className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Staf Non-Aktif</p>
                <h3 className="text-2xl font-black text-rose-700 mt-0.5">{metrics.inactiveCount} Orang</h3>
              </div>
            </Card>
          </div>

          {/* MAIN CONTENT CARD (FILTER & TABLE/LIST) */}
          <Card variant="white" className="p-6 space-y-6">
            {/* SEARCH & FILTER BAR */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Daftar Staf — {activeLaundry.name}</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Staf yang terdaftar hanya memiliki akses operasional ke cabang ini.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama, email, atau phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-brand-primary"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="text-xs font-bold py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer"
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Non-Aktif</option>
                </select>
              </div>
            </div>

            {/* TABLE VIEW (DESKTOP & TABLET) */}
            {isLoadingStaff ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Memuat data staf cabang...</p>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Users className="w-12 h-12 text-slate-300 mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-800">Belum Ada Staf di Cabang Ini</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    {searchQuery || statusFilter !== 'all'
                      ? 'Tidak ditemukan staf yang cocok dengan kriteria pencarian.'
                      : 'Tambahkan anggota staf operasional untuk membantu pengelolaan cucian di outlet ini.'}
                  </p>
                </div>
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    leftIcon={<PlusCircle className="w-4 h-4" />}
                    className="bg-brand-primary hover:bg-brand-primary/90 font-bold text-xs shadow-sm cursor-pointer min-h-[44px] mx-auto flex items-center justify-center"
                    onClick={() => setIsModalOpen(true)}
                  >
                    + Tambah Staf Baru
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* DESKTOP TABLE */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50">
                        <th className="p-3">Nama Staf</th>
                        <th className="p-3">Kontak / Email</th>
                        <th className="p-3">Outlet Cabang</th>
                        <th className="p-3">Terdaftar</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStaff.map((staff) => (
                        <tr key={staff.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center border border-slate-200 shrink-0">
                                {staff.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 text-sm block">{staff.fullName}</span>
                                <span className="text-[10px] font-semibold text-slate-400">ID: {staff.profileId.slice(0, 8)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="space-y-0.5">
                              <div className="font-medium text-slate-800 flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{staff.email}</span>
                              </div>
                              {staff.phone && (
                                <div className="text-slate-500 flex items-center gap-1.5">
                                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{staff.phone}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <Store className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                              <span className="font-semibold text-slate-800">{activeLaundry.name}</span>
                            </div>
                          </td>
                          <td className="p-3 text-slate-500 font-medium">
                            {formatDateIndo(staff.createdAt)}
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                                staff.isActive
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${staff.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              {staff.isActive ? 'Aktif' : 'Non-Aktif'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant={staff.isActive ? 'outline' : 'primary'}
                              size="sm"
                              disabled={togglingStaffId === staff.id}
                              className={`font-bold text-xs cursor-pointer ${
                                staff.isActive
                                  ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                              onClick={() => handleToggleStatus(staff)}
                            >
                              {togglingStaffId === staff.id
                                ? 'Memproses...'
                                : staff.isActive
                                ? 'Nonaktifkan'
                                : 'Aktifkan Kembali'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE CARDS VIEW */}
                <div className="block md:hidden space-y-3">
                  {filteredStaff.map((staff) => (
                    <div key={staff.id} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-2xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center border border-slate-200 shrink-0">
                            {staff.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-900">{staff.fullName}</h4>
                            <p className="text-[11px] text-slate-500 font-medium">{staff.email}</p>
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            staff.isActive
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {staff.isActive ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 text-xs space-y-1 text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Cabang:</span>
                          <span className="font-bold text-slate-800">{activeLaundry.name}</span>
                        </div>
                        {staff.phone && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-medium">Telepon:</span>
                            <span className="font-semibold text-slate-800">{staff.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Terdaftar:</span>
                          <span>{formatDateIndo(staff.createdAt)}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex justify-end">
                        <Button
                          variant={staff.isActive ? 'outline' : 'primary'}
                          size="sm"
                          disabled={togglingStaffId === staff.id}
                          className={`w-full font-bold text-xs cursor-pointer ${
                            staff.isActive
                              ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                          onClick={() => handleToggleStatus(staff)}
                        >
                          {togglingStaffId === staff.id
                            ? 'Memproses...'
                            : staff.isActive
                            ? 'Nonaktifkan Staf'
                            : 'Aktifkan Kembali'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {/* MODAL: + TAMBAH STAF BARU */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-brand-primary" />
                  <span>Tambah Staf Cabang Baru</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Daftarkan staf operasional khusus untuk outlet pilihan Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* NOTIFICATION MESSAGES */}
            {modalError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {/* FORM BODY */}
            <form onSubmit={handleAddStaffSubmit} className="space-y-4">
              {/* TARGET BRANCH SELECTOR */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700">Target Outlet Cabang *</label>
                <select
                  value={formData.targetLaundryId}
                  onChange={(e) => setFormData({ ...formData, targetLaundryId: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-brand-primary"
                  required
                >
                  {ownedLaundries.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code || 'LND'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Staf ini hanya memiliki hak akses operasional untuk cabang yang dipilih di atas.
                </p>
              </div>

              {/* NAMA LENGKAP */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700">Nama Lengkap Staf *</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {/* EMAIL */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700">Alamat Email *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="Contoh: staff.budi@freshlaundry.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {/* PASSWORD SEMENTARA */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700">Password Sementara *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimal 6 karakter"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Password awal ini digunakan staf untuk login pertama kali.
                </p>
              </div>

              {/* PHONE (OPSIONAL) */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700">Nomor Telepon / WhatsApp (Opsional)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="Contoh: 08123456789"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {/* MODAL ACTIONS */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="font-bold text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting}
                  className="bg-brand-primary hover:bg-brand-primary/90 font-bold text-xs shadow-sm cursor-pointer"
                >
                  {isSubmitting ? 'Mendaftarkan...' : 'Simpan Akun Staf'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAV */}
      <OwnerMobileNavigation userRole={currentUser?.role} />
    </div>
  );
}
