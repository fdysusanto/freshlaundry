import { useState, useEffect, useCallback } from 'react';

const FAVORITES_STORAGE_KEY = 'freshlaundry_favorite_ids';

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setFavoriteIds(parsed);
          }
        }
      } catch (err) {
        console.warn('[USE-FAVORITES] Error parsing favorite IDs from localStorage:', err);
      } finally {
        setIsInitialized(true);
      }
    }
  }, []);

  const toggleFavorite = useCallback((laundryId: string) => {
    setFavoriteIds((prev) => {
      const isFav = prev.includes(laundryId);
      const next = isFav ? prev.filter((id) => id !== laundryId) : [...prev, laundryId];
      if (typeof window !== 'undefined') {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (laundryId: string) => favoriteIds.includes(laundryId),
    [favoriteIds]
  );

  return {
    favoriteIds,
    isInitialized,
    toggleFavorite,
    isFavorite,
  };
}
