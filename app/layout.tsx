import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { MobileNav } from '@/components/layout/MobileNav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FreshWash - Laundry Pickup & Delivery Cepat & Higienis',
  description:
    'Layanan laundry pickup dan delivery profesional. Pesan cuci kiloan, express 6 jam, dan dry clean dengan lacak status real-time dari HP Anda.',
  keywords: ['laundry pickup', 'laundry delivery', 'cuci kiloan', 'express laundry', 'dry clean'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="scroll-smooth">
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-50 text-slate-900`}>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <MobileNav />
      </body>
    </html>
  );
}
