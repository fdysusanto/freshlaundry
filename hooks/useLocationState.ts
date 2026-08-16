import { useState, useEffect, useCallback } from 'react';
import { authService } from '@/services/authService';
import { isSupabaseConfigured } from '@/services/supabase';
import { UserProfile } from '@/types/user';
import { locationService, LocationStateResult } from '@/services/locationService';

export function useLocationState() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [refreshToggle, setRefreshToggle] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      setAuthLoading(true);
      try {
        if (isSupabaseConfigured) {
          const profile = await authService.fetchCurrentProfile();
          if (isMounted) setUser(profile);
        } else {
          const syncUser = authService.getCurrentUserSync();
          // In mock mode without explicit logged-in user, treat as null guest if user has no valid id
          if (isMounted) setUser(syncUser && syncUser.id ? syncUser : null);
        }
      } catch (err) {
        console.warn('[USE-LOCATION-STATE] Auth resolution warning:', err);
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, [refreshToggle]);

  const updateSearchLocation = useCallback((newLocation: string) => {
    locationService.setGuestSearchLocation(newLocation);
    setRefreshToggle((prev) => prev + 1);
  }, []);

  const locationResult: LocationStateResult = locationService.computeLocationState(
    authLoading,
    user
  );

  return {
    ...locationResult,
    authLoading,
    user,
    updateSearchLocation,
    refreshLocation: () => setRefreshToggle((prev) => prev + 1),
  };
}
