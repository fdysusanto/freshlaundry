'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { customerAddressService } from '@/services/customerAddressService';
import { isSupabaseConfigured } from '@/services/supabase';
import { CustomerAddress } from '@/types/address';
import { CustomerAddressModal } from '@/components/address/CustomerAddressModal';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  MapPin,
  Plus,
  ArrowLeft,
  Home,
  CheckCircle2,
  AlertCircle,
  Edit,
  Trash2,
  Phone,
  User,
  RefreshCw,
} from 'lucide-react';

export default function CustomerAddressBookPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAddresses = async () => {
    setIsLoading(true);
    setFeedbackMessage(null);
    try {
      if (isSupabaseConfigured) {
        const profile = await authService.fetchCurrentProfile();
        if (!profile || profile.role !== 'customer') {
          router.push('/login');
          return;
        }

        const data = await customerAddressService.getCustomerAddressesAsync();
        setAddresses(data);
      }
    } catch (err: any) {
      console.warn('Gagal memuat alamat customer:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, [router]);

  const handleOpenAddModal = () => {
    setEditingAddress(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (address: CustomerAddress) => {
    setEditingAddress(address);
    setIsModalOpen(true);
  };

  const handleSetDefault = async (address: CustomerAddress) => {
    try {
      await customerAddressService.setDefaultAddressAsync(address.id);
      setFeedbackMessage({
        type: 'success',
        text: `Alamat '${address.label}' (${address.recipientName}) berhasil dijadikan alamat utama.`,
      });
      await loadAddresses();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Gagal mengubah alamat utama.',
      });
    }
  };

  const handleDelete = async (address: CustomerAddress) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus alamat '${address.label}'?`)) return;
    try {
      await customerAddressService.deleteAddressAsync(address.id);
      setFeedbackMessage({
        type: 'success',
        text: `Alamat '${address.label}' berhasil dihapus.`,
      });
      await loadAddresses();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Gagal menghapus alamat.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Memuat Alamat Saya...</p>
        </div>
      </div>
    );
  }

  const defaultAddr = addresses.find((a) => a.isDefault);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link href="/customer" className="text-xs font-bold text-slate-500 hover:text-teal-700 flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard Pelanggan
        </Link>
        <button
          onClick={loadAddresses}
          className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
        </button>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-cyan-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold">
            <MapPin className="w-3.5 h-3.5" />
            <span>Customer Address Book Engine</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">Alamat Saya</h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Simpan alamat penjemputan dan pengantaran laundry Anda (Master Wilayah Kota Cirebon).
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleOpenAddModal}
          leftIcon={<Plus className="w-4 h-4" />}
          className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shrink-0 shadow-lg cursor-pointer relative z-10"
        >
          + Tambah Alamat Baru
        </Button>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-700 font-bold text-xs"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Address List */}
      {addresses.length === 0 ? (
        <Card variant="white" className="p-12 text-center space-y-4">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">Belum Ada Alamat Tersimpan</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tambahkan alamat utama penjemputan dan pengantaran laundry Anda untuk kemudahan checkout otomatis.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenAddModal}
            leftIcon={<Plus className="w-4 h-4" />}
            className="bg-teal-600 hover:bg-teal-500 text-white font-bold"
          >
            + Tambah Alamat Sekarang
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {addresses.map((address) => (
            <Card
              key={address.id}
              variant="white"
              className={`p-6 transition-all border ${
                address.isDefault
                  ? 'border-teal-500 ring-2 ring-teal-500/10 shadow-lg'
                  : 'border-slate-200 hover:border-teal-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-sm">{address.label}</span>
                  {address.isDefault && (
                    <Badge variant="teal" className="font-bold text-[10px]">
                      ALAMAT UTAMA (DEFAULT)
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!address.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(address)}
                      className="text-xs font-bold border-teal-200 text-teal-700 hover:bg-teal-50"
                    >
                      Jadikan Utama
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditModal(address)}
                    leftIcon={<Edit className="w-3.5 h-3.5" />}
                    className="text-xs font-bold"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(address)}
                    leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                    className="text-xs font-bold border-rose-200 text-rose-600 hover:bg-rose-50"
                  >
                    Hapus
                  </Button>
                </div>
              </div>

              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{address.recipientName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{address.phone}</span>
                  </div>
                </div>

                <div className="space-y-1 text-slate-700">
                  <p className="font-semibold">{address.addressDetail}</p>
                  {(address.rt || address.rw) && (
                    <p className="font-mono text-slate-500">
                      RT {address.rt || '-'} / RW {address.rw || '-'}
                    </p>
                  )}
                  <p className="font-medium text-slate-500">
                    Kel. {address.villageName}, Kec. {address.districtName}, {address.cityName},{' '}
                    {address.provinceName} ({address.postalCode})
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reusable Address Modal */}
      <CustomerAddressModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={async () => {
          setFeedbackMessage({
            type: 'success',
            text: editingAddress ? 'Alamat berhasil diperbarui!' : 'Alamat baru berhasil disimpan!',
          });
          await loadAddresses();
        }}
        initialAddress={editingAddress}
      />
    </div>
  );
}
