'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/authService';
import { laundryService } from '@/services/laundryService';
import { isSupabaseConfigured } from '@/services/supabase';
import { Laundry } from '@/types/laundry';
import { UserProfile } from '@/types/user';
import { DEMO_LAUNDRIES } from '@/utils/constants';

const LOCAL_STORAGE_KEY = 'cuciyan_active_branch';

export interface OwnerBranchContextType {
  currentUser: UserProfile | null;
  ownedLaundries: Laundry[];
  activeLaundryId: string | null;
  activeLaundry: Laundry | null;
  setActiveLaundryId: (laundryId: string) => void;
  isLoading: boolean;
  buildBranchUrl: (pathname: string, overrideBranchId?: string) => string;
  refreshLaundries: () => Promise<void>;
}

const OwnerBranchContext = createContext<OwnerBranchContextType | undefined>(undefined);

export const OwnerBranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [ownedLaundries, setOwnedLaundries] = useState<Laundry[]>([]);
  const [activeLaundryId, setActiveLaundryIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const urlBranchParam = searchParams.get('branch');

  // Load User & Owned Laundries
  const loadBranchData = useCallback(async () => {
    setIsLoading(true);
    try {
      let profile: UserProfile | null = null;
      if (isSupabaseConfigured) {
        profile = await authService.fetchCurrentProfile();
      } else {
        profile = authService.getCurrentUserSync();
      }

      setCurrentUser(profile);

      if (!profile || (profile.role !== 'laundry_owner' && profile.role !== 'laundry_staff' && profile.role !== 'admin' && profile.role !== 'platform_admin')) {
        setOwnedLaundries([]);
        setActiveLaundryIdState(null);
        setIsLoading(false);
        return;
      }

      let laundries: Laundry[] = [];
      if (isSupabaseConfigured) {
        laundries = await laundryService.getLaundriesByOwnerAsync(profile.id);
      } else {
        const mockLaundries = await laundryService.getLaundriesAsync();
        laundries = mockLaundries.filter(
          (l) => l.ownerId === profile.id || l.id === profile.laundryId
        );
        if (laundries.length === 0 && profile.role === 'laundry_owner') {
          laundries = DEMO_LAUNDRIES;
        }
      }

      setOwnedLaundries(laundries);

      if (laundries.length > 0) {
        // Priority Resolution:
        // 1. URL Query Param (?branch=...) if valid in ownedLaundries
        // 2. LocalStorage (cuciyan_active_branch) if valid
        // 3. profile.laundryId if valid
        // 4. ownedLaundries[0].id
        let resolvedId: string | null = null;

        if (urlBranchParam && laundries.some((l) => l.id === urlBranchParam)) {
          resolvedId = urlBranchParam;
        } else {
          let storedId: string | null = null;
          try {
            storedId = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null;
          } catch {
            storedId = null;
          }

          if (storedId && laundries.some((l) => l.id === storedId)) {
            resolvedId = storedId;
          } else if (profile.laundryId && laundries.some((l) => l.id === profile.laundryId)) {
            resolvedId = profile.laundryId;
          } else {
            resolvedId = laundries[0].id;
          }
        }

        setActiveLaundryIdState(resolvedId);

        // Sync LocalStorage securely
        try {
          if (resolvedId && typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_KEY, resolvedId);
          }
        } catch {
          // Ignore LocalStorage access errors
        }
      } else {
        setActiveLaundryIdState(null);
      }
    } catch (err) {
      console.warn('[OWNER-BRANCH-CONTEXT] Error loading branch data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [urlBranchParam]);

  useEffect(() => {
    loadBranchData();
  }, [loadBranchData]);

  // Sync activeLaundryId when URL ?branch= changes to another valid owned laundry
  useEffect(() => {
    if (urlBranchParam && ownedLaundries.some((l) => l.id === urlBranchParam)) {
      if (urlBranchParam !== activeLaundryId) {
        setActiveLaundryIdState(urlBranchParam);
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_KEY, urlBranchParam);
          }
        } catch {}
      }
    }
  }, [urlBranchParam, ownedLaundries, activeLaundryId]);

  const setActiveLaundryId = useCallback(
    (newLaundryId: string) => {
      // SECURITY: Validate that newLaundryId is owned by the current owner
      const targetLaundry = ownedLaundries.find((l) => l.id === newLaundryId);
      if (!targetLaundry) {
        console.warn(`[OWNER-BRANCH-CONTEXT] Access Denied: Candidate laundry ${newLaundryId} is not in owned laundries list.`);
        return;
      }

      setActiveLaundryIdState(newLaundryId);

      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_KEY, newLaundryId);
        }
      } catch {}

      // Update URL search parameters seamlessly preserving current tab & other params
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        params.set('branch', newLaundryId);
        const newUrl = `${pathname}?${params.toString()}`;
        router.replace(newUrl);
      }
    },
    [ownedLaundries, pathname, router]
  );

  const activeLaundry = useMemo(() => {
    if (!activeLaundryId || !ownedLaundries.length) return null;
    return ownedLaundries.find((l) => l.id === activeLaundryId) || null;
  }, [activeLaundryId, ownedLaundries]);

  const buildBranchUrl = useCallback(
    (targetPathname: string, overrideBranchId?: string) => {
      const targetId = overrideBranchId || activeLaundryId;
      if (!targetId) return targetPathname;
      const [path, queryStr] = targetPathname.split('?');
      const params = new URLSearchParams(queryStr || '');
      params.set('branch', targetId);
      return `${path}?${params.toString()}`;
    },
    [activeLaundryId]
  );

  const value = useMemo(
    () => ({
      currentUser,
      ownedLaundries,
      activeLaundryId,
      activeLaundry,
      setActiveLaundryId,
      isLoading,
      buildBranchUrl,
      refreshLaundries: loadBranchData,
    }),
    [currentUser, ownedLaundries, activeLaundryId, activeLaundry, setActiveLaundryId, isLoading, buildBranchUrl, loadBranchData]
  );

  return <OwnerBranchContext.Provider value={value}>{children}</OwnerBranchContext.Provider>;
};

export const useOwnerBranch = (): OwnerBranchContextType => {
  const context = useContext(OwnerBranchContext);
  if (!context) {
    throw new Error('useOwnerBranch must be used within an OwnerBranchProvider');
  }
  return context;
};
