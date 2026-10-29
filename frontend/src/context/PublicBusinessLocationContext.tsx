import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import api from '../lib/api';
import type { BusinessLocation } from '../lib/types';

const STORAGE_KEY = 'dqm_public_business_location_id';

type PublicBusinessLocationContextValue = {
  locations: BusinessLocation[];
  selectedBusinessLocationId: string | null;
  selectedBusinessLocation: BusinessLocation | null;
  isLoading: boolean;
  error: string | null;
  selectPublicBusinessLocation: (businessLocationId: string) => void;
  refreshPublicBusinessLocations: () => Promise<void>;
};

const PublicBusinessLocationContext = createContext<PublicBusinessLocationContextValue | null>(null);

function storedLocationId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function publicLocationError(error: unknown) {
  const response = (error as { response?: { data?: { message?: string; error?: string } } })?.response;
  return response?.data?.message ?? response?.data?.error ?? 'Không thể tải danh sách khu vực.';
}

export function PublicBusinessLocationProvider({ children }: { children: ReactNode }) {
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [selectedBusinessLocationId, setSelectedBusinessLocationId] = useState<string | null>(storedLocationId);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPublicBusinessLocations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<BusinessLocation[]>('/api/units/public/business-locations');
      const nextLocations = response.data.filter((location) => location.isActive !== false);
      setLocations(nextLocations);
      setSelectedBusinessLocationId((current) => {
        if (nextLocations.some((location) => location.id === current)) return current;
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Storage can be unavailable in restricted browsing contexts.
        }
        return null;
      });
    } catch (err) {
      setLocations([]);
      setError(publicLocationError(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void refreshPublicBusinessLocations(); }, [refreshPublicBusinessLocations]);

  const selectPublicBusinessLocation = useCallback((businessLocationId: string) => {
    if (!locations.some((location) => location.id === businessLocationId)) return;
    setSelectedBusinessLocationId(businessLocationId);
    try {
      localStorage.setItem(STORAGE_KEY, businessLocationId);
    } catch {
      // The selection remains available for the current browser session.
    }
  }, [locations]);

  const selectedBusinessLocation = useMemo(
    () => locations.find((location) => location.id === selectedBusinessLocationId) ?? null,
    [locations, selectedBusinessLocationId],
  );

  return (
    <PublicBusinessLocationContext.Provider value={{
      locations,
      selectedBusinessLocationId,
      selectedBusinessLocation,
      isLoading,
      error,
      selectPublicBusinessLocation,
      refreshPublicBusinessLocations,
    }}>
      {children}
    </PublicBusinessLocationContext.Provider>
  );
}

export function usePublicBusinessLocation() {
  const context = useContext(PublicBusinessLocationContext);
  if (!context) throw new Error('usePublicBusinessLocation must be used within PublicBusinessLocationProvider');
  return context;
}
