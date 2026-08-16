'use client';

import React, { useState, useEffect } from 'react';
import { CustomerAddress } from '@/types/address';
import { customerAddressService } from '@/services/customerAddressService';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CustomerAddressModal } from './CustomerAddressModal';
import { MapPin, Plus, Check } from 'lucide-react';

interface AddressSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAddress: (address: CustomerAddress) => void;
  selectedAddressId?: string;
  title?: string;
}

export const AddressSelectorModal: React.FC<AddressSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectAddress,
  selectedAddressId,
  title = 'Pilih Alamat Tersimpan',
}) => {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadAddresses = async () => {
    setIsLoading(true);
    try {
      const data = await customerAddressService.getCustomerAddressesAsync();
      setAddresses(data);
    } catch (err) {
      console.warn('Gagal memuat alamat selector:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadAddresses();
  }, [isOpen]);

  const handleSelect = (address: CustomerAddress) => {
    onSelectAddress(address);
    onClose();
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="lg">
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <p className="text-slate-500 font-semibold">
              Pilih dari daftar alamat tersimpan Anda:
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="text-xs font-bold border-teal-200 text-teal-700 hover:bg-teal-50"
            >
              + Tambah Baru
            </Button>
          </div>

          {isLoading ? (
            <div className="py-8 text-center space-y-2">
              <div className="animate-spin w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full mx-auto" />
              <p className="text-slate-500 font-medium">Memuat alamat...</p>
            </div>
          ) : addresses.length === 0 ? (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
              <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">Belum Ada Alamat Tersimpan</p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddModalOpen(true)}
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold"
              >
                + Tambah Alamat Sekarang
              </Button>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {addresses.map((address) => {
                const isSelected = selectedAddressId === address.id;
                return (
                  <button
                    type="button"
                    key={address.id}
                    onClick={() => handleSelect(address)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20'
                        : 'border-slate-200 hover:border-teal-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900">{address.label}</span>
                        {address.isDefault && (
                          <Badge variant="teal" className="text-[9px] font-bold">
                            DEFAULT
                          </Badge>
                        )}
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <p className="font-bold text-slate-800">
                      {address.recipientName} ({address.phone})
                    </p>
                    <p className="text-slate-600 mt-1 leading-relaxed">
                      {address.addressDetail}, Kel. {address.villageName}, Kec. {address.districtName},{' '}
                      {address.cityName}, {address.provinceName} ({address.postalCode})
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Embedded Create Address Modal */}
      <CustomerAddressModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={async (newAddress) => {
          await loadAddresses();
          onSelectAddress(newAddress);
          onClose();
        }}
      />
    </>
  );
};
