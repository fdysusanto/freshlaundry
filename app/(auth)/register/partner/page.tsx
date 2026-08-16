'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/authService';
import { partnerApplicationService } from '@/services/partnerApplicationService';
import { isSupabaseConfigured } from '@/services/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Sparkles,
  User,
  Mail,
  Lock,
  Phone,
  Store,
  MapPin,
  Clock,
  CreditCard,
  Building,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Check,
  Tag,
} from 'lucide-react';

export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  unit: 'kg' | 'pcs';
  code: string;
}

function PartnerRegisterContent() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');

  // Step 1: Owner Data
  const [ownerName, setOwnerName] = useState('Budi Santoso');
  const [ownerEmail, setOwnerEmail] = useState('budi@example.com');
  const [ownerPhone, setOwnerPhone] = useState('081234567890');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Laundry Data
  const [laundryName, setLaundryName] = useState('Laundry Bersih Cirebon');
  const [laundryAddress, setLaundryAddress] = useState('Jl. Tuparev No. 100, Cirebon');
  const [laundryCity, setLaundryCity] = useState('Cirebon');
  const [laundryDistrict, setLaundryDistrict] = useState('Kedawung');
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('20:00');
  const [latitude, setLatitude] = useState('-6.7063');
  const [longitude, setLongitude] = useState('108.5570');

  // Step 3: Services Catalog
  const [services, setServices] = useState<ServiceItem[]>([
    { id: 'srv_p1', name: 'Cuci Kering', price: 10000, unit: 'kg', code: 'kiloan' },
    { id: 'srv_p2', name: 'Cuci Kering Express', price: 15000, unit: 'kg', code: 'express' },
    { id: 'srv_p3', name: 'Dry Clean', price: 25000, unit: 'pcs', code: 'dry_clean' },
  ]);

  // Inline service creation state
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceUnit, setNewServiceUnit] = useState<'kg' | 'pcs'>('kg');
  const [isAddingService, setIsAddingService] = useState(false);

  // Editing service state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState<'kg' | 'pcs'>('kg');

  // Step 4: Payout Data
  const [accountHolder, setAccountHolder] = useState('Budi Santoso');
  const [bankName, setBankName] = useState('BCA');
  const [accountNumber, setAccountNumber] = useState('1234567890');

  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === '1';

  const [isLoggedInUser, setIsLoggedInUser] = useState(false);
  const [isEmailConfirmationRequired, setIsEmailConfirmationRequired] = useState(false);
  const [isRevisionMode, setIsRevisionMode] = useState(false);
  const [rejectedAppId, setRejectedAppId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkLoggedInState = async () => {
      if (isSupabaseConfigured) {
        const profile = await authService.fetchCurrentProfile();
        if (profile && isMounted) {
          if (profile.role === 'laundry_owner') {
            router.push('/owner');
            return;
          }

          setIsLoggedInUser(true);

          const existingApp = await partnerApplicationService.getPartnerApplicationByUserIdAsync(profile.id);
          if (existingApp && isMounted) {
            if (existingApp.status === 'pending') {
              router.push('/register/partner/status');
              return;
            }
            if (existingApp.status === 'approved') {
              router.push('/owner');
              return;
            }
            if (existingApp.status === 'rejected') {
              if (!isEditMode) {
                router.push('/register/partner/status');
                return;
              }

              setIsRevisionMode(true);
              setRejectedAppId(existingApp.id);
              setOwnerName(existingApp.owner_full_name || profile.fullName || '');
              setOwnerEmail(profile.email || '');
              setOwnerPhone(existingApp.owner_phone || profile.phone || '');
              setLaundryName(existingApp.laundry_name || '');
              setLaundryAddress(existingApp.laundry_address || '');
              setLaundryCity(existingApp.city || '');
              setLaundryDistrict(existingApp.district || '');
              setOpeningTime(existingApp.opening_time ? existingApp.opening_time.slice(0, 5) : '08:00');
              setClosingTime(existingApp.closing_time ? existingApp.closing_time.slice(0, 5) : '20:00');
              setAccountHolder(existingApp.payout_account_holder || profile.fullName || '');
              setBankName(existingApp.payout_bank || 'BCA');
              setAccountNumber(existingApp.payout_account_number || '');

              if (existingApp.services && existingApp.services.length > 0) {
                setServices(
                  existingApp.services.map((s) => ({
                    id: s.id,
                    name: s.name,
                    price: s.price_per_unit,
                    unit: (s.unit as 'kg' | 'pcs') || 'kg',
                    code: s.code || 'kiloan',
                  }))
                );
              }
              return;
            }
          }

          setOwnerName(profile.fullName || '');
          setOwnerEmail(profile.email || '');
          setOwnerPhone(profile.phone || '');
          setAccountHolder(profile.fullName || '');
        }
      }
    };
    checkLoggedInState();
    return () => {
      isMounted = false;
    };
  }, [router, isEditMode]);

  // Validations per step
  const validateStep1 = () => {
    if (!ownerName.trim() || !ownerEmail.trim() || !ownerPhone.trim()) {
      setErrorMessage('Semua bidang pada Data Pemilik wajib diisi.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail.trim())) {
      setErrorMessage('Masukkan alamat email yang valid.');
      return false;
    }
    if (!isLoggedInUser) {
      if (!password || !confirmPassword) {
        setErrorMessage('Password dan konfirmasi password wajib diisi.');
        return false;
      }
      if (password.length < 8) {
        setErrorMessage('Password minimal 8 karakter.');
        return false;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Konfirmasi password tidak cocok.');
        return false;
      }
    }
    setErrorMessage('');
    return true;
  };

  const validateStep2 = () => {
    if (
      !laundryName.trim() ||
      !laundryAddress.trim() ||
      !laundryCity.trim() ||
      !laundryDistrict.trim() ||
      !openingTime ||
      !closingTime
    ) {
      setErrorMessage('Semua bidang pada Data Laundry wajib diisi.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const validateStep3 = () => {
    if (services.length === 0) {
      setErrorMessage('Minimal 1 layanan harus tersedia dalam katalog.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const validateStep4 = () => {
    if (!accountHolder.trim() || !bankName.trim() || !accountNumber.trim()) {
      setErrorMessage('Semua bidang pada Data Payout wajib diisi.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const handleNext = () => {
    setErrorMessage('');
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    if (currentStep === 3 && !validateStep3()) return;
    if (currentStep === 4 && !validateStep4()) return;
    setCurrentStep((prev) => Math.min(prev + 1, 6));
  };

  const handleBack = () => {
    setErrorMessage('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim() || !newServicePrice || isNaN(Number(newServicePrice))) {
      setErrorMessage('Nama layanan dan tarif valid wajib diisi.');
      return;
    }
    const newId = `srv_p${Date.now()}`;
    setServices([
      ...services,
      {
        id: newId,
        name: newServiceName.trim(),
        price: Number(newServicePrice),
        unit: newServiceUnit,
        code: `custom_${Date.now()}`,
      },
    ]);
    setNewServiceName('');
    setNewServicePrice('');
    setNewServiceUnit('kg');
    setIsAddingService(false);
    setErrorMessage('');
  };

  const handleDeleteService = (id: string) => {
    setServices(services.filter((s) => s.id !== id));
  };

  const startEditService = (service: ServiceItem) => {
    setEditingId(service.id);
    setEditName(service.name);
    setEditPrice(service.price.toString());
    setEditUnit(service.unit);
  };

  const saveEditService = (id: string) => {
    if (!editName.trim() || !editPrice || isNaN(Number(editPrice))) {
      setErrorMessage('Nama dan harga layanan harus diisi dengan benar.');
      return;
    }
    setServices(
      services.map((s) =>
        s.id === id ? { ...s, name: editName.trim(), price: Number(editPrice), unit: editUnit } : s
      )
    );
    setEditingId(null);
    setErrorMessage('');
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedApplicationId, setSubmittedApplicationId] = useState('');
  const submittingRef = useRef(false);

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    setErrorMessage('');
    if (!validateStep1() || !validateStep2() || !validateStep3() || !validateStep4()) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      if (isSupabaseConfigured) {
        let currentProfile = await authService.fetchCurrentProfile();

        if (!currentProfile) {
          try {
            const regRes = await authService.registerPartnerAsync(
              ownerName.trim(),
              ownerEmail.trim(),
              password,
              ownerPhone.trim()
            );

            if (regRes.requiresEmailConfirmation || !regRes.hasSession) {
              setIsEmailConfirmationRequired(true);
              return;
            }

            currentProfile = regRes.user;

            if (typeof window !== 'undefined') {
              console.log('[PARTNER-REGISTRATION-FLOW]', {
                mode: 'new_signup',
                sessionAvailable: true,
                existingUser: false,
                applicationCreated: true,
              });
            }
          } catch (regErr: any) {
            const msg = regErr.message?.toLowerCase() || '';
            if (msg.includes('rate limit') || msg.includes('email rate limit exceeded')) {
              throw new Error(
                'Batas pengiriman email Supabase telah tercapai (rate limit). Silakan tunggu beberapa saat sebelum mencoba kembali, atau login jika akun Anda sudah terdaftar.'
              );
            }
            if (
              msg.includes('already registered') ||
              msg.includes('sudah terdaftar') ||
              msg.includes('already in use')
            ) {
              throw new Error(
                'Email ini sudah terdaftar. Silakan login terlebih dahulu untuk melanjutkan pengajuan Mitra Laundry Anda.'
              );
            }
            throw regErr;
          }
        } else {
          if (typeof window !== 'undefined') {
            console.log('[PARTNER-REGISTRATION-FLOW]', {
              mode: 'existing_authenticated_user',
              sessionAvailable: true,
              existingUser: true,
              applicationCreated: true,
            });
          }
        }

        if (!currentProfile) {
          throw new Error('Pendaftaran akun tidak dapat diselesaikan.');
        }

        let applicationRecord;
        if (isRevisionMode && rejectedAppId) {
          applicationRecord = await partnerApplicationService.updatePartnerApplicationRevisionAsync(
            rejectedAppId,
            {
              ownerFullName: ownerName,
              ownerPhone: ownerPhone,
              laundryName: laundryName,
              laundryAddress: laundryAddress,
              city: laundryCity,
              district: laundryDistrict,
              latitude: latitude,
              longitude: longitude,
              openingTime: openingTime,
              closingTime: closingTime,
              payoutAccountHolder: accountHolder,
              payoutBank: bankName,
              payoutAccountNumber: accountNumber,
              services: services,
            }
          );
        } else {
          applicationRecord = await partnerApplicationService.createPartnerApplicationAsync({
            ownerFullName: ownerName,
            ownerPhone: ownerPhone,
            laundryName: laundryName,
            laundryAddress: laundryAddress,
            city: laundryCity,
            district: laundryDistrict,
            latitude: latitude,
            longitude: longitude,
            openingTime: openingTime,
            closingTime: closingTime,
            payoutAccountHolder: accountHolder,
            payoutBank: bankName,
            payoutAccountNumber: accountNumber,
            services: services,
          });
        }

        setSubmittedApplicationId(applicationRecord.id);
      }

      setCurrentStep(6);
    } catch (err: any) {
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('rate limit') || msg.includes('email rate limit exceeded')) {
        setErrorMessage(
          'Batas pengiriman email Supabase telah tercapai (rate limit). Silakan tunggu beberapa saat sebelum mencoba kembali, atau login jika akun Anda sudah terdaftar.'
        );
      } else {
        setErrorMessage(err.message || 'Pengajuan mitra gagal. Periksa kembali koneksi dan data Anda.');
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'Pemilik' },
    { num: 2, label: 'Laundry' },
    { num: 3, label: 'Layanan' },
    { num: 4, label: 'Payout' },
    { num: 5, label: 'Review' },
    { num: 6, label: 'Selesai' },
  ];

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-b from-teal-50/50 via-slate-50 to-white">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/30 mb-1">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Pendaftaran Mitra Laundry
          </h1>
          <p className="text-xs text-slate-500">
            Bergabunglah sebagai mitra resmi FreshWash untuk menjangkau ribuan pelanggan.
          </p>
        </div>

        {/* Multi-Step Indicator */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between relative">
            {stepsList.map((step, idx) => {
              const isCompleted = currentStep > step.num;
              const isActive = currentStep === step.num;
              return (
                <React.Fragment key={step.num}>
                  <div
                    onClick={() => {
                      if (step.num < currentStep) setCurrentStep(step.num);
                    }}
                    className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      step.num < currentStep ? 'hover:opacity-80' : ''
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                        isCompleted
                          ? 'bg-emerald-500 text-white'
                          : isActive
                          ? 'bg-teal-600 text-white ring-4 ring-teal-100 scale-110'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : step.num}
                    </div>
                    <span
                      className={`text-[10px] font-bold tracking-tight ${
                        isActive ? 'text-teal-700' : isCompleted ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < stepsList.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-1 rounded-full ${
                        currentStep > step.num + 0.5 ? 'bg-emerald-400' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between gap-2 animate-shake">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
            {(errorMessage.toLowerCase().includes('login') || errorMessage.toLowerCase().includes('terdaftar')) && (
              <Link href="/login" className="shrink-0 font-bold text-teal-800 underline hover:text-teal-900">
                Ke Halaman Login
              </Link>
            )}
          </div>
        )}

        {/* Card Content Container */}
        <Card variant="white" className="shadow-xl">
          {isEmailConfirmationRequired ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-md">
                <Mail className="w-8 h-8 text-amber-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-slate-900">Registrasi Akun Berhasil</h2>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  Silakan periksa inbox dan konfirmasi email Anda (<strong>{ownerEmail}</strong>) terlebih dahulu.
                </p>
                <p className="text-xs text-slate-500 italic">
                  Setelah email dikonfirmasi, silakan Login untuk menyelesaikan pengajuan Mitra Laundry.
                </p>
              </div>
              <div className="pt-2">
                <Link href="/login">
                  <Button variant="primary" size="lg" className="w-full">
                    Buka Halaman Login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: DATA PEMILIK */}
              {currentStep === 1 && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-600" /> Step 1 — Data Pemilik Usaha
                </h2>
                <p className="text-xs text-slate-500">
                  Lengkapi data identitas pemilik atau penanggung jawab mitra laundry.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Lengkap Pemilik *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Budi Santoso"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Alamat Email Pemilik *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="budi@example.com"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nomor WhatsApp / HP *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      required
                      placeholder="081234567890"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="Minimal 8 karakter..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Konfirmasi Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="Ketik ulang password..."
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleNext}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Lanjut ke Data Laundry
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: DATA LAUNDRY */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-teal-600" /> Step 2 — Data Toko Laundry
                </h2>
                <p className="text-xs text-slate-500">
                  Informasi fisik outlet laundry yang akan ditampilkan kepada pelanggan.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Toko Laundry *
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Laundry Bersih Cirebon"
                      value={laundryName}
                      onChange={(e) => setLaundryName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Alamat Lengkap Outlet *
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <textarea
                      rows={2}
                      required
                      placeholder="Jl. Tuparev No. 100, Cirebon"
                      value={laundryAddress}
                      onChange={(e) => setLaundryAddress(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Kota / Kabupaten *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Cirebon"
                      value={laundryCity}
                      onChange={(e) => setLaundryCity(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Kecamatan *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Kedawung"
                      value={laundryDistrict}
                      onChange={(e) => setLaundryDistrict(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Jam Buka *
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="time"
                        required
                        value={openingTime}
                        onChange={(e) => setOpeningTime(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      Jam Tutup *
                    </label>
                    <div className="relative">
                      <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="time"
                        required
                        value={closingTime}
                        onChange={(e) => setClosingTime(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Geolocation Coordinates Sample */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-teal-600" /> Koordinat Lokasi GPS
                    </span>
                    <Badge variant="teal" className="text-[10px]">
                      PROTOTYPE SAMPLE
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Latitude</span>
                      <input
                        type="text"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white rounded-lg border border-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Longitude</span>
                      <input
                        type="text"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white rounded-lg border border-slate-200 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <Button type="button" variant="outline" size="md" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Kembali
                </Button>
                <Button type="button" variant="primary" size="md" onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Lanjut ke Layanan
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: LAYANAN LAUNDRY */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-teal-600" /> Step 3 — Katalog Layanan Laundry
                  </h2>
                  <p className="text-xs text-slate-500">
                    Kelola daftar paket pencucian, tarif per kg/pcs, dan tipe unit.
                  </p>
                </div>
                {!isAddingService && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddingService(true)}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Tambah Layanan
                  </Button>
                )}
              </div>

              {/* Add New Service Inline Form */}
              {isAddingService && (
                <form onSubmit={handleAddService} className="p-3 bg-teal-50/60 rounded-xl border border-teal-200 space-y-3">
                  <h3 className="text-xs font-bold text-teal-900">Tambah Layanan Baru</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Nama Layanan (mis. Cuci Sepatu)"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      className="px-3 py-2 text-xs bg-white rounded-lg border border-teal-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="number"
                      placeholder="Tarif (Rp)"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(e.target.value)}
                      className="px-3 py-2 text-xs bg-white rounded-lg border border-teal-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                    <select
                      value={newServiceUnit}
                      onChange={(e) => setNewServiceUnit(e.target.value as 'kg' | 'pcs')}
                      className="px-3 py-2 text-xs bg-white rounded-lg border border-teal-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="kg">per Kg</option>
                      <option value="pcs">per Pcs / Satuan</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingService(false)}>
                      Batal
                    </Button>
                    <Button type="submit" variant="primary" size="sm">
                      Simpan Layanan
                    </Button>
                  </div>
                </form>
              )}

              {/* Service Catalog List */}
              <div className="space-y-2">
                {services.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs font-semibold text-rose-600">Minimal 1 layanan harus tersedia.</p>
                  </div>
                ) : (
                  services.map((service) => (
                    <div
                      key={service.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
                    >
                      {editingId === service.id ? (
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-2.5 py-1 text-xs bg-white rounded-lg border border-slate-300"
                          />
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="px-2.5 py-1 text-xs bg-white rounded-lg border border-slate-300"
                          />
                          <div className="flex items-center gap-1">
                            <select
                              value={editUnit}
                              onChange={(e) => setEditUnit(e.target.value as 'kg' | 'pcs')}
                              className="px-2 py-1 text-xs bg-white rounded-lg border border-slate-300"
                            >
                              <option value="kg">/ kg</option>
                              <option value="pcs">/ pcs</option>
                            </select>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => saveEditService(service.id)}
                            >
                              OK
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-800">{service.name}</p>
                            <p className="text-[11px] font-semibold text-teal-700">
                              Rp {service.price.toLocaleString('id-ID')} / {service.unit}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEditService(service)}
                              className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit Layanan"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteService(service.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Layanan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 flex justify-between">
                <Button type="button" variant="outline" size="md" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Kembali
                </Button>
                <Button type="button" variant="primary" size="md" onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Lanjut ke Data Payout
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: DATA PAYOUT */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-teal-600" /> Step 4 — Data Rekening Payout
                </h2>
                <p className="text-xs text-slate-500">
                  Rekening bank untuk pencairan hasil transaksi laundry mitra secara berkala.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Pemilik Rekening *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Budi Santoso"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nama Bank *
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                    >
                      <option value="BCA">Bank BCA</option>
                      <option value="Mandiri">Bank Mandiri</option>
                      <option value="BRI">Bank BRI</option>
                      <option value="BNI">Bank BNI</option>
                      <option value="CIMB">Bank CIMB Niaga</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nomor Rekening Bank *
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="1234567890"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <Button type="button" variant="outline" size="md" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Kembali
                </Button>
                <Button type="button" variant="primary" size="md" onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Lanjut ke Review Data
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" /> Step 5 — Review & Konfirmasi Data
                </h2>
                <p className="text-xs text-slate-500">
                  Periksa kembali ringkasan pengajuan sebelum dikirimkan ke tim verifikasi.
                </p>
              </div>

              <div className="space-y-3">
                {/* Section Pemilik */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-teal-600" /> Data Pemilik
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs font-bold text-teal-700 hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-slate-500">Nama:</span> <strong className="text-slate-800">{ownerName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Email:</span> <strong className="text-slate-800">{ownerEmail}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">No. WA:</span> <strong className="text-slate-800">{ownerPhone}</strong>
                    </div>
                  </div>
                </div>

                {/* Section Laundry */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-teal-600" /> Data Toko Laundry
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs font-bold text-teal-700 hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="space-y-1 text-xs pt-1">
                    <p>
                      <span className="text-slate-500">Toko:</span> <strong className="text-slate-800">{laundryName}</strong>
                    </p>
                    <p>
                      <span className="text-slate-500">Alamat:</span>{' '}
                      <span className="text-slate-700 font-medium">
                        {laundryAddress}, {laundryDistrict}, {laundryCity}
                      </span>
                    </p>
                    <p>
                      <span className="text-slate-500">Jam Operasional:</span>{' '}
                      <strong className="text-slate-800">
                        {openingTime} - {closingTime} WIB
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Section Layanan */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-teal-600" /> Katalog Layanan ({services.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="text-xs font-bold text-teal-700 hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                  <ul className="divide-y divide-slate-200/60 text-xs pt-1">
                    {services.map((s) => (
                      <li key={s.id} className="py-1 flex justify-between">
                        <span className="font-semibold text-slate-700">{s.name}</span>
                        <span className="font-bold text-teal-800">
                          Rp {s.price.toLocaleString('id-ID')} / {s.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Section Payout */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-teal-600" /> Rekening Payout
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      className="text-xs font-bold text-teal-700 hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-slate-500">Bank:</span> <strong className="text-slate-800">{bankName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">No. Rekening:</span>{' '}
                      <strong className="text-slate-800 font-mono">{accountNumber}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Atas Nama:</span>{' '}
                      <strong className="text-slate-800">{accountHolder}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <Button type="button" variant="outline" size="md" onClick={handleBack} disabled={isSubmitting} leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Kembali
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  rightIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  {isSubmitting ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Mitra'}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 6: SUCCESS (LIVE SUBMISSION STATUS) */}
          {currentStep === 6 && (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-lg shadow-amber-600/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <Badge variant="amber" className="font-bold px-3 py-1">
                  PENDING VERIFICATION
                </Badge>
                <h2 className="text-xl font-black text-slate-900">Pengajuan Mitra Berhasil</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Pengajuan untuk toko <strong>{laundryName}</strong> telah berhasil dikirimkan dan sedang menunggu verifikasi admin.
                </p>
                {submittedApplicationId && (
                  <p className="text-[11px] font-mono text-slate-400">
                    ID Pengajuan: {submittedApplicationId}
                  </p>
                )}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-left mt-2">
                  <p className="font-bold text-slate-700 mb-1">Informasi Tahap Selanjutnya:</p>
                  <p className="leading-relaxed">
                    Tim FreshLaundry akan melakukan verifikasi data usaha Anda. Kami akan menghubungi nomor WhatsApp <strong>{ownerPhone}</strong> setelah proses verifikasi selesai.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-2 justify-center">
                <Link href="/register/partner/status">
                  <Button variant="primary" size="lg" className="w-full sm:w-auto">
                    Cek Status Pengajuan
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Kembali ke Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
      </div>
    </div>
  );
}

export default function PartnerRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[85vh] flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <PartnerRegisterContent />
    </Suspense>
  );
}
