import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { MobileNav } from '@/components/layout/MobileNav';
import { BRAND } from '@/config/brand';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: `${BRAND.displayName} - ${BRAND.tagline}`,
  description: `${BRAND.displayName}: ${BRAND.positioning}. Layanan laundry pickup dan delivery profesional. Pesan cuci kiloan, express 6 jam, dan dry clean dengan lacak status real-time dari HP Anda.`,
  applicationName: BRAND.name,
  keywords: ['cuciyan', 'laundry pickup', 'laundry delivery', 'cuci kiloan', 'express laundry', 'dry clean', 'super app laundry'],
  icons: {
    icon: '/brand/cuciyan/icon/icon.svg',
    apple: '/brand/cuciyan/app-icon/apple-touch-icon.png',
  },
  openGraph: {
    title: `${BRAND.displayName} - ${BRAND.tagline}`,
    description: BRAND.positioning,
    siteName: BRAND.displayName,
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clientKey = (process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '').trim();
  const isSandboxClient = clientKey.startsWith('SB-Mid-client-') || clientKey.startsWith('SB-');
  const isProd = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true' && !isSandboxClient;
  const snapScriptUrl = isProd
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

  return (
    <html lang="id" className="scroll-smooth">
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-50 text-slate-900`}>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <MobileNav />
        <Script
          src={snapScriptUrl}
          data-client-key={clientKey}
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}

