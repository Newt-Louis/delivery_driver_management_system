import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import api from '../lib/api';
import type { ReceivingUnit } from '../lib/types';

export interface UnitBranding {
  displayName: string;
  shortName: string;
  description: string;
  logoUrl: string | null;
  primaryColor: string;
}

export interface MallBranding {
  mallName: string;
  logoUrl: string | null;
  tagline: string | null;
}

export interface BrandingData {
  mall: MallBranding;
  units: Record<ReceivingUnit, UnitBranding>;
  isLoaded: boolean;
  refresh: () => void;
}

// Static fallbacks — used until API responds and when fields are empty
const UNIT_FALLBACKS: Record<ReceivingUnit, UnitBranding & { icon: string }> = {
  EMART:      { displayName: 'Emart',             shortName: 'Emart',   description: 'Siêu thị',             logoUrl: null, primaryColor: '#FF9500', icon: '🏬' },
  THISKYHALL: { displayName: 'Thiskyhall',         shortName: 'Skyhall', description: 'Trung tâm thương mại', logoUrl: null, primaryColor: '#27A55E', icon: '🏢' },
  TENANT:     { displayName: 'Mall (Khách thuê)', shortName: 'Mall',    description: 'Khu vực khách thuê',   logoUrl: null, primaryColor: '#1C1C1C', icon: '🏪' },
};

const MALL_FALLBACK: MallBranding = {
  mallName: 'THISO GROUP',
  logoUrl: null,
  tagline: 'Delivery Management System',
};

const INITIAL: BrandingData = {
  mall: MALL_FALLBACK,
  units: {
    EMART:      UNIT_FALLBACKS.EMART,
    THISKYHALL: UNIT_FALLBACKS.THISKYHALL,
    TENANT:     UNIT_FALLBACKS.TENANT,
  },
  isLoaded: false,
  refresh: () => {},
};

const BrandingContext = createContext<BrandingData>(INITIAL);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Omit<BrandingData, 'refresh' | 'isLoaded'> & { isLoaded: boolean }>({
    mall: MALL_FALLBACK,
    units: INITIAL.units,
    isLoaded: false,
  });

  async function load() {
    try {
      const res = await api.get('/api/brand');
      const { mall, units } = res.data as { mall: MallBranding; units: Record<ReceivingUnit, UnitBranding> };
      // Merge with fallbacks so empty strings fall back gracefully
      const mergedUnits = {} as Record<ReceivingUnit, UnitBranding>;
      for (const u of ['EMART', 'THISKYHALL', 'TENANT'] as ReceivingUnit[]) {
        const fb = UNIT_FALLBACKS[u];
        mergedUnits[u] = {
          displayName:  units[u]?.displayName  || fb.displayName,
          shortName:    units[u]?.shortName    || fb.shortName,
          description:  units[u]?.description  || fb.description,
          logoUrl:      units[u]?.logoUrl      ?? null,
          primaryColor: units[u]?.primaryColor || fb.primaryColor,
        };
      }
      setData({
        mall: {
          mallName: mall.mallName || MALL_FALLBACK.mallName,
          logoUrl:  mall.logoUrl  ?? null,
          tagline:  mall.tagline  ?? MALL_FALLBACK.tagline,
        },
        units: mergedUnits,
        isLoaded: true,
      });
    } catch {
      setData(d => ({ ...d, isLoaded: true }));
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <BrandingContext.Provider value={{ ...data, refresh: load }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingData {
  return useContext(BrandingContext);
}

export function useUnitBrand(unit: ReceivingUnit): UnitBranding & { icon: string } {
  const { units } = useContext(BrandingContext);
  const fb = UNIT_FALLBACKS[unit];
  const u = units[unit];
  return { ...u, icon: fb.icon };
}

// Expose fallbacks for non-hook contexts (e.g. print windows)
export { UNIT_FALLBACKS };
