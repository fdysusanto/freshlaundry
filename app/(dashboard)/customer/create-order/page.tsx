'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { laundryService } from '@/services/laundryService';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { DEMO_LAUNDRIES, SERVICE_CATALOG, ServiceCatalogItem, TIME_SLOTS } from '@/utils/constants';
import { isPickupSlotSelectable } from '@/services/dispatchService';
import { formatIDR, isValidUuid } from '@/utils/formatters';
import { ServiceType } from '@/types/order';
import { Laundry } from '@/types/laundry';
import { UserProfile } from '@/types/user';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Sparkles, MapPin, Calendar, Clock, FileText, CheckCircle2, ArrowRight, Store, ArrowLeft, AlertCircle } from 'lucide-react';

function CreateOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const laundryIdParam = searchParams.get('laundryId') || '';
  const initialService = (searchParams.get('service') as ServiceType) || 'kiloan';
  const initialWeight = Number(searchParams.get('weight')) || 5;

  const [currentUser, setCurrentUser] = useState<UserProfile>(authService.getCurrentUser());
  const [laundries, setLaundries] = useState<Laundry[]>([]);
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [selectedLaundryId, setSelectedLaundryId] = useState<string>(laundryIdParam);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form state
  const [pickupAddress, setPickupAddress] = useState(
    currentUser.address || 'Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan'
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    currentUser.address || 'Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan'
  );
  const [pickupDate, setPickupDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [pickupTimeSlot, setPickupTimeSlot] = useState(TIME_SLOTS[0]);
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    return dayAfterTomorrow.toISOString().split('T')[0];
  });
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState(TIME_SLOTS[0]);
  const [estimatedWeightKg, setEstimatedWeightKg] = useState<number>(initialWeight);
  const [notes, setNotes] = useState('');

  const availablePickupSlots = useMemo(() => {
    return TIME_SLOTS.filter((slot) => isPickupSlotSelectable(pickupDate, slot));
  }, [pickupDate]);

  useEffect(() => {
    if (availablePickupSlots.length > 0 && !availablePickupSlots.includes(pickupTimeSlot)) {
      setPickupTimeSlot(availablePickupSlots[0]);
    }
  }, [availablePickupSlots, pickupTimeSlot]);

  // Fetch initial profile & laundries
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        if (isSupabaseConfigured) {
          const profile = await authService.fetchCurrentProfile();
          if (profile && isMounted) {
            setCurrentUser(profile);
            if (profile.address) {
              setPickupAddress(profile.address);
              setDeliveryAddress(profile.address);
            }
          }

          const liveLaundries = await laundryService.getLaundriesAsync();
          if (isMounted) {
            setLaundries(liveLaundries);
            if (liveLaundries.length > 0) {
              const matched = laundryIdParam && isValidUuid(laundryIdParam)
                ? liveLaundries.find((l) => l.id === laundryIdParam)
                : null;
              setSelectedLaundryId(matched ? matched.id : liveLaundries[0].id);
            }
          }
        } else {
          if (isMounted) {
            setLaundries(DEMO_LAUNDRIES);
            const matched = DEMO_LAUNDRIES.find((l) => l.id === laundryIdParam);
            setSelectedLaundryId(matched ? matched.id : DEMO_LAUNDRIES[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) setErrorMessage(err.message || 'Gagal memuat data laundry dari Supabase.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [laundryIdParam]);

  // Load services whenever selectedLaundryId changes
  useEffect(() => {
    let isMounted = true;
    if (!selectedLaundryId) return;

    const loadServices = async () => {
      try {
        if (isSupabaseConfigured) {
          const liveServices = await laundryService.getServicesByLaundryAsync(selectedLaundryId);
          const activeSrvs = liveServices.filter((s) => s.isActive);
          if (isMounted) {
            setServices(activeSrvs);
            if (activeSrvs.length > 0) {
              const matchedService = activeSrvs.find((s) => s.code === initialService) || activeSrvs[0];
              setSelectedServiceId(matchedService.id);
            }
          }
        } else {
          const mockSrvs = SERVICE_CATALOG.filter((s) => s.laundryId === selectedLaundryId && s.isActive);
          if (isMounted) {
            setServices(mockSrvs);
            if (mockSrvs.length > 0) {
              const matchedService = mockSrvs.find((s) => s.code === initialService) || mockSrvs[0];
              setSelectedServiceId(matchedService.id);
            }
          }
        }
      } catch (err: any) {
        console.warn('Gagal memuat layanan laundry:', err);
      }
    };

    loadServices();
    return () => {
      isMounted = false;
    };
  }, [selectedLaundryId, initialService]);

  const selectedLaundry = useMemo(() => {
    return laundries.find((l) => l.id === selectedLaundryId) || laundries[0] || null;
  }, [laundries, selectedLaundryId]);

  const activeCatalog = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || services[0] || null;
  }, [services, selectedServiceId]);

  const estimatedSubtotal = activeCatalog ? activeCatalog.price * estimatedWeightKg : 0;
  const platformFee = 2000;
  const totalPrice = estimatedSubtotal + platformFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupAddress || !pickupDate || !pickupTimeSlot || !deliveryDate || !deliveryTimeSlot || !selectedLaundry || !activeCatalog) {
      setErrorMessage('Harap lengkapi tanggal dan slot waktu penjemputan (pickup) dan pengembalian (delivery).');
      return;
    }

    if (deliveryDate < pickupDate) {
      setErrorMessage('Tanggal delivery tidak boleh lebih awal dari tanggal pickup.');
      return;
    }

    if (deliveryDate === pickupDate) {
      const pickupIdx = TIME_SLOTS.indexOf(pickupTimeSlot);
      const deliveryIdx = TIME_SLOTS.indexOf(deliveryTimeSlot);
      if (pickupIdx !== -1 && deliveryIdx !== -1 && deliveryIdx <= pickupIdx) {
        setErrorMessage('Untuk pengantaran di hari yang sama, slot waktu delivery harus berada setelah slot waktu pickup.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (isSupabaseConfigured) {
        const { data: { session } } = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
        if (!session?.user?.id) {
          router.push('/login');
          return;
        }

        const newOrder = await orderService.createOrderAsync(
          {
            laundryId: selectedLaundry.id,
            serviceType: (activeCatalog.code as ServiceType) || 'kiloan',
            serviceId: activeCatalog.id,
            pickupAddress,
            deliveryAddress,
            pickupDate,
            pickupTimeSlot,
            deliveryDate,
            deliveryTimeSlot,
            estimatedWeightKg,
            notes,
            items: [
              {
                name: activeCatalog.name,
                quantity: estimatedWeightKg,
                unitPrice: activeCatalog.price,
                unit: activeCatalog.unit,
                serviceId: activeCatalog.id,
              },
            ],
          },
          currentUser
        );
        router.push(`/orders/${newOrder.id}`);
      } else {
        const newOrder = orderService.createOrder(
          {
            laundryId: selectedLaundry.id,
            serviceType: (activeCatalog.code as ServiceType) || 'kiloan',
            serviceId: activeCatalog.id,
            pickupAddress,
            deliveryAddress,
            pickupDate,
            pickupTimeSlot,
            deliveryDate,
            deliveryTimeSlot,
            estimatedWeightKg,
            notes,
            items: [
              {
                name: activeCatalog.name,
                quantity: estimatedWeightKg,
                unitPrice: activeCatalog.price,
                unit: activeCatalog.unit,
                serviceId: activeCatalog.id,
              },
            ],
          },
          currentUser
        );
        router.push(`/orders/${newOrder.id}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membuat pesanan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Memuat data marketplace dari Supabase...</p>
      </div>
    );
  }

  if (errorMessage && !selectedLaundry) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <Card variant="white" className="border-red-200 bg-red-50 text-center space-y-4 py-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-red-700">Belum Ada Laundry Tersedia</h2>
          <p className="text-xs text-red-600">{errorMessage}</p>
          <Button onClick={() => router.push('/customer/laundries')} variant="secondary" className="mx-auto">
            Kembali ke Marketplace Laundry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      <div className="space-y-2">
        <button
          onClick={() => router.push('/customer/laundries')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-700 transition-colors mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Cari Laundry di Marketplace
        </button>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
          <Sparkles className="w-4 h-4 text-teal-600" />
          <span>Formulir Pesanan Laundry Marketplace</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Pesan Pickup &amp; Delivery Laundry
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Pilih toko mitra laundry, jenis layanan, dan jadwal penjemputan.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Controls Left Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Select Laundry Partner */}
          <Card variant="white" className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">
                1
              </span>
              Pilih Mitra Laundry
            </h3>

            {laundries.length > 0 ? (
              <select
                value={selectedLaundryId}
                onChange={(e) => setSelectedLaundryId(e.target.value)}
                className="w-full text-xs font-bold p-3 rounded-2xl border border-slate-200 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                {laundries.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {l.address} ({l.rating}★)
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-slate-400 italic">Belum ada laundry aktif di database.</p>
            )}
          </Card>

          {/* Step 2: Catalog Picker */}
          <Card variant="white" className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">
                2
              </span>
              Layanan {selectedLaundry?.name || ''}
            </h3>

            {services.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.map((s) => {
                  const isSelected = activeCatalog?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSelectedServiceId(s.id);
                        if (s.unit === 'pcs' && estimatedWeightKg > 10) setEstimatedWeightKg(2);
                        if (s.unit === 'kg' && estimatedWeightKg < 3) setEstimatedWeightKg(5);
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <p className="font-bold text-xs text-slate-800">{s.name}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{s.description}</p>
                      <p className="text-xs font-bold text-teal-700 mt-1">
                        {formatIDR(s.price)} / {s.unit}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Mitra laundry ini belum memiliki layanan aktif.</p>
            )}

            {activeCatalog && (
              <div className="pt-2">
                <div className="flex justify-between items-center text-xs font-semibold mb-2">
                  <span className="text-slate-600">
                    Estimasi Jumlah ({activeCatalog.unit === 'kg' ? 'Kiloan' : 'Jumlah Pcs'}):
                  </span>
                  <span className="font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200">
                    {estimatedWeightKg} {activeCatalog.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={activeCatalog.unit === 'kg' ? 3 : 1}
                  max={activeCatalog.unit === 'kg' ? 30 : 15}
                  value={estimatedWeightKg}
                  onChange={(e) => setEstimatedWeightKg(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                />
              </div>
            )}
          </Card>

          {/* Step 3: Location Addresses */}
          <Card variant="white" className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">
                3
              </span>
              Lokasi Pickup &amp; Delivery
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-600" /> Alamat Penjemputan (Pickup):
              </label>
              <textarea
                rows={2}
                required
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Alamat lengkap lokasi jemput pakaian..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-sky-600" /> Alamat Pengantaran (Delivery):
              </label>
              <textarea
                rows={2}
                required
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Alamat lengkap lokasi kirim pakaian bersih..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </Card>

          {/* Step 4: Pickup Schedule */}
          <Card variant="white" className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">
                4
              </span>
              Jadwal Penjemputan (Pickup)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" /> Tanggal Pickup:
                </label>
                <input
                  type="date"
                  required
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" /> Slot Waktu Pickup:
                </label>
                <select
                  value={pickupTimeSlot}
                  onChange={(e) => setPickupTimeSlot(e.target.value)}
                  disabled={availablePickupSlots.length === 0}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-medium focus:outline-hidden focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {availablePickupSlots.length > 0 ? (
                    availablePickupSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))
                  ) : (
                    <option value="">Tidak ada slot pickup tersedia hari ini</option>
                  )}
                </select>
                {availablePickupSlots.length === 0 && (
                  <p className="text-[11px] text-amber-700 font-medium mt-1">
                    Tidak ada slot pickup yang tersedia untuk tanggal ini. Silakan pilih tanggal berikutnya.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" /> Catatan Khusus untuk Kurir:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Harap gunakan pelembut lavender, atau hubungi sebelum tiba..."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </Card>

          {/* Step 5: Delivery Schedule */}
          <Card variant="white" className="space-y-4 border-l-4 border-l-indigo-600">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
                  5
                </span>
                Jadwal Pengembalian (Delivery)
              </h3>
              <Badge variant="indigo" className="text-[10px]">Target Delivery</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Tanggal Delivery:
                </label>
                <input
                  type="date"
                  required
                  min={pickupDate}
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" /> Slot Waktu Delivery:
                </label>
                <select
                  value={deliveryTimeSlot}
                  onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Summary Sidebar */}
        <div className="lg:col-span-5">
          <Card variant="slate" className="sticky top-24 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <p className="text-xs font-bold text-teal-400 uppercase tracking-widest">
                Rincian Pemesanan Marketplace
              </p>
              <h3 className="text-lg font-bold text-white mt-1">{activeCatalog?.name || 'Pilih Layanan'}</h3>
              <p className="text-xs text-slate-400">Mitra: {selectedLaundry?.name || '-'}</p>
            </div>

            {activeCatalog ? (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Pemesan:</span>
                  <span className="font-semibold text-white">{currentUser.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tarif per {activeCatalog.unit}:</span>
                  <span className="font-semibold text-white">{formatIDR(activeCatalog.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Jumlah Estimasi:</span>
                  <span className="font-semibold text-white">
                    {estimatedWeightKg} {activeCatalog.unit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Biaya Layanan Platform:</span>
                  <span className="font-semibold text-slate-300">{formatIDR(platformFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ongkos Kirim Pickup &amp; Delivery:</span>
                  <span className="font-bold text-emerald-400">GRATIS</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Pilih layanan di samping untuk melihat kalkulasi.</p>
            )}

            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-400">Total Tagihan:</p>
              <p className="text-3xl font-black text-teal-300 mt-0.5">{formatIDR(totalPrice)}</p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSubmitting || !activeCatalog || !selectedLaundry}
              className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-xl cursor-pointer disabled:opacity-50"
              rightIcon={<ArrowRight className="w-5 h-5" />}
            >
              {isSubmitting ? 'Memproses Order...' : 'Konfirmasi & Buat Pesanan'}
            </Button>
          </Card>
        </div>
      </form>
    </div>
  );
}

export default function CreateOrderPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-500">Memuat form...</div>}>
      <CreateOrderContent />
    </Suspense>
  );
}
