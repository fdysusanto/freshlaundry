'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/services/authService';
import { laundryService } from '@/services/laundryService';
import { laundryPhotoService } from '@/services/laundryPhotoService';
import { isSupabaseConfigured } from '@/services/supabase';
import { useLocationState } from '@/hooks/useLocationState';
import { calculateHaversineDistance } from '@/services/marketplaceService';
import { useFavorites } from '@/hooks/useFavorites';
import { DEMO_LAUNDRIES } from '@/utils/constants';
import { Laundry, LaundryService as ServiceCatalogItem, Review, LaundryPhoto } from '@/types/laundry';
import { formatIDR } from '@/utils/formatters';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  ArrowLeft,
  Heart,
  Star,
  MapPin,
  Clock,
  ShieldCheck,
  Check,
  Sparkles,
  ShoppingBag,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ChevronRight,
  ImageIcon,
} from 'lucide-react';

const FALLBACK_STOREFRONT =
  'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80';

export default function CustomerLaundryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const locationState = useLocationState();
  const laundryId = (params?.laundryId as string) || '';

  const { isFavorite, toggleFavorite } = useFavorites();
  const [laundry, setLaundry] = useState<Laundry | null>(null);
  const [laundryServices, setLaundryServices] = useState<ServiceCatalogItem[]>([]);
  const [photos, setPhotos] = useState<LaundryPhoto[]>([]);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string>(FALLBACK_STOREFRONT);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

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
            
            // Fetch 5-photo profile gallery
            const { photos: fetchedPhotos, primaryPhoto } = await laundryPhotoService.getPhotosByLaundryAsync(liveLaundry.id);
            setPhotos(fetchedPhotos);

            const initialPhoto = primaryPhoto?.public_url || liveLaundry.logoUrl || FALLBACK_STOREFRONT;
            setActivePhotoUrl(initialPhoto);

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
            setActivePhotoUrl(mockLnd.logoUrl || FALLBACK_STOREFRONT);
            const mockSrvs = laundryService.getServicesByLaundry(mockLnd.id).filter((s) => s.isActive);
            setLaundryServices(mockSrvs);
            if (mockSrvs.length > 0) {
              setSelectedServiceId(mockSrvs[0].id);
            }
          }
        }

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

    if (laundryId) loadDetail();

    return () => {
      isMounted = false;
    };
  }, [laundryId]);

  // Compute distance from user location
  const distanceKm = useMemo(() => {
    if (!laundry) return undefined;
    const userLat = locationState.user ? Number((locationState.user as any).latitude) : undefined;
    const userLng = locationState.user ? Number((locationState.user as any).longitude) : undefined;
    return calculateHaversineDistance(userLat, userLng, laundry.latitude, laundry.longitude);
  }, [laundry, locationState.user]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500">Memuat profil mitra laundry...</p>
      </div>
    );
  }

  if (!laundry) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
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

      {/* STOREFRONT 5-PHOTO GALLERY HERO SECTION */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Active Hero Image & Gallery Thumbnails */}
        <div className="lg:col-span-6 p-4 bg-slate-50 space-y-3">
          <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-slate-200 border border-slate-200 shadow-sm">
            <img
              src={activePhotoUrl}
              alt={`Foto Outlet ${laundry.name}`}
              onError={() => setActivePhotoUrl(FALLBACK_STOREFRONT)}
              className="w-full h-full object-cover transition-all duration-300"
            />
            <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-extrabold px-3 py-1 rounded-full border border-white/20 flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Verified Storefront</span>
            </div>
          </div>

          {/* 5-Photo Gallery Thumbnail Row (Mobile Swipe Friendly) */}
          {photos.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                <span>Galeri Foto Storefront ({photos.length} Foto)</span>
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {photos.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActivePhotoUrl(p.public_url)}
                    className={`relative w-20 aspect-[4/3] rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                      activePhotoUrl === p.public_url
                        ? 'border-teal-600 ring-2 ring-teal-500/30'
                        : 'border-slate-200 hover:border-teal-400'
                    }`}
                  >
                    <img src={p.public_url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                    {p.is_primary && (
                      <span className="absolute bottom-0 inset-x-0 bg-teal-800/90 text-white text-[9px] font-black text-center py-0.5">
                        Utama
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Laundry Meta Information */}
        <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-6">
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
                <span>Jam Buka: {laundry.openingTime || '08:00'} - {laundry.closingTime || '20:00'}</span>
              </span>
            </div>

            {laundry.description && (
              <p className="text-xs text-slate-600 pt-2 border-t border-slate-100 leading-relaxed">
                {laundry.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* CATALOG SERVICES & ORDER SELECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600" />
              <span>Katalog Layanan Laundry Aktif</span>
            </h2>
            <span className="text-xs text-slate-500 font-bold">{laundryServices.length} jenis layanan</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {laundryServices.map((service) => {
              const isSelected = selectedServiceId === service.id;
              const qty = quantities[service.id] || (service.unit === 'kg' ? 5 : 1);

              return (
                <div
                  key={service.id}
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-4 bg-white ${
                    isSelected
                      ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <span>{service.name}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2">{service.description}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Tarif Layanan</span>
                      <span className="text-base font-black text-teal-700">
                        {formatIDR(service.price)}
                        <span className="text-xs text-slate-500 font-normal"> / {service.unit}</span>
                      </span>
                    </div>

                    {/* Quantity Stepper */}
                    {isSelected && (
                      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(service.id, Math.max(1, qty - 1))}
                          className="w-7 h-7 rounded-lg bg-white shadow-xs text-slate-700 font-bold flex items-center justify-center hover:bg-slate-200 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-black text-slate-800 w-6 text-center">
                          {qty} {service.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(service.id, qty + 1)}
                          className="w-7 h-7 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center hover:bg-teal-500 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* CUSTOMER REVIEWS SECTION */}
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-teal-600" />
              <span>Ulasan & Ratings Customer ({reviews.length})</span>
            </h3>

            <div className="space-y-3">
              {reviews.map((rev) => (
                <div key={rev.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">{rev.customerName}</span>
                    <span className="flex items-center gap-0.5 text-amber-500 text-xs font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" /> {rev.rating}.0
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 italic">"{rev.comment}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* STICKY CHECKOUT SUMMARY CARD */}
        <div className="lg:col-span-4 sticky top-24">
          <Card variant="white" className="p-6 space-y-6 shadow-xl border-teal-100">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-teal-600" />
                <span>Ringkasan Pesanan</span>
              </h3>
            </div>

            {activeService ? (
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center text-slate-700">
                  <span>Layanan Dipilih</span>
                  <span className="font-bold text-slate-900">{activeService.name}</span>
                </div>

                <div className="flex justify-between items-center text-slate-700">
                  <span>Jumlah Estimasian</span>
                  <span className="font-bold text-slate-900">
                    {currentQuantity} {activeService.unit}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-700">
                  <span>Harga per {activeService.unit}</span>
                  <span className="font-bold text-slate-900">{formatIDR(activeService.price)}</span>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-800 text-sm">Subtotal Estimasian</span>
                  <span className="font-black text-teal-700 text-lg">{formatIDR(subtotal)}</span>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  disabled={!laundry.isOpen}
                  onClick={handleProceedToCheckout}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                  className="w-full mt-4 bg-teal-600 hover:bg-teal-500 font-bold py-3 text-sm"
                >
                  {laundry.isOpen ? 'Lanjut Pilih Alamat Pickup' : 'Toko Sedang Tutup'}
                </Button>

                {!laundry.isOpen && (
                  <p className="text-[11px] text-rose-500 text-center font-medium">
                    Mitra laundry sedang tutup. Silakan pilih mitra laundry lain yang buka.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center">Pilih salah satu layanan untuk melanjutkan.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
