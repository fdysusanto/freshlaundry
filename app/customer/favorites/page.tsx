'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFavorites } from '@/hooks/useFavorites';
import { marketplaceService } from '@/services/marketplaceService';
import { LaundryMarketplaceItem } from '@/types/laundry';
import { LaundryPartnerCard } from '@/components/marketplace/LaundryPartnerCard';
import { LaundryCardSkeleton } from '@/components/ui/MarketplaceSkeleton';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Heart, ArrowLeft, Search } from 'lucide-react';

export default function CustomerFavoritesPage() {
  const router = useRouter();
  const { favoriteIds, isInitialized } = useFavorites();
  const [marketplaceItems, setMarketplaceItems] = useState<LaundryMarketplaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await marketplaceService.getNearbyLaundryPartnersAsync(null, null);
      setMarketplaceItems(items);
    } catch (err) {
      console.warn('Failed loading marketplace laundries for favorites:', err);
      setMarketplaceItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter items matching saved favorite IDs in localStorage
  const favoriteItems = useMemo(() => {
    return marketplaceItems.filter((item) => favoriteIds.includes(item.laundry.id));
  }, [marketplaceItems, favoriteIds]);

  if (isLoading || !isInitialized) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
          <ArrowLeft className="w-4 h-4" /> Memuat Laundry Favorit...
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <LaundryCardSkeleton />
          <LaundryCardSkeleton />
          <LaundryCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6 pb-24 md:pb-12">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link href="/customer/account" className="text-xs font-bold text-slate-500 hover:text-teal-700 flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Akun Saya
        </Link>
      </div>

      {/* Title Banner */}
      <div className="border-b border-slate-200 pb-4 space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold mb-1 border border-rose-200">
          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          <span>Outlet Pilihan Anda</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Laundry Favorit</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Daftar mitra laundry yang Anda tandai sebagai favorit untuk pemesanan cepat.
        </p>
      </div>

      {favoriteItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favoriteItems.map((item) => (
            <LaundryPartnerCard key={item.laundry.id} item={item} />
          ))}
        </div>
      ) : (
        <Card variant="white" className="p-12 text-center space-y-4 border-slate-200">
          <Heart className="w-12 h-12 text-rose-300 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">Belum Ada Laundry Favorit</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Anda belum menandai mitra laundry favorit. Klik ikon hati pada outlet laundry pilihan Anda untuk menyimpan ke halaman ini.
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push('/customer/laundries')}
            leftIcon={<Search className="w-4 h-4" />}
            className="bg-teal-600 hover:bg-teal-500 text-white font-bold"
          >
            Jelajahi Marketplace Laundry
          </Button>
        </Card>
      )}
    </div>
  );
}
