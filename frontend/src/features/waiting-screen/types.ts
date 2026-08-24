import type { DeliveryRegistration } from '../../lib/types';

export interface BrandConfig {
  mall: { id?: string; code?: string; mallName: string; logoUrl: string | null; tagline: string };
  units: Record<string, {
    id?: string;
    unit?: string;
    displayName: string;
    shortName: string;
    icon?: string | null;
    logoUrl: string | null;
    primaryColor: string;
  }>;
}

export type UnitKey = string;

export interface CalledAlert {
  vehiclePlate: string;
  slotName: string;
  slotCode: string;
  message: string;
  id: string;
  receivingUnit?: string;
  callCount?: number;
  ticketCode?: string;
  delivery?: DeliveryRegistration;
}
