'use client';

import React, { useState } from 'react';
import { Order, OrderStatus } from '@/types/order';
import { getNextPossibleStatuses, getStatusConfig } from '@/utils/helpers';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onUpdateStatus: (orderId: string, status: OrderStatus, notes: string) => void;
}

export const StatusUpdateModal: React.FC<StatusUpdateModalProps> = ({
  isOpen,
  onClose,
  order,
  onUpdateStatus,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  const [notes, setNotes] = useState('');

  if (!order) return null;

  const currentCfg = getStatusConfig(order.status);
  const possibleNext = getNextPossibleStatuses(order.status);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus) return;
    onUpdateStatus(order.id, selectedStatus, notes);
    setNotes('');
    setSelectedStatus('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Update Status Task #${order.trackingNumber}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
          <p className="text-slate-500 font-medium">Pelanggan: <strong className="text-slate-800">{order.customerName}</strong></p>
          <p className="text-slate-500 font-medium">Status Saat Ini: <strong className="text-teal-700">{currentCfg.label}</strong></p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
            Pilih Status Terbaru:
          </label>
          <div className="space-y-2">
            {possibleNext.length > 0 ? (
              possibleNext.map((st) => {
                const cfg = getStatusConfig(st);
                const isSelected = selectedStatus === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedStatus(st)}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20 font-bold text-teal-800'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div>
                      <p className="text-sm">{cfg.label}</p>
                      <p className="text-xs text-slate-500 font-normal">{cfg.description}</p>
                    </div>
                    {isSelected && <span className="text-teal-600 font-bold text-sm">✓</span>}
                  </button>
                );
              })
            ) : (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-100 rounded-xl">
                Pesanan ini sudah mencapai tahap akhir ({currentCfg.label}).
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Catatan Kurir (Opsional):
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Misal: Paket diterima oleh Ybs di teras depan..."
            className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!selectedStatus}
          >
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </Modal>
  );
};
