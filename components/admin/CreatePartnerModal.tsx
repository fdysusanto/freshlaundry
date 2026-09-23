'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { X, Building2, MapPin, Phone, Mail, AlertCircle, CheckCircle2, Map } from 'lucide-react';
import { MapLocationPicker, DEFAULT_MAP_CENTER } from '@/components/address/MapLocationPicker';
import { isValidCoordinate } from '@/services/locationService';
import { authService } from '@/services/authService';

interface CreatePartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const CreatePartnerModal: React.FC<CreatePartnerModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [address, setAddress] = useState('');
  const [cityName, setCityName] = useState('Cirebon');
  const [districtName, setDistrictName] = useState('Kesambi');
  const [notes, setNotes] = useState('');
  
  // Coordinate State (Default Kota Cirebon)
  const [latInput, setLatInput] = useState<string>(DEFAULT_MAP_CENTER[0].toString());
  const [lngInput, setLngInput] = useState<string>(DEFAULT_MAP_CENTER[1].toString());
  const [latitude, setLatitude] = useState<number | null>(DEFAULT_MAP_CENTER[0]);
  const [longitude, setLongitude] = useState<number | null>(DEFAULT_MAP_CENTER[1]);
  const [showMapPicker, setShowMapPicker] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Coordinate Validation Calculation
  const isLatEmpty = !latInput.trim();
  const isLngEmpty = !lngInput.trim();
  const parsedLat = parseFloat(latInput);
  const parsedLng = parseFloat(lngInput);
  const isCoordEntered = !isLatEmpty || !isLngEmpty;
  const isCoordValid = isCoordEntered && !isNaN(parsedLat) && !isNaN(parsedLng) && isValidCoordinate(parsedLat, parsedLng);

  // Handle marker movement from Map UI
  const handleMapLocationChange = (newLat: number, newLng: number) => {
    setLatitude(newLat);
    setLongitude(newLng);
    setLatInput(newLat.toString());
    setLngInput(newLng.toString());
  };

  // Handle manual Latitude input change
  const handleLatInputChange = (val: string) => {
    setLatInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= -90 && num <= 90) {
      setLatitude(num);
    } else {
      setLatitude(null);
    }
  };

  // Handle manual Longitude input change
  const handleLngInputChange = (val: string) => {
    setLngInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= -180 && num <= 180) {
      setLongitude(num);
    } else {
      setLongitude(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Nama bisnis laundry wajib diisi.');
      return;
    }

    if (isCoordEntered && !isCoordValid) {
      setErrorMessage('Koordinat lokasi di luar rentang valid (Latitude: -90 s/d 90, Longitude: -180 s/d 180).');
      return;
    }

    setIsSubmitting(true);

    try {
      const authHeaders = await authService.getAuthHeadersAsync();

      const res = await fetch('/api/admin/partners', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          legalName: legalName.trim() || undefined,
          phone: phone.trim() || undefined,
          businessEmail: businessEmail.trim() || undefined,
          address: address.trim() || '-',
          cityName: cityName.trim() || undefined,
          districtName: districtName.trim() || undefined,
          latitude: isCoordValid ? parsedLat : undefined,
          longitude: isCoordValid ? parsedLng : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal membuat listing partner.');
      }

      onCreated();
      onClose();
      // Reset form
      setName('');
      setLegalName('');
      setPhone('');
      setBusinessEmail('');
      setAddress('');
      setNotes('');
      setLatInput(DEFAULT_MAP_CENTER[0].toString());
      setLngInput(DEFAULT_MAP_CENTER[1].toString());
      setLatitude(DEFAULT_MAP_CENTER[0]);
      setLongitude(DEFAULT_MAP_CENTER[1]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat membuat partner.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 text-brand-primary">
            <Building2 className="w-6 h-6" />
            <h2 className="text-xl font-black text-slate-900">Tambah Partner / Listing Baru</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-50 rounded-2xl border border-red-200 flex items-start gap-3 text-red-800 text-xs">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Gagal Membuat Listing</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Nama Bisnis / Outlet Laundry *</label>
            <input
              type="text"
              required
              placeholder="Contoh: FreshWash Express Kesambi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Nama Legal (Opsional)</label>
              <input
                type="text"
                placeholder="PT / CV FreshWash Mandiri"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-primary focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Telepon Kontak Bisnis</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="08123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Email Bisnis</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                placeholder="partner@freshwash.id"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Alamat Lengkap</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <textarea
                rows={2}
                placeholder="Jl. Perjuangan No. 88, Kesambi"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Kota / Kabupaten</label>
              <input
                type="text"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-primary focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Kecamatan</label>
              <input
                type="text"
                value={districtName}
                onChange={(e) => setDistrictName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-primary focus:outline-none"
              />
            </div>
          </div>

          {/* LOKASI PARTNER SECTION */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <MapPin className="w-4 h-4 text-brand-primary" />
                <span>Lokasi Partner</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMapPicker(!showMapPicker)}
                className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
              >
                <Map className="w-3.5 h-3.5" />
                {showMapPicker ? 'Sembunyikan Peta' : 'Pilih Lokasi di Peta'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-600 text-[11px]">Latitude</label>
                <input
                  type="text"
                  placeholder="-6.732000"
                  value={latInput}
                  onChange={(e) => handleLatInputChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-brand-primary focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600 text-[11px]">Longitude</label>
                <input
                  type="text"
                  placeholder="108.552300"
                  value={lngInput}
                  onChange={(e) => handleLngInputChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-brand-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Validation Indicator */}
            {isCoordEntered && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                {isCoordValid ? (
                  <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ✓ Koordinat valid
                  </span>
                ) : (
                  <span className="text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    ⚠ Koordinat di luar area yang valid (-90 s/d 90, -180 s/d 180)
                  </span>
                )}
              </div>
            )}

            {/* Interactive Map Picker Component */}
            {showMapPicker && (
              <div className="pt-2">
                <MapLocationPicker
                  latitude={latitude}
                  longitude={longitude}
                  onLocationChange={handleMapLocationChange}
                  compact
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Catatan Internal Ops Platform</label>
            <textarea
              rows={2}
              placeholder="Catatan verifikasi atau referensi survei lapangan..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-primary focus:outline-none"
            />
          </div>

          <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-[11px] text-blue-800 space-y-1">
            <p className="font-bold">Informasi Default Listing:</p>
            <p>• Status Awal: <strong>LISTED / UNCLAIMED</strong></p>
            <p>• Pemilik: <strong>Belum Diklaim (Not Claimed)</strong></p>
            <p>• Toko tidak langsung aktif menerima pesanan sampai proses Onboarding &amp; Verifikasi selesai.</p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
              Batal
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting || (isCoordEntered && !isCoordValid)}
            >
              Buat Listing Partner
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

