import React from 'react';
import { Card } from '../ui/Card';
import { Truck, Clock, Sparkles, MapPin, ShieldCheck, ThumbsUp } from 'lucide-react';

export const Features: React.FC = () => {
  const featureList = [
    {
      icon: Truck,
      title: 'Gratis Pickup & Delivery',
      description:
        'Kurir kami langsung datang ke rumah/apartemen Anda sesuai jam slot pilihan tanpa biaya tambahan.',
      color: 'bg-teal-50 text-teal-600',
    },
    {
      icon: Clock,
      title: 'Layanan Express 6 Jam',
      description:
        'Butuh pakaian bersih mendadak untuk acara penting? Gunakan opsi Express selesai dalam 6 jam saja.',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      icon: MapPin,
      title: 'Tracking Real-Time 24/7',
      description:
        'Pantau tahapan pakaian Anda mulai dari penjemputan, penimbangan, pencucian, hingga pengantaran.',
      color: 'bg-sky-50 text-sky-600',
    },
    {
      icon: Sparkles,
      title: 'Deterjen & Pelembut Premium',
      description:
        'Menggunakan formulasi deterjen ramah serat kain dan parfum tahan lama yang tidak merusak warna.',
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      icon: ShieldCheck,
      title: 'Garansi Cuci Ulang 100%',
      description:
        'Jika pakaian merasa kurang bersih atau wangi, kami siap mencuci ulang gratis tanpa ribet.',
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      icon: ThumbsUp,
      title: 'Pemisahan Warna & Serat',
      description:
        '1 Pelanggan 1 Mesin Cuci. Pakaian Anda dipastikan tidak dicampur dengan pakaian orang lain.',
      color: 'bg-purple-50 text-purple-600',
    },
  ];

  return (
    <section className="py-16 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-600">
            Mengapa Memilih FreshWash?
          </h2>
          <p className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Solusi Laundry Modern Tanpa Ribet
          </p>
          <p className="text-slate-600 text-sm sm:text-base">
            Nikmati kepraktisan mengurus pakaian kotor tanpa mengganggu kesibukan harian Anda.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featureList.map((f, i) => {
            const Icon = f.icon;
            return (
              <Card
                key={i}
                variant="white"
                className="hover:-translate-y-1 hover:border-teal-300 transition-all duration-300 group"
              >
                <div
                  className={`w-12 h-12 rounded-2xl ${f.color} flex items-center justify-center mb-6 font-bold group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-teal-700 transition-colors">
                  {f.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {f.description}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
