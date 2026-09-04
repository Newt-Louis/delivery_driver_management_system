import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import api from '../lib/api';
import type { ReceivingUnit } from '../lib/types';
import { useAuth } from './AuthContext';

export interface UnitBranding {
  displayName: string;
  shortName: string;
  description: string;
  icon: string | null;
  logoUrl: string | null;
  primaryColor: string;
}

export interface MallBranding {
  id?: string;
  code?: string;
  locationName?: string;
  mallName: string;
  address?: string;
  avatarUrl?: string | null;
  logoUrl: string | null;
  tagline: string | null;
}

export interface BrandingData {
  mall: MallBranding;
  units: Record<ReceivingUnit, UnitBranding>;
  isLoaded: boolean;
  refresh: () => void;
}

const UNKNOWN_UNIT_FALLBACK: UnitBranding = {
  displayName: 'Đơn vị',
  shortName: 'Unit',
  description: '',
  logoUrl: null,
  primaryColor: '#1C1C1C',
  icon: '🏬',
};

const UNIT_FALLBACKS = new Proxy({} as Record<string, UnitBranding>, {
  get(_target, prop: string) {
    return {
      ...UNKNOWN_UNIT_FALLBACK,
      displayName: prop,
      shortName: prop,
    };
  },
}) as Record<ReceivingUnit, UnitBranding>;

const MALL_FALLBACK: MallBranding = {
  mallName: 'THISO GROUP',
  logoUrl: null,
  tagline: 'Delivery Management System',
};

const INITIAL: BrandingData = {
  mall: MALL_FALLBACK,
  units: {},
  isLoaded: false,
  refresh: () => {},
};

const BrandingContext = createContext<BrandingData>(INITIAL);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const businessLocationId = user?.businessLocationId ?? undefined;
  const [data, setData] = useState<Omit<BrandingData, 'refresh' | 'isLoaded'> & { isLoaded: boolean }>({
    mall: MALL_FALLBACK,
    units: INITIAL.units,
    isLoaded: false,
  });

  const load = useCallback(async () => {
    if (isAuthLoading) return;
    if (isAuthenticated && !businessLocationId) {
      setData({ mall: MALL_FALLBACK, units: {}, isLoaded: true });
      return;
    }

    try {
      const res = await api.get('/api/brand', {
        params: businessLocationId ? { businessLocationId } : undefined,
      });
      const { mall, units } = res.data as { mall: MallBranding; units: Record<ReceivingUnit, UnitBranding> };
      // Merge with fallbacks so empty strings fall back gracefully
      const mergedUnits = {} as Record<ReceivingUnit, UnitBranding>;
      const unitCodes = new Set<ReceivingUnit>(Object.keys(units ?? {}));
      for (const u of unitCodes) {
        const fb = UNIT_FALLBACKS[u];
        mergedUnits[u] = {
          displayName:  units[u]?.displayName  || fb.displayName,
          shortName:    units[u]?.shortName    || fb.shortName,
          description:  units[u]?.description  || fb.description,
          icon:         units[u]?.icon         || fb.icon,
          logoUrl:      units[u]?.logoUrl      ?? null,
          primaryColor: units[u]?.primaryColor || fb.primaryColor,
        };
      }
      setData({
        mall: {
          id:         mall.id,
          code:       mall.code,
          locationName: mall.locationName || mall.mallName || MALL_FALLBACK.mallName,
          mallName:   mall.mallName   || mall.locationName || MALL_FALLBACK.mallName,
          address:    mall.address ?? '',
          avatarUrl:  mall.avatarUrl ?? null,
          logoUrl:    mall.logoUrl    ?? null,
          tagline:    mall.tagline    ?? MALL_FALLBACK.tagline,
        },
        units: mergedUnits,
        isLoaded: true,
      });
    } catch {
      setData(d => ({ ...d, isLoaded: true }));
    }
  }, [businessLocationId, isAuthenticated, isAuthLoading]);

  useEffect(() => { load(); }, [load]);

  return (
    <BrandingContext.Provider value={{ ...data, refresh: load }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingData {
  return useContext(BrandingContext);
}

export function useUnitBrand(unit: ReceivingUnit): UnitBranding {
  const { units } = useContext(BrandingContext);
  const fb = UNIT_FALLBACKS[unit];
  const u = units[unit];
  return { ...(u || fb), icon: (u?.icon || fb.icon) };
}

// Expose fallbacks for non-hook contexts (e.g. print windows)
export { UNIT_FALLBACKS };
