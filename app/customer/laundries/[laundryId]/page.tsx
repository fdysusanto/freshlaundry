'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { DEMO_LAUNDRIES, SERVICE_CATALOG, ServiceCatalogItem } from '@/utils/constants';
import { laundryService } from '@/services/laundryService';
import { isSupabaseConfigured } from '@/services/supabase';
import { Laundry } from '@/types/laundry';
import { ServiceItemCard } from '@/components/marketplace/ServiceItemCard';
import { formatIDR } from '@/utils/formatters';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Star,
  MapPin,
  Clock,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Phone,
  Sparkles,
  ShoppingBag,
  AlertCircle,
} from 'lucide-react';

export default function LaundryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const laundryId = (params?.laundryId as string) || '';

  const [laundry, setLaundry] = useState<Laundry | null>(null);
  const [laundryServices, setLaundryServices] = useState<ServiceCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;
    const checkRoleGuard = async () => {
      let currentRole: string | undefined;
      if (isSupabaseConfigured) {
        const liveProfile = await authService.fetchCurrentProfile();
        currentRole = liveProfile?.role;
      } else {
        const syncUser = authService.getCurrentUserSync();
        currentRole = syncUser?.role;
      }

      if (currentRole && currentRole !== 'customer') {
        if (isMounted) {
          if (currentRole === 'courier') router.push('/courier');
          else if (currentRole === 'laundry_owner' || currentRole === 'laundry_staff') router.push('/owner');
          else if (currentRole === 'admin' || currentRole === 'platform_admin') router.push('/admin');
          else router.push('/');
        }
      }
    };
    checkRoleGuard();
    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    let isMounted = true;
    const loadDetail = async () => {
      setIsLoading(true);
      try {
        if (isSupabaseConfigured) {
          const liveLaundry = await laundryService.getLaundryByIdAsync(laundryId);
          if (liveLaundry && isMounted) {
            setLaundry(liveLaundry);
            const liveServices = await laundryService.getServicesByLaundryAsync(liveLaundry.id);
            const activeServices = liveServices.filter((s) => s.isActive);
            setLaundryServices(activeServices);
            if (activeServices.length > 0) {
              setSelectedServiceId(activeServices[0].id);
            }
          }
        } else {
          const mockLnd = DEMO_LAUNDRIES.find((l) => l.id === laundryId) || null;
          if (mockLnd && isMounted) {
            setLaundry(mockLnd);
            const mockSrvs = laundryService.getServicesByLaundry(mockLnd.id).filter((s) => s.isActive);
            setLaundryServices(mockSrvs);
            if (mockSrvs.length > 0) {
              setSelectedServiceId(mockSrvs[0].id);
            }
          }
        }
      } catch (err) {
        console.warn('Gagal memuat detail laundry Supabase:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [laundryId]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-500">Memuat detail toko laundry...</p>
      </div>
    );
  }

  if (!laundry) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h1 className="text-xl font-bold text-slate-800">Data laundry tidak ditemukan.</h1>
        <p className="text-xs text-slate-500">ID `{laundryId}` tidak terdaftar di marketplace FreshWash.</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/customer/laundries')}>
          Kembali ke Daftar Laundry
        </Button>
      </div>
    );
  }

  const activeService = laundryServices.find((s) => s.id === selectedServiceId) || laundryServices[0];
  const currentQuantity = quantities[selectedServiceId] || (activeService?.unit === 'kg' ? 5 : 1);
  const subtotal = activeService ? activeService.price * currentQuantity : 0;

  const handleQuantityChange = (serviceId: string, newQty: number) => {
    setQuantities((prev) => ({ ...prev, [serviceId]: newQty }));
  };

  const handleProceedToCheckout = () => {
    if (!activeService) return;
    router.push(
      `/customer/checkout?laundryId=${laundry.id}&serviceId=${activeService.id}&qty=${currentQuantity}`
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* Top Back Nav */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-700 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Laundry
      </button>

      {/* Laundry Header Profile Card */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4 sm:gap-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-teal-500 to-cyan-400 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shrink-0 shadow-lg shadow-teal-500/20">
              {laundry.name.charAt(0)}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-3xl font-black tracking-tight">{laundry.name}</h1>
                {(laundry as any).badge && (
                  <Badge variant="teal" size="sm">
                    {(laundry as any).badge}
                  </Badge>
                )}
                {laundry.verificationStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-300 bg-teal-500/20 px-2.5 py-0.5 rounded-full border border-teal-400/30">
                    <ShieldCheck className="w-3.5 h-3.5" /> Terverifikasi
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{laundry.address}</span>
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>{laundry.rating.toFixed(1)}</span>
                  <span className="text-slate-400 font-normal">({laundry.totalReviews} ulasan)</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-teal-400" />
                  <span>Jam Buka: {laundry.openingTime} - {laundry.closingTime} WIB</span>
                </span>
                <span>•</span>
                <span className="font-semibold text-teal-300">{(laundry as any).distanceKm || 1.2} km dari lokasi Anda</span>
              </div>
            </div>
          </div>

          <div className="bg-white/10 p-4 rounded-2xl border border-white/15 text-right shrink-0 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Status Toko:</span>
            <span className={`text-xs font-bold px-3 py-1 rounded-full inline-block ${
              laundry.isOpen ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
            }`}>
              {laundry.isOpen ? '• Buka Menerima Pesanan' : '• Tutup Sementara'}
            </span>
          </div>
        </div>

        {laundry.description && (
          <div className="pt-4 border-t border-white/10 text-xs text-slate-300 relative z-10 leading-relaxed">
            <span className="font-bold text-white">Deskripsi Toko: </span>
            {laundry.description}
          </div>
        )}
      </div>

      {/* Services Section & Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Services List Left Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-teal-600" />
              <span>Daftar Layanan {laundry.name} ({laundryServices.length})</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">Khusus Mitra Ini</span>
          </div>

          {laundryServices.length > 0 ? (
            <div className="space-y-4">
              {laundryServices.map((srv) => {
                const isSelected = selectedServiceId === srv.id;
                const qty = quantities[srv.id] || (srv.unit === 'kg' ? 5 : 1);
                return (
                  <ServiceItemCard
                    key={srv.id}
                    service={srv}
                    isSelected={isSelected}
                    quantity={qty}
                    onToggleSelect={() => {
                      setSelectedServiceId(srv.id);
                      if (!quantities[srv.id]) {
                        setQuantities((prev) => ({ ...prev, [srv.id]: srv.unit === 'kg' ? 5 : 1 }));
                      }
                    }}
                    onQuantityChange={(newQty) => handleQuantityChange(srv.id, newQty)}
                  />
                );
              })}
            </div>
          ) : (
            <Card variant="white" className="p-8 text-center text-slate-400 italic">
              Mitra laundry ini belum mendaftarkan katalog layanannya.
            </Card>
          )}
        </div>

        {/* Sidebar Summary Right Column */}
        <div className="lg:col-span-5">
          <Card variant="slate" className="sticky top-24 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <p className="text-xs font-bold text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Ringkasan Layanan Terpilih</span>
              </p>
              <h3 className="text-lg font-bold text-white mt-1">
                {activeService?.name || 'Pilih Layanan'}
              </h3>
            </div>

            {activeService ? (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Mitra Laundry:</span>
                  <span className="font-semibold text-white">{laundry.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tarif Layanan:</span>
                  <span className="font-semibold text-white">
                    {formatIDR(activeService.price)} / {activeService.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estimasi Jumlah:</span>
                  <span className="font-bold text-teal-300">
                    {currentQuantity} {activeService.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estimasi Pengerjaan:</span>
                  <span className="font-semibold text-white">{activeService.estimatedTime}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Silakan pilih salah satu layanan di samping.</p>
            )}

            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-400">Subtotal Estimasi Layanan:</p>
              <p className="text-3xl font-black text-teal-300 mt-0.5">{formatIDR(subtotal)}</p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleProceedToCheckout}
              disabled={!activeService || !laundry.isOpen}
              rightIcon={<ArrowRight className="w-5 h-5" />}
              className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-xl disabled:opacity-50 cursor-pointer"
            >
              {laundry.isOpen ? 'Lanjut ke Checkout' : 'Toko Sedang Tutup'}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
