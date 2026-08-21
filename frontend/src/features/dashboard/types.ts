import type { CSSProperties } from 'react';

export type UnitKey = string;
export type TabKey = 'ALL' | UnitKey;
export type StatusFilter = 'ALL' | 'WAITING' | 'CALLED' | 'RECEIVING';
export type VehicleTypeFilter = 'ALL' | 'TRUCK' | 'MOTORBIKE';
export type DeliveryLifecycleAction = 'start-receiving' | 'complete' | 'cancel';

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
