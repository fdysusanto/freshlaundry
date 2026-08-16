'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Order, OrderStatus } from '@/types/order';
import { formatIDR, formatDateIndo } from '@/utils/formatters';
import { getStatusConfig } from '@/utils/helpers';
import { DEMO_USERS } from '@/utils/constants';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Search, UserPlus, Eye, Filter } from 'lucide-react';

interface OrderTableProps {
  orders: Order[];
  onAssignCourier: (orderId: string, courierId: string, courierName: string) => void;
  onUpdateStatus: (orderId: string, newStatus: OrderStatus, notes: string) => void;
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  onAssignCourier,
  onUpdateStatus,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAssignOrder, setSelectedAssignOrder] = useState<Order | null>(null);
  const [selectedCourierId, setSelectedCourierId] = useState<string>('usr_courier_01');

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.trackingNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const couriers = DEMO_USERS.filter((u) => u.role === 'courier');

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignOrder) return;
    const courierObj = couriers.find((c) => c.id === selectedCourierId);
    if (!courierObj) return;

    onAssignCourier(selectedAssignOrder.id, courierObj.id, courierObj.fullName);
    setSelectedAssignOrder(null);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari Resi atau Nama Customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 text-xs font-medium rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto text-xs py-2 px-3 bg-slate-50 rounded-xl border border-slate-200 font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Pending / Menunggu Kurir</option>
            <option value="assigned">Kurir Ditugaskan</option>
            <option value="picked_up">Sudah Diambil</option>
            <option value="in_washing">Dalam Proses Cuci</option>
            <option value="ready_for_delivery">Siap Diantar</option>
            <option value="out_for_delivery">Kurir Mengantar</option>
            <option value="delivered">Selesai</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-bold">
              <tr>
                <th className="p-4">No. Resi</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Layanan</th>
                <th className="p-4">Jadwal Pickup</th>
                <th className="p-4">Kurir Penanggung Jawab</th>
                <th className="p-4">Status</th>
                <th className="p-4">Total Biaya</th>
                <th className="p-4 text-right">Aksi Penugasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((o) => {
                  const cfg = getStatusConfig(o.status);
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 font-black text-slate-900">{o.trackingNumber}</td>
                      <td className="p-4">
                        <p className="font-bold text-slate-800">{o.customerName}</p>
                        <p className="text-[11px] text-slate-500">{o.customerPhone}</p>
                      </td>
                      <td className="p-4 font-medium">{o.serviceName}</td>
                      <td className="p-4">
                        <p className="font-medium">{formatDateIndo(o.pickupDate)}</p>
                        <p className="text-[11px] text-slate-500">{o.pickupTimeSlot}</p>
                      </td>
                      <td className="p-4">
                        {o.courierName ? (
                          <span className="font-semibold text-slate-800">{o.courierName}</span>
                        ) : (
                          <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[11px]">
                            Belum Ditugaskan
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant={cfg.stepIndex >= 6 ? 'emerald' : cfg.stepIndex >= 3 ? 'blue' : 'amber'}>
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="p-4 font-black text-teal-700">{formatIDR(o.totalPrice)}</td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedAssignOrder(o)}
                          className="p-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 font-semibold transition-colors"
                          title="Tugaskan Kurir"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/orders/${o.id}`}
                          className="inline-block p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold transition-colors"
                          title="Lihat Detail Order"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                    Tidak ada data pesanan yang sesuai filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Penugasan Kurir */}
      <Modal
        isOpen={Boolean(selectedAssignOrder)}
        onClose={() => setSelectedAssignOrder(null)}
        title={`Penugasan Kurir #${selectedAssignOrder?.trackingNumber}`}
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl border text-xs space-y-1">
            <p className="text-slate-600 font-medium">Customer: <strong>{selectedAssignOrder?.customerName}</strong></p>
            <p className="text-slate-600 font-medium">Alamat: <strong>{selectedAssignOrder?.pickupAddress}</strong></p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
              Pilih Kurir Driver:
            </label>
            <div className="space-y-2">
              {couriers.map((c) => {
                const isSelected = selectedCourierId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCourierId(c.id)}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20 font-bold text-teal-800'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <div>
                      <p className="text-sm">{c.fullName}</p>
                      <p className="text-xs text-slate-500 font-normal">Telepon: {c.phone}</p>
                    </div>
                    {isSelected && <span className="text-teal-600 font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedAssignOrder(null)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Simpan Penugasan Kurir
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
