'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/authService';
import { partnerApplicationService } from '@/services/partnerApplicationService';
import { locationService } from '@/services/locationService';
import { normalizeServiceType, VALID_SERVICE_TYPE_CODES } from '@/utils/serviceCodeUtils';
import { isSupabaseConfigured } from '@/services/supabase';
import { MapLocationPicker } from '@/components/address/MapLocationPicker';
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

export function formatEstimatedTimeText(hours?: number | null): string {
  if (!hours || hours <= 0) return '-';
  if (hours < 24) return `${hours} Jam`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  if (rem === 0) return `${days} Hari`;
  return `${days} Hari ${rem} Jam`;
}

export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  unit: 'kg' | 'pcs';
  code?: string;
  minWeight?: number | null;
  estimatedHours?: number | null;
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
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Step 3: Services Catalog
  const [services, setServices] = useState<ServiceItem[]>([
    { id: 'srv_p1', name: 'Cuci Kering', price: 10000, unit: 'kg', code: 'kiloan', estimatedHours: 24 },
    { id: 'srv_p2', name: 'Cuci Kering Express', price: 15000, unit: 'kg', code: 'express', estimatedHours: 6 },
    { id: 'srv_p3', name: 'Dry Clean', price: 25000, unit: 'pcs', code: 'dry_clean', estimatedHours: 48 },
  ]);

  // Inline service creation state
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceUnit, setNewServiceUnit] = useState<'kg' | 'pcs'>('kg');
  const [newServiceMinWeight, setNewServiceMinWeight] = useState('');
  const [newServiceEstimatedHours, setNewServiceEstimatedHours] = useState('24');
  const [isAddingService, setIsAddingService] = useState(false);

  // Editing service state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editUnit, setEditUnit] = useState<'kg' | 'pcs'>('kg');
  const [editMinWeight, setEditMinWeight] = useState('');
  const [editEstimatedHours, setEditEstimatedHours] = useState('24');

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
              setLatitude(existingApp.latitude ?? null);
              setLongitude(existingApp.longitude ?? null);

              if (existingApp.services && existingApp.services.length > 0) {
                setServices(
                  existingApp.services.map((s) => ({
                    id: s.id,
                    name: s.name,
                    price: s.price_per_unit,
                    unit: (s.unit as 'kg' | 'pcs') || 'kg',
                    code: s.code || 'kiloan',
                    minWeight: s.min_weight,
                    estimatedHours: s.estimated_hours ?? (s.code === 'express' ? 6 : s.unit === 'pcs' ? 48 : 24),
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
    if (!locationService.isValidCoordinate(latitude, longitude)) {
      setErrorMessage('Silakan tentukan lokasi outlet laundry Anda pada peta terlebih dahulu.');
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
    const parsedMinWeight =
      newServiceUnit === 'kg' && newServiceMinWeight.trim() !== '' && !isNaN(Number(newServiceMinWeight)) && Number(newServiceMinWeight) > 0
        ? Number(newServiceMinWeight)
        : null;

    if (newServiceEstimatedHours.trim() !== '') {
      const hrs = Number(newServiceEstimatedHours);
      if (isNaN(hrs) || !Number.isInteger(hrs) || hrs < 1) {
        setErrorMessage('Estimasi waktu pengerjaan minimal 1 jam.');
        return;
      }
      if (hrs > 168) {
        setErrorMessage('Estimasi waktu pengerjaan maksimal 168 jam (7 hari).');
        return;
      }
    }

    const parsedEstHours = newServiceEstimatedHours.trim() !== '' && !isNaN(Number(newServiceEstimatedHours))
      ? Number(newServiceEstimatedHours)
      : (newServiceUnit === 'pcs' ? 48 : 24);

    const enumCode = normalizeServiceType(null, newServiceUnit, newServiceName.trim());

    const newId = `srv_p${Date.now()}`;
    setServices([
      ...services,
      {
        id: newId,
        name: newServiceName.trim(),
        price: Number(newServicePrice),
        unit: newServiceUnit,
        minWeight: parsedMinWeight,
        estimatedHours: parsedEstHours,
        code: enumCode,
      },
    ]);
    setNewServiceName('');
    setNewServicePrice('');
    setNewServiceUnit('kg');
    setNewServiceMinWeight('');
    setNewServiceEstimatedHours('24');
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
    setEditMinWeight(service.minWeight && service.unit === 'kg' ? service.minWeight.toString() : '');
    setEditEstimatedHours(service.estimatedHours ? service.estimatedHours.toString() : (service.unit === 'pcs' ? '48' : '24'));
  };

  const saveEditService = (id: string) => {
    if (!editName.trim() || !editPrice || isNaN(Number(editPrice))) {
      setErrorMessage('Nama dan harga layanan harus diisi dengan benar.');
      return;
    }
    const parsedEditMinWeight =
      editUnit === 'kg' && editMinWeight.trim() !== '' && !isNaN(Number(editMinWeight)) && Number(editMinWeight) > 0
        ? Number(editMinWeight)
        : null;

    if (editEstimatedHours.trim() !== '') {
      const hrs = Number(editEstimatedHours);
      if (isNaN(hrs) || !Number.isInteger(hrs) || hrs < 1) {
        setErrorMessage('Estimasi waktu pengerjaan minimal 1 jam.');
        return;
      }
      if (hrs > 168) {
        setErrorMessage('Estimasi waktu pengerjaan maksimal 168 jam (7 hari).');
        return;
      }
    }

    const parsedEditEstHours = editEstimatedHours.trim() !== '' && !isNaN(Number(editEstimatedHours))
      ? Number(editEstimatedHours)
      : (editUnit === 'pcs' ? 48 : 24);

    setServices(
      services.map((s) =>
        s.id === id
          ? {
              ...s,
              name: editName.trim(),
              price: Number(editPrice),
              unit: editUnit,
              minWeight: parsedEditMinWeight,
              estimatedHours: parsedEditEstHours,
            }
          : s
      )
    );
    setEditingId(null);
    setEditMinWeight('');
    setEditEstimatedHours('24');
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
              latitude: latitude !== null ? Number(latitude) : undefined,
              longitude: longitude !== null ? Number(longitude) : undefined,
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
            latitude: latitude !== null ? Number(latitude) : undefined,
            longitude: longitude !== null ? Number(longitude) : undefined,
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
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-b from-brand-surface via-slate-50 to-white">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-primary text-white shadow-lg shadow-brand-primary/30 mb-1">
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
                          ? 'bg-brand-primary text-white ring-4 ring-brand-primary/20 scale-110'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : step.num}
                    </div>
                    <span
                      className={`text-[10px] font-bold tracking-tight ${
                        isActive ? 'text-brand-primary' : isCompleted ? 'text-emerald-700' : 'text-slate-400'
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
              <Link href="/login" className="shrink-0 font-bold text-brand-primary underline hover:text-brand-primary/80">
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
                  <User className="w-4 h-4 text-brand-primary" /> Step 1 — Data Pemilik Usaha
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
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
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
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
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
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
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
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
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
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
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
                  <Store className="w-4 h-4 text-brand-primary" /> Step 2 — Data Toko Laundry
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
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
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
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
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
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
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
                      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
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
                        className="w-full pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
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
                        className="w-full pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* Interactive Map Location Picker Section */}
                <div className="p-4 rounded-2xl bg-brand-surface border border-brand-primary/20 space-y-3 pt-3">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase">
                      <MapPin className="w-4 h-4 text-brand-primary shrink-0" />
                      📍 Lokasi Outlet Laundry
                    </h3>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Pilih lokasi outlet laundry Anda pada peta agar pelanggan sekitar dapat menemukan usaha Anda.
                      Anda dapat:
                    </p>
                    <ul className="text-[11px] text-slate-600 list-disc list-inside pl-1 space-y-0.5 font-medium">
                      <li>Menekan lokasi pada peta</li>
                      <li>Menggeser pin untuk menentukan lokasi</li>
                      <li>Menggunakan tombol <span className="font-bold text-brand-primary">"Gunakan Lokasi Saya"</span></li>
                    </ul>
                  </div>

                  <MapLocationPicker
                    latitude={latitude}
                    longitude={longitude}
                    onLocationChange={(lat, lng) => {
                      setLatitude(lat);
                      setLongitude(lng);
                    }}
                    disabled={isSubmitting}
                  />

                  {/* Read-Only Coordinate Information Display */}
                  {latitude !== null && longitude !== null && (
                    <div className="p-3 rounded-xl bg-white border border-brand-primary/20 shadow-2xs space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-brand-primary">
                        <CheckCircle2 className="w-4 h-4 text-brand-primary shrink-0" />
                        <span>✓ Lokasi outlet berhasil dipilih</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 font-sans block uppercase font-bold">Latitude (Read-Only)</span>
                          <span className="font-bold text-slate-800">{latitude}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-sans block uppercase font-bold">Longitude (Read-Only)</span>
                          <span className="font-bold text-slate-800">{longitude}</span>
                        </div>
                      </div>
                    </div>
                  )}
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
                    <Tag className="w-4 h-4 text-brand-primary" /> Step 3 — Katalog Layanan Laundry
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
                <form onSubmit={handleAddService} className="p-3 bg-brand-surface rounded-xl border border-brand-primary/20 space-y-3">
                  <h3 className="text-xs font-bold text-brand-primary">Tambah Layanan Baru</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Nama Layanan (mis. Cuci Sepatu)"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      className="px-3 py-2 text-xs bg-white rounded-lg border border-brand-primary/20 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
                    />
                    <input
                      type="number"
                      placeholder="Tarif (Rp)"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(e.target.value)}
                      className="px-3 py-2 text-xs bg-white rounded-lg border border-brand-primary/20 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
                    />
                    <select
                      value={newServiceUnit}
                      onChange={(e) => {
                        const nextUnit = e.target.value as 'kg' | 'pcs';
                        setNewServiceUnit(nextUnit);
                        if (nextUnit === 'pcs') setNewServiceMinWeight('');
                      }}
                      className="px-3 py-2 text-xs bg-white rounded-lg border border-brand-primary/20 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
                    >
                      <option value="kg">per Kg</option>
                      <option value="pcs">per Pcs / Satuan</option>
                    </select>

                    <div className="sm:col-span-3 pt-1 border-t border-brand-primary/10 mt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {newServiceUnit === 'kg' && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                              Minimum Order (KG) — Opsional
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              placeholder="misal 3 (Kosongkan jika tidak ada)"
                              value={newServiceMinWeight}
                              onChange={(e) => setNewServiceMinWeight(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-brand-primary/20 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
                            />
                          </div>
                        )}
                        <div className={newServiceUnit === 'kg' ? '' : 'sm:col-span-2'}>
                          <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                            Estimasi Pengerjaan (Jam) *
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="168"
                              step="1"
                              required
                              placeholder="misal 24 (1 Hari) atau 6 (6 Jam)"
                              value={newServiceEstimatedHours}
                              onChange={(e) => setNewServiceEstimatedHours(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-brand-primary/20 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
                            />
                            <span className="text-xs font-bold text-brand-primary shrink-0 bg-brand-surface px-2.5 py-1.5 rounded-lg border border-brand-primary/20">
                              ⏱ {formatEstimatedTimeText(Number(newServiceEstimatedHours))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
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
                        <div className="flex-1 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                                onChange={(e) => {
                                  const nextUnit = e.target.value as 'kg' | 'pcs';
                                  setEditUnit(nextUnit);
                                  if (nextUnit === 'pcs') setEditMinWeight('');
                                }}
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                            {editUnit === 'kg' && (
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                  Min Order (KG) — Opsional
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0.1"
                                  placeholder="misal 3"
                                  value={editMinWeight}
                                  onChange={(e) => setEditMinWeight(e.target.value)}
                                  className="w-full px-2.5 py-1 text-xs bg-white rounded-lg border border-slate-300"
                                />
                              </div>
                            )}
                            <div className={editUnit === 'kg' ? '' : 'sm:col-span-2'}>
                              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                                Estimasi Pengerjaan (Jam) *
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  max="168"
                                  step="1"
                                  required
                                  value={editEstimatedHours}
                                  onChange={(e) => setEditEstimatedHours(e.target.value)}
                                  className="w-full px-2.5 py-1 text-xs bg-white rounded-lg border border-slate-300"
                                />
                                <span className="text-[10px] font-bold text-brand-primary shrink-0 bg-brand-surface px-2 py-1 rounded-md border border-brand-primary/20">
                                  ⏱ {formatEstimatedTimeText(Number(editEstimatedHours))}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-slate-800">{service.name}</p>
                            <p className="text-[11px] font-semibold text-brand-primary flex items-center gap-1.5 flex-wrap">
                              <span>Rp {service.price.toLocaleString('id-ID')} / {service.unit}</span>
                              {service.unit === 'kg' && service.minWeight && service.minWeight > 0 ? (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                                  Min. order {service.minWeight} kg
                                </span>
                              ) : null}
                              <span className="text-[10px] font-bold text-brand-primary bg-brand-surface px-1.5 py-0.5 rounded-md border border-brand-primary/20">
                                ⏱ Estimasi {formatEstimatedTimeText(service.estimatedHours || (service.code === 'express' ? 6 : service.unit === 'pcs' ? 48 : 24))}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEditService(service)}
                              className="p-1.5 text-slate-500 hover:text-brand-primary hover:bg-brand-surface rounded-lg transition-colors cursor-pointer"
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
                  <CreditCard className="w-4 h-4 text-brand-primary" /> Step 4 — Data Rekening Payout
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
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary"
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
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary bg-white"
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
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-primary font-mono"
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
                  <CheckCircle2 className="w-4 h-4 text-brand-primary" /> Step 5 — Review & Konfirmasi Data
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
                      <User className="w-3.5 h-3.5 text-brand-primary" /> Data Pemilik
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-xs font-bold text-brand-primary hover:underline cursor-pointer"
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
                      <Store className="w-3.5 h-3.5 text-brand-primary" /> Data Toko Laundry
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs font-bold text-brand-primary hover:underline cursor-pointer"
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
                      <Tag className="w-3.5 h-3.5 text-brand-primary" /> Katalog Layanan ({services.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="text-xs font-bold text-brand-primary hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                  <ul className="divide-y divide-slate-200/60 text-xs pt-1">
                    {services.map((s) => (
                      <li key={s.id} className="py-1 flex justify-between">
                        <span className="font-semibold text-slate-700">{s.name}</span>
                        <span className="font-bold text-brand-primary">
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
                      <CreditCard className="w-3.5 h-3.5 text-brand-primary" /> Rekening Payout
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      className="text-xs font-bold text-brand-primary hover:underline cursor-pointer"
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
          <div className="animate-spin w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full" />
        </div>
      }
    >
      <PartnerRegisterContent />
    </Suspense>
  );
}
