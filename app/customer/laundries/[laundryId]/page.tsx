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
  ChevronLeft,
  ImageIcon,
  Timer,
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
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');

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
            const { photos: fetchedPhotos } = await laundryPhotoService.getPhotosByLaundryAsync(liveLaundry.id);
            setPhotos(fetchedPhotos);

            const liveServices = await laundryService.getServicesByLaundryAsync(liveLaundry.id);
            const activeServices = liveServices.filter((s) => s.isActive);
            setLaundryServices(activeServices);
            // NO AUTO-SELECTION OF SERVICE OR DEFAULT QUANTITY (INITIAL STATE IS 0 / UNSELECTED)
          }
        } else {
          const mockLnd = DEMO_LAUNDRIES.find((l) => l.id === laundryId) || null;
          if (mockLnd && isMounted) {
            setLaundry(mockLnd);
            const mockSrvs = laundryService.getServicesByLaundry(mockLnd.id).filter((s) => s.isActive);
            setLaundryServices(mockSrvs);
            // NO AUTO-SELECTION OF SERVICE OR DEFAULT QUANTITY (INITIAL STATE IS 0 / UNSELECTED)
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

  // Derive photo array for gallery slider
  const photoUrls = useMemo(() => {
    if (photos.length > 0) {
      return photos.map((p) => p.public_url);
    }
    if (laundry?.logoUrl) {
      return [laundry.logoUrl];
    }
    return [FALLBACK_STOREFRONT];
  }, [photos, laundry?.logoUrl]);

  // Handle Photo Swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 30) {
      if (diff > 0) {
        setActivePhotoIndex((prev) => (prev + 1) % photoUrls.length);
      } else {
        setActivePhotoIndex((prev) => (prev - 1 + photoUrls.length) % photoUrls.length);
      }
    }
    setTouchStartX(null);
  };

  // Filter services by category tab
  const categories = useMemo(() => {
    const setCat = new Set<string>();
    laundryServices.forEach((s) => {
      if (s.unit === 'kg') setCat.add('kiloan');
      else setCat.add('satuan');
      if (s.name.toLowerCase().includes('express') || s.estimatedHours <= 12) {
        setCat.add('express');
      }
    });
    return Array.from(setCat);
  }, [laundryServices]);

  const filteredServices = useMemo(() => {
    if (activeCategoryTab === 'all') return laundryServices;
    if (activeCategoryTab === 'kiloan') return laundryServices.filter((s) => s.unit === 'kg');
    if (activeCategoryTab === 'satuan') return laundryServices.filter((s) => s.unit === 'pcs');
    if (activeCategoryTab === 'express') {
      return laundryServices.filter((s) => s.name.toLowerCase().includes('express') || s.estimatedHours <= 12);
    }
    return laundryServices;
  }, [laundryServices, activeCategoryTab]);

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

  const activeService = laundryServices.find((s) => s.id === selectedServiceId);
  const currentQuantity = selectedServiceId ? quantities[selectedServiceId] || 0 : 0;
  const minQuantityThreshold = activeService ? Math.max(1, activeService.minimumQuantity ?? activeService.minWeight ?? 1) : 1;
  const billableQuantity = activeService && currentQuantity > 0 ? Math.max(currentQuantity, minQuantityThreshold) : 0;
  const subtotal = activeService && currentQuantity > 0 ? activeService.price * billableQuantity : 0;

  const handleServiceSelect = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    if (quantities[serviceId] === undefined) {
      setQuantities((prev) => ({ ...prev, [serviceId]: 0 }));
    }
  };

  const handleQuantityChange = (serviceId: string, newQty: number) => {
    if (newQty <= 0) {
      const updated = { ...quantities };
      delete updated[serviceId];
      setQuantities(updated);
      if (selectedServiceId === serviceId) {
        setSelectedServiceId('');
      }
    } else {
      setQuantities((prev) => ({ ...prev, [serviceId]: newQty }));
      setSelectedServiceId(serviceId);
    }
  };

  const handleProceedToCheckout = () => {
    // STRICT CHECKOUT PROTECTION: Block if quantity <= 0 or no active service selected
    if (!activeService || currentQuantity <= 0) return;
    router.push(
      `/customer/checkout?laundryId=${laundry.id}&serviceId=${activeService.id}&qty=${currentQuantity}`
    );
  };

  const activePhoto = photoUrls[activePhotoIndex] || FALLBACK_STOREFRONT;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 pb-32 lg:pb-12">
      
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
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

      {/* STOREFRONT FULL-WIDTH PHOTO GALLERY HERO SECTION */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* Active Hero Image & Gallery Thumbnails */}
        <div className="lg:col-span-6 p-3 sm:p-4 bg-slate-50 space-y-3">
          <div
            className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-slate-200 border border-slate-200 shadow-xs touch-pan-y select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={activePhoto}
              alt={`Foto Outlet ${laundry.name}`}
              onError={(e) => {
                (e.target as HTMLImageElement).src = FALLBACK_STOREFRONT;
              }}
              className="w-full h-full object-cover transition-all duration-300"
            />
            <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-full border border-white/20 flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Outlet Terverifikasi</span>
            </div>

            {/* Gallery Prev/Next Overlay Arrows */}
            {photoUrls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActivePhotoIndex((prev) => (prev - 1 + photoUrls.length) % photoUrls.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900/60 text-white flex items-center justify-center hover:bg-slate-900 z-20 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActivePhotoIndex((prev) => (prev + 1) % photoUrls.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900/60 text-white flex items-center justify-center hover:bg-slate-900 z-20 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Dot Indicators */}
                <div className="absolute bottom-2.5 inset-x-0 flex justify-center gap-1.5 z-20">
                  {photoUrls.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        idx === activePhotoIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Gallery Thumbnail Strip */}
          {photoUrls.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {photoUrls.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`relative w-16 aspect-[4/3] rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                    activePhotoIndex === idx
                      ? 'border-teal-600 ring-2 ring-teal-500/30'
                      : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Laundry Info Header */}
        <div className="lg:col-span-6 p-5 sm:p-8 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">{laundry.name}</h1>
                {laundry.verificationStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> Terverifikasi
                  </span>
                )}
              </div>

              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                laundry.isOpen ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {laundry.isOpen ? '• Buka' : '• Tutup'}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5 font-medium">
              <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
              <span>{laundry.address}</span>
            </p>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1">
              <span className="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{laundry.rating.toFixed(1)}</span>
                <span className="text-slate-500 font-normal">({laundry.totalReviews} ulasan)</span>
              </span>

              {distanceKm !== undefined && (
                <span className="font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200">
                  📍 {distanceKm} km dari Anda
                </span>
              )}

              <span className="flex items-center gap-1 text-slate-600 font-medium">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                <span>Buka: {laundry.openingTime || '08:00'} - {laundry.closingTime || '20:00'}</span>
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

      {/* SERVICE CATEGORY TABS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            <span>Katalog Layanan Laundry</span>
          </h2>
          <span className="text-xs text-slate-500 font-bold">{filteredServices.length} jenis layanan</span>
        </div>

        {/* Category Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategoryTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
              activeCategoryTab === 'all'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Layanan
          </button>
          {categories.includes('kiloan') && (
            <button
              type="button"
              onClick={() => setActiveCategoryTab('kiloan')}
              className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                activeCategoryTab === 'kiloan'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Cuci Kiloan
            </button>
          )}
          {categories.includes('satuan') && (
            <button
              type="button"
              onClick={() => setActiveCategoryTab('satuan')}
              className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                activeCategoryTab === 'satuan'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Cuci Satuan
            </button>
          )}
          {categories.includes('express') && (
            <button
              type="button"
              onClick={() => setActiveCategoryTab('express')}
              className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                activeCategoryTab === 'express'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ⚡ Express
            </button>
          )}
        </div>

        {/* CATALOG SERVICES LIST */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {filteredServices.map((service) => {
                const isSelected = selectedServiceId === service.id;
                const qty = quantities[service.id];
                const hasQuantity = qty !== undefined;
                const estDays = Math.max(1, Math.round((service.estimatedHours || 24) / 24));
                const srvMinQty = Math.max(1, service.minimumQuantity ?? service.minWeight ?? 1);

                return (
                  <div
                    key={service.id}
                    onClick={() => handleServiceSelect(service.id)}
                    className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 bg-white ${
                      isSelected && hasQuantity && qty > 0
                        ? 'border-teal-600 ring-2 ring-teal-500/20 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          <span>{service.name}</span>
                          {isSelected && hasQuantity && qty > 0 && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
                        </h3>
                        {srvMinQty > 1 && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80 shrink-0">
                            Min. charge {srvMinQty} {service.unit}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{service.description}</p>
                    </div>

                    {/* Processing time estimate info */}
                    <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-150">
                      <span className="flex items-center gap-1">
                        <Timer className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span>
                          Estimasi pengerjaan: {service.estimatedHours <= 12 ? `${service.estimatedHours} jam` : `1–${estDays} hari`}
                        </span>
                      </span>
                    </div>

                    {/* Disclosure when selected quantity is below minimum charge */}
                    {isSelected && hasQuantity && qty > 0 && qty < srvMinQty && (
                      <div className="text-[11px] text-slate-600 bg-amber-50/70 p-2 rounded-xl border border-amber-200/60 font-medium">
                        ⓘ Minimum charge berlaku untuk {srvMinQty} {service.unit} ({formatIDR(service.price * srvMinQty)})
                      </div>
                    )}

                    {/* Price & Stepper */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-tight">Tarif</span>
                        <span className="text-sm sm:text-base font-black text-teal-800">
                          {formatIDR(service.price)}
                          <span className="text-xs text-slate-500 font-normal"> / {service.unit}</span>
                        </span>
                      </div>

                      {/* Stepper Controls */}
                      <div onClick={(e) => e.stopPropagation()}>
                        {!hasQuantity ? (
                          <button
                            type="button"
                            onClick={() => {
                              handleServiceSelect(service.id);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                          >
                            <Plus className="w-4 h-4 text-teal-600" />
                            <span>Pilih</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(service.id, qty - 1)}
                              className="w-7 h-7 rounded-lg bg-white shadow-xs text-slate-700 font-bold flex items-center justify-center hover:bg-slate-200 cursor-pointer active:scale-90"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-black text-slate-900 min-w-[3.5rem] text-center">
                              {qty} {service.unit}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(service.id, qty + 1)}
                              className="w-7 h-7 rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center hover:bg-teal-500 cursor-pointer active:scale-90"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
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
                  <div key={rev.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
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

          {/* DESKTOP STICKY CHECKOUT SUMMARY CARD (Hidden on Mobile) */}
          <div className="hidden lg:block lg:col-span-4 sticky top-24">
            <Card variant="white" className="p-6 space-y-6 shadow-xl border-teal-100">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-teal-600" />
                  <span>Ringkasan Pesanan</span>
                </h3>
              </div>

              {activeService && currentQuantity > 0 ? (
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

                  {currentQuantity < minQuantityThreshold && (
                    <div className="flex justify-between items-center text-amber-800 text-[11px] font-semibold bg-amber-50 p-2.5 rounded-xl border border-amber-200/80">
                      <span>Min. Charge ({minQuantityThreshold} {activeService.unit})</span>
                      <span className="font-bold">{formatIDR(subtotal)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-slate-700">
                    <span>Harga per {activeService.unit}</span>
                    <span className="font-bold text-slate-900">{formatIDR(activeService.price)}</span>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                    <span className="font-bold text-slate-800 text-sm">Subtotal Estimasian</span>
                    <span className="font-black text-teal-800 text-lg">{formatIDR(subtotal)}</span>
                  </div>

                  <Button
                    variant="primary"
                    size="md"
                    disabled={!laundry.isOpen || currentQuantity <= 0}
                    onClick={handleProceedToCheckout}
                    rightIcon={<ChevronRight className="w-4 h-4" />}
                    className="w-full mt-4 bg-teal-600 hover:bg-teal-500 font-bold py-3 text-sm"
                  >
                    {laundry.isOpen ? 'Lanjut Pilih Alamat Pickup' : 'Toko Sedang Tutup'}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">
                  Pilih salah satu layanan di atas untuk membuat pesanan.
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* APPROVED STICKY BOTTOM ORDER BAR (MOBILE ONLY) */}
      <div className="lg:hidden fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] inset-x-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 p-3.5 shadow-2xl z-30 flex items-center justify-between gap-3">
        <div>
          {activeService && currentQuantity > 0 ? (
            <>
              <p className="text-xs font-black text-slate-900">
                1 Layanan ({currentQuantity} {activeService.unit})
              </p>
              <p className="text-[10px] font-bold text-slate-500">
                {currentQuantity < minQuantityThreshold
                  ? `Min. charge ${minQuantityThreshold} ${activeService.unit} berlaku (${formatIDR(subtotal)})`
                  : 'Harga final setelah penimbangan'}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-slate-500">Pilih layanan</p>
              <p className="text-[10px] text-slate-400">Tambahkan minimal 1 layanan</p>
            </>
          )}
        </div>

        <Button
          variant="primary"
          size="md"
          disabled={!laundry.isOpen || !activeService || currentQuantity <= 0}
          onClick={handleProceedToCheckout}
          rightIcon={<ChevronRight className="w-4 h-4" />}
          className="bg-teal-600 hover:bg-teal-500 font-bold text-xs px-5 py-2.5 shrink-0 disabled:opacity-50"
        >
          {laundry.isOpen ? 'Lanjut' : 'Tutup'}
        </Button>
      </div>
    </div>
  );
}
