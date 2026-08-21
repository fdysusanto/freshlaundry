'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { DEMO_LAUNDRIES, SERVICE_CATALOG, ServiceCatalogItem } from '@/utils/constants';
import { laundryService } from '@/services/laundryService';
import { isSupabaseConfigured } from '@/services/supabase';
import { useFavorites } from '@/hooks/useFavorites';
import { calculateHaversineDistance } from '@/services/marketplaceService';
import { useLocationState } from '@/hooks/useLocationState';
import { Laundry, Review } from '@/types/laundry';
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
  Heart,
  MessageSquare,
  Store,
} from 'lucide-react';

const FALLBACK_STOREFRONT =
  'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80';

export default function LaundryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locationState = useLocationState();
  const laundryId = (params?.laundryId as string) || '';

  const { isFavorite, toggleFavorite } = useFavorites();
  const [laundry, setLaundry] = useState<Laundry | null>(null);
  const [laundryServices, setLaundryServices] = useState<ServiceCatalogItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [imgSrc, setImgSrc] = useState<string>(FALLBACK_STOREFRONT);

  const isFav = laundry ? isFavorite(laundry.id) : false;

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
            if (liveLaundry.logoUrl) setImgSrc(liveLaundry.logoUrl);
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
            if (mockLnd.logoUrl) setImgSrc(mockLnd.logoUrl);
            const mockSrvs = laundryService.getServicesByLaundry(mockLnd.id).filter((s) => s.isActive);
            setLaundryServices(mockSrvs);
            if (mockSrvs.length > 0) {
              setSelectedServiceId(mockSrvs[0].id);
            }
          }
        }

        // Mock customer reviews for demo UI
        if (isMounted) {
          setReviews([
            {
              id: 'rev_1',
              orderId: 'ord_1',
              customerId: 'cust_1',
              customerName: 'Budi Santoso',
              laundryId: laundryId,
              rating: 5,
              comment: 'Hasil cuci bersih sekali, wangi bunga sakura dan setrika rapi. Kurir jemput tepat waktu!',
              createdAt: '2026-08-15T10:00:00Z',
            },
            {
              id: 'rev_2',
              orderId: 'ord_2',
              customerId: 'cust_2',
              customerName: 'Siti Aminah',
              laundryId: laundryId,
              rating: 5,
              comment: 'Express 6 jam beneran cepat dan harum banget. Sangat direkomendasikan!',
              createdAt: '2026-08-18T14:30:00Z',
            },
          ]);
        }
      } catch (err) {
        console.warn('Gagal memuat detail laundry:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [laundryId]);

  // Haversine Distance computation (ONLY when user lat/lng exists)
  const distanceKm = useMemo(() => {
    if (!laundry) return undefined;
    let userLat: number | null = null;
    let userLng: number | null = null;

    if (locationState.user && (locationState.user as any).latitude) {
      userLat = Number((locationState.user as any).latitude);
      userLng = Number((locationState.user as any).longitude);
    }

    return calculateHaversineDistance(userLat, userLng, laundry.latitude, laundry.longitude);
  }, [laundry, locationState.user]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500">Memuat detail mitra laundry...</p>
      </div>
    );
  }

  if (!laundry) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h1 className="text-xl font-bold text-slate-800">Mitra laundry tidak ditemukan.</h1>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 pb-24 md:pb-10">
      
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Marketplace
        </button>

        <button
          type="button"
          onClick={() => toggleFavorite(laundry.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:text-rose-600 shadow-xs cursor-pointer"
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
          <span>{isFav ? 'Favorit Saya' : 'Tambah Favorit'}</span>
        </button>
      </div>

      {/* STORE FRONT PHOTO HERO SECTION */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Storefront Image Left / Top */}
        <div className="lg:col-span-5 relative min-h-[260px] lg:min-h-[340px] bg-slate-100">
          <img
            src={imgSrc}
            alt={`Foto Outlet ${laundry.name}`}
            onError={() => setImgSrc(FALLBACK_STOREFRONT)}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-extrabold px-3 py-1 rounded-full border border-white/20">
            Foto Storefront Utama
          </div>
        </div>

        {/* Laundry Info Right / Bottom */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{laundry.name}</h1>
                {laundry.verificationStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> Terverifikasi
                  </span>
                )}
              </div>

              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                laundry.isOpen ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {laundry.isOpen ? '• Buka Menerima Pesanan' : '• Tutup Sementara'}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5 font-medium">
              <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
              <span>{laundry.address}</span>
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
              <span className="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span>{laundry.rating.toFixed(1)}</span>
                <span className="text-slate-500 font-normal">({laundry.totalReviews} ulasan)</span>
              </span>

              {distanceKm !== undefined && (
                <span className="font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200">
                  📍 {distanceKm} km dari lokasi Anda
                </span>
              )}

              <span className="flex items-center gap-1 text-slate-600 font-medium">
                <Clock className="w-4 h-4 text-teal-600" />
                <span>Jam Operasional: {laundry.openingTime} - {laundry.closingTime} WIB</span>
              </span>
            </div>

            {laundry.description && (
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
                <span className="font-bold text-slate-900">Tentang Mitra: </span>
                {laundry.description}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Kode Mitra: <strong className="text-slate-800">{laundry.code}</strong></span>
            <span>Kontak: <strong className="text-slate-800">{laundry.phone}</strong></span>
          </div>
        </div>
      </div>

      {/* LAYANAN LAUNDRY & SIDEBAR SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Services & Reviews Left Column */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* LAYANAN LAUNDRY */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-teal-600" />
                <span>LAYANAN LAUNDRY ({laundryServices.length})</span>
              </h2>
              <span className="text-xs text-slate-500 font-medium">Pilih salah satu layanan</span>
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

          {/* ULASAN PELANGGAN */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-teal-600" />
              <span>ULASAN PELANGGAN ({reviews.length})</span>
            </h2>

            <div className="space-y-3">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
                        {rev.customerName?.charAt(0) || 'C'}
                      </div>
                      <span className="text-xs font-bold text-slate-800">{rev.customerName}</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                      <Star className="w-3.5 h-3.5 fill-amber-500" />
                      <span>{rev.rating}.0</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 italic">"{rev.comment}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Summary Right Column */}
        <div className="lg:col-span-5">
          <Card variant="slate" className="sticky top-24 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <p className="text-xs font-bold text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Ringkasan Pesanan Anda</span>
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
              {laundry.isOpen ? 'Pesan Sekarang' : 'Toko Sedang Tutup'}
            </Button>
          </Card>
        </div>
      </div>

      {/* Sticky Mobile Bottom CTA Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-50 shadow-2xl flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Subtotal</span>
          <span className="text-lg font-black text-teal-800">{formatIDR(subtotal)}</span>
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={handleProceedToCheckout}
          disabled={!activeService || !laundry.isOpen}
          className="bg-teal-600 text-white font-bold px-6 shadow-md"
        >
          Pesan Sekarang
        </Button>
      </div>
    </div>
  );
}
