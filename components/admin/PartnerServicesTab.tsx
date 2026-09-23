'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ServiceCatalogItem } from '@/utils/constants';
import { Laundry } from '@/types/laundry';
import { authService } from '@/services/authService';
import { formatIDR } from '@/utils/formatters';
import { Button } from '@/components/ui/Button';
import { PartnerServiceModal } from '@/components/admin/PartnerServiceModal';
import {
  Layers,
  Plus,
  Edit,
  Power,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Shirt,
  Box,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface PartnerServicesTabProps {
  partner: Laundry;
}

export const PartnerServicesTab: React.FC<PartnerServicesTabProps> = ({ partner }) => {
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [serviceToEdit, setServiceToEdit] = useState<ServiceCatalogItem | null>(null);

  // Loading state for individual toggle actions
  const [togglingServiceId, setTogglingServiceId] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const authHeaders = await authService.getAuthHeadersAsync();
      const res = await fetch(`/api/admin/partners/${partner.id}/services`, {
        headers: authHeaders,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memuat katalog layanan partner.');
      }

      setServices(data.services || []);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setIsLoading(false);
    }
  }, [partner.id]);

  useEffect(() => {
    let ignore = false;
    const fetchOnMount = async () => {
      try {
        const authHeaders = await authService.getAuthHeadersAsync();
        const res = await fetch(`/api/admin/partners/${partner.id}/services`, {
          headers: authHeaders,
        });
        const data = await res.json();
        if (!ignore) {
          if (!res.ok || !data.success) {
            setErrorMessage(data.message || 'Gagal memuat katalog layanan partner.');
          } else {
            setServices(data.services || []);
          }
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setErrorMessage(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
          setIsLoading(false);
        }
      }
    };

    fetchOnMount();
    return () => {
      ignore = true;
    };
  }, [partner.id]);

  const handleOpenCreateModal = () => {
    setModalMode('CREATE');
    setServiceToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (service: ServiceCatalogItem) => {
    setModalMode('EDIT');
    setServiceToEdit(service);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (service: ServiceCatalogItem) => {
    const nextState = !service.isActive;
    const confirmMessage = nextState
      ? `Aktifkan kembali layanan "${service.name}"?`
      : `Nonaktifkan layanan "${service.name}"? Pelanggan tidak akan dapat memilih layanan ini pada pesanan baru.`;

    if (!confirm(confirmMessage)) return;

    setTogglingServiceId(service.id);
    try {
      const authHeaders = await authService.getAuthHeadersAsync();
      const res = await fetch(`/api/admin/partners/${partner.id}/services/${service.id}`, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'toggle',
          isActive: nextState,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memperbarui status layanan.');
      }

      await loadServices();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan saat mengubah status layanan.');
    } finally {
      setTogglingServiceId(null);
    }
  };

  const renderServiceIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className="w-5 h-5 text-purple-600" />;
      case 'Shirt':
        return <Shirt className="w-5 h-5 text-cyan-600" />;
      case 'Box':
        return <Box className="w-5 h-5 text-amber-600" />;
      default:
        return <ShoppingBag className="w-5 h-5 text-brand-primary" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Tab Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-surface rounded-xl text-brand-primary">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Layanan</h2>
          </div>
          <p className="text-xs text-slate-500 font-semibold">
            Kelola layanan yang tersedia untuk pelanggan pada laundry ini.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreateModal}
          leftIcon={<Plus className="w-4 h-4" />}
          className="text-xs font-bold"
        >
          + Tambah Layanan
        </Button>
      </div>

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 text-xs text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Loading Spinner */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-3xl border border-slate-200 space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-primary" />
          <p className="font-semibold">Memuat katalog layanan partner dari database...</p>
        </div>
      ) : services.length === 0 ? (
        /* Empty State */
        <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-3xl border border-slate-200 space-y-4">
          <div className="w-14 h-14 bg-slate-100 rounded-3xl mx-auto flex items-center justify-center text-slate-400">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <p className="font-bold text-slate-800 text-sm">Belum Ada Layanan Terdaftar</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Laundry ini belum memiliki item layanan aktif. Tambahkan layanan agar toko siap menerima pesanan dari customer.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenCreateModal}
            leftIcon={<Plus className="w-4 h-4" />}
            className="text-xs font-bold"
          >
            Tambah Layanan Pertama
          </Button>
        </div>
      ) : (
        /* Service Catalog Cards List */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span className="font-bold text-slate-700">Total {services.length} Layanan</span>
            <span className="text-[11px]">
              Aktif: <strong className="text-emerald-600">{services.filter((s) => s.isActive).length}</strong> | Nonaktif: <strong className="text-slate-500">{services.filter((s) => !s.isActive).length}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((service) => {
              const isToggling = togglingServiceId === service.id;

              return (
                <div
                  key={service.id}
                  className={`bg-white rounded-3xl border p-5 space-y-4 transition-all shadow-xs ${
                    service.isActive
                      ? 'border-slate-200 hover:border-slate-300'
                      : 'border-slate-200 bg-slate-50/60 opacity-80'
                  }`}
                >
                  {/* Top Bar: Icon, Name, Category & Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-slate-100 rounded-2xl shrink-0">
                        {renderServiceIcon(service.iconName)}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="font-bold text-slate-900 text-sm">{service.name}</h3>
                          <span className="px-2 py-0.2 rounded-md text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                            {service.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Kategori: <strong>{service.category || 'Pakaian'}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Active/Inactive Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 border ${
                        service.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {service.isActive ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Aktif</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-slate-400" />
                          <span>Nonaktif</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Description */}
                  {service.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      {service.description}
                    </p>
                  )}

                  {/* Attributes Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Tarif</span>
                      <span className="font-black text-brand-primary text-sm">
                        {formatIDR(service.price || service.price_per_unit || 0)}
                        <span className="text-[10px] font-semibold text-slate-500">/{service.unit || 'kg'}</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Penagihan</span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {service.pricingType || (service.unit === 'pcs' ? 'per_item' : 'per_kg')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Min. Order</span>
                      <span className="font-semibold text-slate-800">
                        {service.minWeight && service.unit === 'kg' ? `${service.minWeight} kg` : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">Estimasi</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {service.estimatedHours || 24} Jam
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditModal(service)}
                      leftIcon={<Edit className="w-3.5 h-3.5" />}
                      className="text-xs font-bold py-1.5 px-3"
                    >
                      Edit
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(service)}
                      disabled={isToggling}
                      leftIcon={<Power className="w-3.5 h-3.5" />}
                      className={`text-xs font-bold py-1.5 px-3 ${
                        service.isActive
                          ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                          : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {isToggling ? 'Menyimpan...' : service.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Layanan */}
      <PartnerServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        partnerId={partner.id}
        partnerName={partner.name}
        mode={modalMode}
        serviceToEdit={serviceToEdit}
        onSuccess={() => loadServices()}
      />
    </div>
  );
};
