import type { CSSProperties } from 'react';

export type UnitKey = string;
export type TabKey = 'ALL' | UnitKey;
export type StatusFilter = 'ALL' | 'WAITING' | 'CALLED' | 'RECEIVING';
export type VehicleTypeFilter = 'ALL' | 'TRUCK' | 'MOTORBIKE';
export type DeliveryLifecycleAction = 'start-receiving' | 'complete' | 'cancel';

/** One slot offered by GET /api/deliveries/:id/borrowable-slots ("Mượn slot" popup). */
export interface BorrowableSlot {
  id: string;
  name: string;
  vehicleType: 'TRUCK' | 'MOTORBIKE';
  maxCapacity: number;
  activeCount: number;
  zone: { id: string; code: string; name: string };
  unitConfig: {
    id: string;
    unit: string;
    displayName: string;
    shortName: string;
    icon: string | null;
    logoUrl: string | null;
    primaryColor: string;
    businessLocationId: string;
  };
}

export interface BorrowableSlotsResponse {
  deliveryId: string;
  vehicleType: 'TRUCK' | 'MOTORBIKE';
  /** Same unit as the delivery, still has free capacity. */
  sameUnit: BorrowableSlot[];
  /** Other units in the same BusinessLocation, completely empty. */
  otherUnits: BorrowableSlot[];
}

export interface UnitMeta {
  label: string;
  icon: string;
  logoUrl: string | null;
  prefix: string;
  color: string;
  headerStyle: CSSProperties;
  badgeStyle: CSSProperties;
  tabActiveStyle: CSSProperties;
  rowBorderStyle: CSSProperties;
}
