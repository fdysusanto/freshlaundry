'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { laundryService } from '@/services/laundryService';
import { DEMO_LAUNDRIES, ServiceCatalogItem } from '@/utils/constants';
import { UserProfile } from '@/types/user';
import { Laundry } from '@/types/laundry';
import { formatIDR } from '@/utils/formatters';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Layers,
  Plus,
  Edit,
  Power,
  ArrowLeft,
  Search,
  Store,
  Clock,
  Sparkles,
  Zap,
  ShoppingBag,
  Box,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export default function OwnerServicesListingPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [selectedLaundryId, setSelectedLaundryId] = useState<string>('lnd_001');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<string>('all');

  const loadData = async () => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    const userLaundryId = user.laundryId || 'lnd_001';
    setSelectedLaundryId(userLaundryId);
    try {
      const liveServices = await laundryService.getServicesByLaundryAsync(userLaundryId);
      setServices(liveServices);
    } catch {
      const laundryServices = laundryService.getServicesByLaundry(userLaundryId);
      setServices(laundryServices);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedLaundry: Laundry = useMemo(() => {
    return (
      DEMO_LAUNDRIES.find((l) => l.id === selectedLaundryId) || DEMO_LAUNDRIES[0]
    );
  }, [selectedLaundryId]);

  const handleToggleActive = async (serviceId: string) => {
    if (!currentUser) return;
    const targetService = services.find((s) => s.id === serviceId);
    if (!targetService) return;
    try {
      await laundryService.updateServiceAsync(
        serviceId,
        { isActive: !targetService.isActive },
        currentUser
      );
      loadData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status layanan.');
    }
  };

  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        srv.name.toLowerCase().includes(q) ||
        srv.description.toLowerCase().includes(q) ||
        srv.code.toLowerCase().includes(q);

      const matchesActive =
        filterActive === 'all' ||
        (filterActive === 'active' && srv.isActive) ||
        (filterActive === 'inactive' && !srv.isActive);

      return matchesSearch && matchesActive;
    });
  }, [services, searchQuery, filterActive]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* Top Back Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/owner')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard Owner
        </button>

        {/* Multi-Laundry Switcher for Demo */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <Store className="w-4 h-4 text-teal-700 ml-1" />
          <select
            value={selectedLaundryId}
            onChange={(e) => {
              const newId = e.target.value;
              setSelectedLaundryId(newId);
              if (currentUser) {
                const updatedUser = { ...currentUser, laundryId: newId };
                setCurrentUser(updatedUser);
                authService.setCurrentUser(updatedUser);
              }
              const newServices = laundryService.getServicesByLaundry(newId);
              setServices(newServices);
            }}
            className="text-xs font-bold bg-transparent text-slate-800 focus:outline-hidden cursor-pointer"
          >
            {DEMO_LAUNDRIES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold">
            <Layers className="w-3.5 h-3.5" />
            <span>Katalog Layanan Toko</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Manajemen Tarif & Services: {selectedLaundry.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Kelola jenis pencucian, tarif per kg/pcs, estimasi jam pengerjaan, dan status aktif/nonaktif layanan mitra laundry Anda.
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={() => router.push('/owner/services/create')}
          leftIcon={<Plus className="w-5 h-5" />}
          className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-xl shrink-0 cursor-pointer"
        >
          + Tambah Layanan Baru
        </Button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama layanan / kode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs font-bold text-slate-500">Status:</span>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="text-xs font-semibold p-2 rounded-xl border border-slate-200 focus:outline-hidden cursor-pointer"
          >
            <option value="all">Semua Service ({services.length})</option>
            <option value="active">Hanya Aktif</option>
            <option value="inactive">Hanya Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Service Cards Grid */}
      {filteredServices.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((srv) => (
            <Card
              key={srv.id}
              variant="white"
              className={`hover:border-teal-300 transition-all space-y-4 relative ${
                !srv.isActive ? 'opacity-65 bg-slate-50/80 border-dashed' : ''
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="teal" size="sm">
                    {srv.code}
                  </Badge>
                  {srv.badge && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      {srv.badge}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleActive(srv.id)}
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                    srv.isActive
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300'
                  }`}
                >
                  <Power className="w-3 h-3" />
                  <span>{srv.isActive ? 'Aktif' : 'Nonaktif'}</span>
                </button>
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-base">{srv.name}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {srv.description}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tarif per {srv.unit}:</span>
                  <span className="font-black text-teal-700 text-sm">{formatIDR(srv.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Estimasi Pengerjaan:</span>
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-teal-600" />
                    {srv.estimatedHours} Jam ({srv.estimatedTime || `${srv.estimatedHours} Jam`})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Minimal Order:</span>
                  <span className="font-semibold text-slate-700">
                    {srv.minWeight || (srv.unit === 'kg' ? 3 : 1)} {srv.unit}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-[11px] text-slate-400 font-mono">ID: {srv.id}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/owner/services/${srv.id}/edit`)}
                  leftIcon={<Edit className="w-3.5 h-3.5" />}
                  className="cursor-pointer"
                >
                  Edit Layanan
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card variant="white" className="p-12 text-center space-y-4 border-slate-200">
          <Layers className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-base font-bold text-slate-800">Katalog Layanan Belum Tersedia</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Tidak ada layanan yang cocok dengan kata kunci pencarian Anda. Tambahkan layanan baru agar pelanggan dapat memesan dari toko ini.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push('/owner/services/create')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            + Tambah Layanan Sekarang
          </Button>
        </Card>
      )}
    </div>
  );
}
