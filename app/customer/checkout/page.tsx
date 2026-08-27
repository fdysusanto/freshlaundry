'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { customerAddressService } from '@/services/customerAddressService';
import { DEMO_LAUNDRIES, SERVICE_CATALOG, ServiceCatalogItem, TIME_SLOTS } from '@/utils/constants';
import { ServiceType } from '@/types/order';
import { CustomerAddress, AddressSnapshot } from '@/types/address';
import { formatIDR, isValidUuid } from '@/utils/formatters';
import { supabase } from '@/services/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AddressSelectorModal } from '@/components/address/AddressSelectorModal';
import {
  Sparkles,
  MapPin,
  Calendar,
  Clock,
  FileText,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Store,
  Check,
  User,
  Phone,
  AlertCircle,
} from 'lucide-react';

import { laundryService } from '@/services/laundryService';
import { isSupabaseConfigured } from '@/services/supabase';
import { Laundry } from '@/types/laundry';
import { triggerPaymentFlow } from '@/utils/midtransSnap';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const laundryIdParam = searchParams.get('laundryId') || '';
  const serviceIdParam = searchParams.get('serviceId') || '';
  const qtyParam = Number(searchParams.get('qty')) || 5;

  const currentUser = authService.getCurrentUser();

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [selectedLaundry, setSelectedLaundry] = useState<Laundry | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceCatalogItem | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Customer Saved Addresses State
  const [selectedPickupAddress, setSelectedPickupAddress] = useState<CustomerAddress | null>(null);
  const [selectedDeliveryAddress, setSelectedDeliveryAddress] = useState<CustomerAddress | null>(null);
  const [useSameAddress, setUseSameAddress] = useState(true);

  const [isPickupSelectorOpen, setIsPickupSelectorOpen] = useState(false);
  const [isDeliverySelectorOpen, setIsDeliverySelectorOpen] = useState(false);

  // Form State
  const [pickupAddress, setPickupAddress] = useState(currentUser?.address || '');
  const [deliveryAddress, setDeliveryAddress] = useState(currentUser?.address || '');
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
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadCheckoutData = async () => {
      setIsLoadingData(true);
      setErrorMessage('');

      try {
        if (isSupabaseConfigured) {
          const { data: { session } } = await (supabase?.auth?.getSession() || Promise.resolve({ data: { session: null } }));
          if (!session?.user) {
            if (isMounted) {
              router.push('/login');
            }
            return;
          }

          const liveProfile = await authService.fetchCurrentProfile();
          if (!liveProfile) {
            if (isMounted) router.push('/login');
            return;
          }

          if (liveProfile.role !== 'customer') {
            if (isMounted) {
              if (liveProfile.role === 'courier') router.push('/courier');
              else if (liveProfile.role === 'laundry_owner' || liveProfile.role === 'laundry_staff') router.push('/owner');
              else if (liveProfile.role === 'admin' || liveProfile.role === 'platform_admin') router.push('/admin');
              else router.push('/');
            }
            return;
          }

          // Fetch default customer address from address book
          const defaultAddr = await customerAddressService.getDefaultAddressAsync();
          if (isMounted && defaultAddr) {
            setSelectedPickupAddress(defaultAddr);
            setSelectedDeliveryAddress(defaultAddr);
            const snapshot = customerAddressService.createSnapshotFromAddress(defaultAddr);
            setPickupAddress(snapshot.formatted_address || defaultAddr.addressDetail);
            setDeliveryAddress(snapshot.formatted_address || defaultAddr.addressDetail);
          }

          // Fetch active laundries from Supabase
          const liveLaundries = await laundryService.getLaundriesAsync();

          let laundryMatch: Laundry | null = null;
          if (laundryIdParam && isValidUuid(laundryIdParam)) {
            laundryMatch = liveLaundries.find((l) => l.id === laundryIdParam) || null;
            if (!laundryMatch) {
              laundryMatch = await laundryService.getLaundryByIdAsync(laundryIdParam);
            }
          }

          if (!laundryMatch && liveLaundries.length > 0) {
            laundryMatch = liveLaundries[0];
          }

          if (!laundryMatch) {
            if (isMounted) {
              setErrorMessage('Belum ada laundry aktif di database Supabase.');
              setIsLoadingData(false);
            }
            return;
          }

          // Fetch active services for selected laundry from Supabase
          const liveServices = await laundryService.getServicesByLaundryAsync(laundryMatch.id);

          let serviceMatch: ServiceCatalogItem | null = null;
          if (serviceIdParam && isValidUuid(serviceIdParam)) {
            serviceMatch = liveServices.find((s) => s.id === serviceIdParam) || null;
            if (!serviceMatch) {
              serviceMatch = await laundryService.getServiceByIdAsync(serviceIdParam);
            }
          }

          if (!serviceMatch && liveServices.length > 0) {
            serviceMatch = liveServices[0];
          }

          if (!serviceMatch) {
            if (isMounted) {
              setErrorMessage('Belum ada layanan aktif di database Supabase untuk laundry yang dipilih.');
              setIsLoadingData(false);
            }
            return;
          }

          if (isMounted) {
            setSelectedLaundry(laundryMatch);
            setSelectedService(serviceMatch);
          }
        } else {
          // Fallback only when Supabase is unconfigured
          const currentUserSync = authService.getCurrentUserSync();
          if (currentUserSync && currentUserSync.role !== 'customer') {
            if (isMounted) {
              if (currentUserSync.role === 'courier') router.push('/courier');
              else if (currentUserSync.role === 'laundry_owner' || currentUserSync.role === 'laundry_staff') router.push('/owner');
              else if (currentUserSync.role === 'admin' || currentUserSync.role === 'platform_admin') router.push('/admin');
              else router.push('/');
            }
            return;
          }

          const mockLaundries = DEMO_LAUNDRIES;
          const mockLnd = mockLaundries.find((l) => l.id === laundryIdParam) || mockLaundries[0];
          const mockServices = SERVICE_CATALOG;
          const mockSrv = mockServices.find((s) => s.id === serviceIdParam) || mockServices[0];
          if (isMounted) {
            setSelectedLaundry(mockLnd);
            setSelectedService(mockSrv);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Gagal memuat data checkout dari Supabase.');
        }
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };

    loadCheckoutData();
  }, [laundryIdParam, serviceIdParam]);

  // Handle Pickup Address selection from modal
  const handleSelectPickupAddress = (addr: CustomerAddress) => {
    setSelectedPickupAddress(addr);
    const snapshot = customerAddressService.createSnapshotFromAddress(addr);
    setPickupAddress(snapshot.formatted_address || addr.addressDetail);

    if (useSameAddress) {
      setSelectedDeliveryAddress(addr);
      setDeliveryAddress(snapshot.formatted_address || addr.addressDetail);
    }
  };

  // Handle Delivery Address selection from modal
  const handleSelectDeliveryAddress = (addr: CustomerAddress) => {
    setSelectedDeliveryAddress(addr);
    const snapshot = customerAddressService.createSnapshotFromAddress(addr);
    setDeliveryAddress(snapshot.formatted_address || addr.addressDetail);
  };

  // Toggle same address
  const handleToggleSameAddress = (checked: boolean) => {
    setUseSameAddress(checked);
    if (checked && selectedPickupAddress) {
      setSelectedDeliveryAddress(selectedPickupAddress);
      const snapshot = customerAddressService.createSnapshotFromAddress(selectedPickupAddress);
      setDeliveryAddress(snapshot.formatted_address || selectedPickupAddress.addressDetail);
    }
  };

  // Fee Calculation
  const unitPrice = selectedService?.price || 0;
  const subtotal = unitPrice * qtyParam;
  const pickupFee = 0; // Promo Gratis
  const deliveryFee = 0; // Promo Gratis
  const platformFee = 2000;
  const discount = 0;
  const totalPrice = subtotal + pickupFee + deliveryFee + platformFee - discount;

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupAddress || !pickupDate || !pickupTimeSlot) return;

    if (!selectedLaundry || !selectedService) {
      setErrorMessage('Layanan atau Laundry belum dipilih secara valid.');
      return;
    }

    if (isSupabaseConfigured) {
      if (!isValidUuid(selectedLaundry.id)) {
        setErrorMessage('Gagal Checkout: ID Laundry bukan UUID Supabase yang valid.');
        return;
      }
      if (!isValidUuid(selectedService.id)) {
        setErrorMessage('Gagal Checkout: ID Layanan bukan UUID Supabase yang valid.');
        return;
      }
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      let accessToken: string | undefined;
      let sessionUserId: string | undefined;

      if (isSupabaseConfigured && supabase) {
        const { data } = await supabase.auth.getSession();
        accessToken = data.session?.access_token;
        sessionUserId = data.session?.user?.id;
      }

      if (isSupabaseConfigured && (!sessionUserId || !isValidUuid(sessionUserId))) {
        setErrorMessage('Anda harus login terlebih dahulu dengan akun Supabase Auth sebelum membuat pesanan.');
        setIsLoading(false);
        return;
      }

      const pickupSnapshot = selectedPickupAddress
        ? customerAddressService.createSnapshotFromAddress(selectedPickupAddress)
        : undefined;
      const deliverySnapshot = selectedDeliveryAddress
        ? customerAddressService.createSnapshotFromAddress(selectedDeliveryAddress)
        : undefined;

      const idempotencyKey = `IDEMP-FE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          laundryId: selectedLaundry.id,
          serviceType: (selectedService.code as ServiceType) || 'kiloan',
          items: [
            {
              serviceId: selectedService.id,
              quantity: qtyParam,
            },
          ],
          pickupAddress,
          deliveryAddress: useSameAddress ? pickupAddress : deliveryAddress,
          pickupAddressSnapshot: pickupSnapshot,
          deliveryAddressSnapshot: useSameAddress ? pickupSnapshot : deliverySnapshot,
          pickupDate,
          pickupTimeSlot,
          deliveryDate,
          deliveryTimeSlot,
          estimatedWeightKg: qtyParam,
          notes,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal memproses checkout via API.');
      }

      const paymentToken = data.payment?.paymentToken || data.payment?.rawResponse?.token;
      const paymentUrl = data.payment?.paymentUrl || data.payment?.rawResponse?.redirect_url;
      const invoiceUrl = data.payment?.invoiceUrl || data.payment?.rawResponse?.invoice_url;

      const triggered = triggerPaymentFlow({
        paymentToken,
        paymentUrl,
        invoiceUrl,
        onSuccess: () => {
          router.push(`/orders/${data.order.id}?payment=success`);
        },
        onPending: () => {
          router.push(`/orders/${data.order.id}?payment=pending`);
        },
        onError: (errMsg) => {
          setErrorMessage(errMsg || 'Gagal memproses pembayaran via gateway.');
        },
        onClose: () => {
          router.push(`/orders/${data.order.id}`);
        },
      });

      if (!triggered) {
        router.push(`/orders/${data.order.id}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membuat pesanan di Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Memuat data laundry &amp; alamat tersimpan...</p>
      </div>
    );
  }

  if (errorMessage && (!selectedLaundry || !selectedService)) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <Card variant="white" className="border-red-200 bg-red-50 text-center space-y-4 py-8">
          <h2 className="text-lg font-bold text-red-700">Gagal Memuat Data Checkout</h2>
          <p className="text-xs text-red-600">{errorMessage}</p>
          <Button onClick={() => router.push('/customer/laundries')} variant="secondary" className="mx-auto">
            Kembali ke Daftar Laundry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Back nav & Header */}
      <div className="space-y-3">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
          <Sparkles className="w-4 h-4 text-teal-600" />
          <span>Checkout Pemesanan Marketplace</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Ringkasan &amp; Konfirmasi Order
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Periksa rincian mitra laundry, alamat penjemputan, dan kalkulasi biaya sebelum membuat pesanan.
        </p>
      </div>

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Laundry Locked & Address Schedule */}
        <div className="lg:col-span-7 space-y-6">
          {/* Locked Selected Laundry Card */}
          <Card variant="white" className="space-y-3 border-teal-200 bg-teal-50/30">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-4 h-4 text-teal-600" />
                <span>Mitra Laundry Terpilih:</span>
              </span>
              <Badge variant="teal" size="sm">
                Terkunci
              </Badge>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="w-12 h-12 rounded-2xl bg-teal-700 text-white font-black text-lg flex items-center justify-center shrink-0">
                {selectedLaundry?.name?.charAt(0) || 'L'}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedLaundry?.name}</h3>
                <p className="text-xs text-slate-500 line-clamp-1">{selectedLaundry?.address}</p>
              </div>
            </div>
          </Card>

          {/* Form Step 1: Addresses */}
          <Card variant="white" className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">
                  1
                </span>
                Lokasi Penjemputan &amp; Pengantaran
              </h3>
            </div>

            {/* PICKUP ADDRESS SECTION */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700 uppercase flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-600" /> Alamat Penjemputan (Pickup):
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPickupSelectorOpen(true)}
                  className="text-xs font-bold border-teal-200 text-teal-700 hover:bg-teal-50"
                >
                  Pilih Alamat Tersimpan
                </Button>
              </div>

              {selectedPickupAddress ? (
                <div className="p-3.5 rounded-2xl border border-teal-300 bg-teal-50/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900">{selectedPickupAddress.label}</span>
                    {selectedPickupAddress.isDefault && (
                      <Badge variant="teal" className="text-[9px] font-bold">
                        DEFAULT
                      </Badge>
                    )}
                  </div>
                  <p className="font-bold text-slate-800">
                    {selectedPickupAddress.recipientName} ({selectedPickupAddress.phone})
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    {selectedPickupAddress.addressDetail}, Kel. {selectedPickupAddress.villageName}, Kec. {selectedPickupAddress.districtName}, {selectedPickupAddress.cityName}, {selectedPickupAddress.provinceName} ({selectedPickupAddress.postalCode})
                  </p>
                </div>
              ) : (
                <textarea
                  rows={2}
                  required
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Alamat lengkap lokasi penjemputan pakaian..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500"
                />
              )}
            </div>

            {/* SAME ADDRESS CHECKBOX */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
              <input
                type="checkbox"
                id="sameAddressCheck"
                checked={useSameAddress}
                onChange={(e) => handleToggleSameAddress(e.target.checked)}
                className="w-4 h-4 accent-teal-600 rounded-sm cursor-pointer"
              />
              <label htmlFor="sameAddressCheck" className="font-bold text-slate-800 cursor-pointer">
                Alamat pengantaran sama dengan alamat penjemputan
              </label>
            </div>

            {/* DELIVERY ADDRESS SECTION (If unchecked) */}
            {!useSameAddress && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-sky-600" /> Alamat Pengantaran (Delivery):
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDeliverySelectorOpen(true)}
                    className="text-xs font-bold border-sky-200 text-sky-700 hover:bg-sky-50"
                  >
                    Pilih Alamat Lain
                  </Button>
                </div>

                {selectedDeliveryAddress ? (
                  <div className="p-3.5 rounded-2xl border border-sky-300 bg-sky-50/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-900">{selectedDeliveryAddress.label}</span>
                    </div>
                    <p className="font-bold text-slate-800">
                      {selectedDeliveryAddress.recipientName} ({selectedDeliveryAddress.phone})
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      {selectedDeliveryAddress.addressDetail}, Kel. {selectedDeliveryAddress.villageName}, Kec. {selectedDeliveryAddress.districtName}, {selectedDeliveryAddress.cityName}, {selectedDeliveryAddress.provinceName} ({selectedDeliveryAddress.postalCode})
                    </p>
                  </div>
                ) : (
                  <textarea
                    rows={2}
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Alamat lengkap lokasi pengantaran pakaian bersih..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500"
                  />
                )}
              </div>
            )}
          </Card>

          {/* Form Step 2: Pickup Schedule */}
          <Card variant="white" className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">
                2
              </span>
              Jadwal Penjemputan (Pickup)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" /> Tanggal Pickup:
                </label>
                <input
                  type="date"
                  required
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" /> Slot Waktu Pickup:
                </label>
                <select
                  value={pickupTimeSlot}
                  onChange={(e) => setPickupTimeSlot(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" /> Catatan Khusus Pakaian / Kurir:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Harap gunakan pelembut lavender, atau hubungi sebelum tiba..."
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </Card>

          {/* Form Step 3: Delivery Schedule */}
          <Card variant="white" className="space-y-4 border-l-4 border-l-indigo-600">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-bold">
                  3
                </span>
                Jadwal Pengembalian (Delivery)
              </h3>
              <Badge variant="indigo" className="text-[10px]">Target Pengantaran</Badge>
            </div>
            <p className="text-xs text-slate-500">
              Tentukan target tanggal &amp; slot waktu saat paket laundry Anda dikembalikan dalam kondisi bersih dan rapi.
            </p>

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
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" /> Slot Waktu Delivery:
                </label>
                <select
                  value={deliveryTimeSlot}
                  onChange={(e) => setDeliveryTimeSlot(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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

        {/* Right Column: Fee Breakdown & Submit CTA */}
        <div className="lg:col-span-5">
          <Card variant="slate" className="sticky top-24 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <p className="text-xs font-bold text-teal-400 uppercase tracking-widest">
                Rincian Biaya Transparan
              </p>
              <h3 className="text-lg font-bold text-white mt-1">{selectedService?.name}</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Pemesan:</span>
                <span className="font-semibold text-white">{currentUser?.fullName || 'Pelanggan'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">No. WhatsApp:</span>
                <span className="font-semibold text-white">{currentUser?.phone || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tarif per {selectedService?.unit}:</span>
                <span className="font-semibold text-white">{formatIDR(selectedService?.price || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Jumlah Estimasi:</span>
                <span className="font-bold text-teal-300">
                  {qtyParam} {selectedService?.unit}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Subtotal Layanan:</span>
                  <span className="font-bold text-white">{formatIDR(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ongkos Kirim Pickup &amp; Delivery:</span>
                  <span className="font-bold text-emerald-400">GRATIS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Biaya Layanan Platform:</span>
                  <span className="font-semibold text-slate-300">{formatIDR(platformFee)}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-400">Total Tagihan Pemesanan:</p>
              <p className="text-3xl font-black text-teal-300 mt-0.5">{formatIDR(totalPrice)}</p>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 text-[11px] text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 text-teal-300 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Pembersihan Higienis Garansi 100%</span>
              </div>
              <p className="text-slate-400">
                Penimbangan berat sebenarnya akan dikonfirmasi ulang oleh kurir/laundry saat proses penjemputan.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-rose-200">Gagal Membuat Pesanan</p>
                  <p className="text-rose-300 leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading}
              className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-xl cursor-pointer"
              rightIcon={<ArrowRight className="w-5 h-5" />}
            >
              {isLoading ? 'Memproses Order...' : 'Konfirmasi & Buat Pesanan'}
            </Button>
          </Card>
        </div>
      </form>

      {/* Address Selector Modals */}
      <AddressSelectorModal
        isOpen={isPickupSelectorOpen}
        onClose={() => setIsPickupSelectorOpen(false)}
        onSelectAddress={handleSelectPickupAddress}
        selectedAddressId={selectedPickupAddress?.id}
        title="Pilih Alamat Penjemputan (Pickup)"
      />

      <AddressSelectorModal
        isOpen={isDeliverySelectorOpen}
        onClose={() => setIsDeliverySelectorOpen(false)}
        onSelectAddress={handleSelectDeliveryAddress}
        selectedAddressId={selectedDeliveryAddress?.id}
        title="Pilih Alamat Pengantaran (Delivery)"
      />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-500">Memuat rincian checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
