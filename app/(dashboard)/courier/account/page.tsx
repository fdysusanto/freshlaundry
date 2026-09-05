'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { orderService } from '@/services/orderService';
import { UserProfile } from '@/types/user';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { User, LogOut, ShieldCheck, Truck, CheckCircle2, Clock, MapPin, Phone, Mail } from 'lucide-react';

export default function CourierAccountPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [activeCount, setActiveCount] = useState<number>(0);

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    if (user) {
      const fetchOrders = async () => {
        try {
          const courierOrders = await orderService.getOrdersByCourierAsync(user.id);
          setCompletedCount(courierOrders.filter((o) => o.status === 'delivered' || o.status === 'in_washing').length);
          setActiveCount(courierOrders.filter((o) => o.status === 'assigned' || o.status === 'picked_up' || o.status === 'out_for_delivery').length);
        } catch {
          const courierOrders = orderService.getOrdersByCourier(user.id);
          setCompletedCount(courierOrders.filter((o) => o.status === 'delivered' || o.status === 'in_washing').length);
          setActiveCount(courierOrders.filter((o) => o.status === 'assigned' || o.status === 'picked_up' || o.status === 'out_for_delivery').length);
        }
      };
      fetchOrders();
    }
  }, []);

  const handleLogout = async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari akun Kurir?')) {
      await authService.logout();
      router.push('/login');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-24">
      {/* Header Profile Card */}
      <Card variant="white" className="p-6 border-slate-200 shadow-md">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-amber-600/30">
            {currentUser?.fullName?.charAt(0).toUpperCase() || 'K'}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                {currentUser?.fullName || 'Kurir Driver'}
              </h1>
              <Badge variant="emerald" className="font-bold text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> VERIFIED DRIVER
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-medium">Logistik Partner FreshLaundry</p>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {currentUser?.email || 'courier@freshlaundry.com'}
              </span>
              {currentUser?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {currentUser.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Driver Statistics */}
      <div className="grid grid-cols-2 gap-4">
        <Card variant="white" className="p-5 border-slate-200 text-center">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-2">
            <Truck className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-slate-900">{activeCount}</p>
          <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">Tugas Aktif</p>
        </Card>

        <Card variant="white" className="p-5 border-slate-200 text-center">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-slate-900">{completedCount}</p>
          <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">Tugas Selesai</p>
        </Card>
      </div>

      {/* Driver Information Details */}
      <Card variant="white" className="p-5 border-slate-200 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
          Informasi Operasional Kurir
        </h2>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-semibold text-slate-600">Peran Akun:</span>
            <span className="font-bold text-slate-900 capitalize">{currentUser?.role || 'Courier'}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-semibold text-slate-600">Wilayah Layanan:</span>
            <span className="font-bold text-slate-900">DKI Jakarta & Sejuta Kota</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-semibold text-slate-600">Batas Maksimal Klaim Order per Slot:</span>
            <span className="font-bold text-amber-700">Maksimal 5 Order</span>
          </div>
        </div>
      </Card>

      {/* Logout Action */}
      <Card variant="white" className="p-4 border-slate-200">
        <button
          onClick={handleLogout}
          className="w-full py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-2 border border-rose-200 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> Keluar dari Akun Kurir
        </button>
      </Card>
    </div>
  );
}
