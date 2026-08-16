'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { SERVICE_CATALOG, ServiceCatalogItem } from '@/utils/constants';
import { laundryService } from '@/services/laundryService';
import { isSupabaseConfigured } from '@/services/supabase';
import { formatIDR } from '@/utils/formatters';
import { ServiceType } from '@/types/order';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Calculator, ArrowRight, CheckCircle2 } from 'lucide-react';

export const PriceCalculator: React.FC = () => {
  const router = useRouter();
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [amount, setAmount] = useState<number>(5);

  useEffect(() => {
    let isMounted = true;
    const loadServices = async () => {
      try {
        if (isSupabaseConfigured) {
          const liveLaundries = await laundryService.getLaundriesAsync();
          if (liveLaundries.length > 0) {
            const liveServices = await laundryService.getServicesByLaundryAsync(liveLaundries[0].id);
            const activeSrvs = liveServices.filter((s) => s.isActive);
            if (isMounted && activeSrvs.length > 0) {
              setServices(activeSrvs);
              setSelectedServiceId(activeSrvs[0].id);
              return;
            }
          }
          if (isMounted) setServices([]);
        } else {
          if (isMounted) {
            setServices(SERVICE_CATALOG);
            setSelectedServiceId(SERVICE_CATALOG[0].id);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat layanan kalkulator dari Supabase:', err);
        if (isMounted && !isSupabaseConfigured) {
          setServices(SERVICE_CATALOG);
          setSelectedServiceId(SERVICE_CATALOG[0].id);
        } else if (isMounted) {
          setServices([]);
        }
      }
    };

    loadServices();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeCatalog = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || services[0] || null;
  }, [services, selectedServiceId]);

  const totalPrice = activeCatalog ? activeCatalog.price * amount : 0;

  return (
    <section id="price-calculator" className="py-16 sm:py-24 bg-slate-50 border-y border-slate-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold">
            <Calculator className="w-4 h-4" />
            <span>Kalkulator Transparan</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Hitung Estimasi Biaya Laundry Anda
          </h2>
          <p className="text-slate-600 text-sm">
            Tanpa biaya tersembunyi! Pilih jenis layanan dan estimasi jumlah pakaian Anda.
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Service Picker */}
          <div className="lg:col-span-7 space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Pilih Jenis Layanan Laundry:
            </label>
            {services.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.map((s) => {
                  const isSelected = selectedServiceId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedServiceId(s.id);
                        if (s.unit === 'pcs' && amount > 10) setAmount(2);
                        if (s.unit === 'kg' && amount < 3) setAmount(5);
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-teal-600 bg-white shadow-lg shadow-teal-950/5 ring-2 ring-teal-500/20'
                          : 'border-slate-200 bg-white/60 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-slate-800">{s.name}</span>
                        {s.badge && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-bold">
                            {s.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-2">{s.description}</p>
                      <p className="text-xs font-bold text-teal-700">
                        {formatIDR(s.price)} / {s.unit}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400 italic">
                Belum ada layanan aktif yang dapat dikalkulasi.
              </div>
            )}

            {/* Slider / Counter */}
            {activeCatalog && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 mt-6">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    2. Jumlah ({activeCatalog.unit === 'kg' ? 'Berat Kiloan' : 'Jumlah Pcs'}):
                  </label>
                  <span className="text-base font-black text-teal-700 bg-teal-50 px-3 py-1 rounded-xl border border-teal-200">
                    {amount} {activeCatalog.unit}
                  </span>
                </div>

                <input
                  type="range"
                  min={activeCatalog.unit === 'kg' ? 3 : 1}
                  max={activeCatalog.unit === 'kg' ? 30 : 15}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                />

                <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                  <span>Min: {activeCatalog.unit === 'kg' ? '3 kg' : '1 pcs'}</span>
                  <span>Max: {activeCatalog.unit === 'kg' ? '30 kg' : '15 pcs'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Result Summary Card */}
          <div className="lg:col-span-5">
            <Card variant="slate" className="space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="border-b border-slate-800 pb-4">
                <p className="text-xs font-bold text-teal-400 uppercase tracking-widest">
                  Ringkasan Estimasi
                </p>
                <h3 className="text-lg font-bold text-white mt-1">{activeCatalog?.name || 'Pilih Layanan'}</h3>
              </div>

              {activeCatalog ? (
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tarif Dasar:</span>
                    <span className="font-semibold text-white">
                      {formatIDR(activeCatalog.price)} / {activeCatalog.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Jumlah Pesanan:</span>
                    <span className="font-semibold text-white">
                      {amount} {activeCatalog.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Biaya Pickup &amp; Delivery:</span>
                    <span className="font-bold text-emerald-400">GRATIS</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Estimasi Selesai:</span>
                    <span className="font-semibold text-teal-300">{activeCatalog.estimatedTime}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Layanan tidak tersedia.</p>
              )}

              <div className="pt-4 border-t border-slate-800">
                <p className="text-xs text-slate-400">Total Biaya Estimasi:</p>
                <p className="text-3xl font-black text-teal-300 mt-0.5">{formatIDR(totalPrice)}</p>
              </div>

              <div className="space-y-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Penimbangan akhir dilakukan transparan oleh kurir</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Pembayaran saat laundry telah selesai dikirim</span>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                disabled={!activeCatalog}
                onClick={() =>
                  router.push(
                    `/customer/create-order?service=${activeCatalog?.code || 'kiloan'}&weight=${amount}`
                  )
                }
                rightIcon={<ArrowRight className="w-5 h-5" />}
                className="w-full mt-2"
              >
                Pesan Sekarang
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};
