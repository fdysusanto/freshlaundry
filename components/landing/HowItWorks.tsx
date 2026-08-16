import React from 'react';
import { CalendarCheck, Truck, Sparkles, Home } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Pesan Pickup',
      description: 'Pilih jenis layanan, masukkan alamat, dan tentukan slot jam penjemputan.',
      icon: CalendarCheck,
    },
    {
      num: '02',
      title: 'Penjemputan Pakaian',
      description: 'Kurir FreshWash datang membawa kantong laundry khusus dan menimbang pakaian di tempat.',
      icon: Truck,
    },
    {
      num: '03',
      title: 'Proses Pencucian',
      description: 'Pakaian Anda dicuci higienis per pelanggan, disetrika uap rapi, dan dikemas aman.',
      icon: Sparkles,
    },
    {
      num: '04',
      title: 'Pengantaran Kembali',
      description: 'Pakaian wangi dan rapi diantarkan kembali ke lokasi Anda tepat waktu.',
      icon: Home,
    },
  ];

  return (
    <section className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-600">Alur Kerja Praktis</h2>
          <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            4 Langkah Mudah Cuci Laundry
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={s.num}
                className="relative bg-slate-50 border border-slate-200/80 p-6 rounded-3xl space-y-4 hover:border-teal-400 hover:shadow-lg transition-all duration-300 group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-md shadow-teal-600/20 group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-3xl font-black text-slate-200 group-hover:text-teal-200 transition-colors">
                    {s.num}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-teal-700 transition-colors">
                  {s.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{s.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
