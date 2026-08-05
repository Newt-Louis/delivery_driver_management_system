export type UnitKey = string;
export type TabKey = 'ALL' | UnitKey;
export type StatusFilter = 'ALL' | 'WAITING' | 'CALLED' | 'RECEIVING';
export type VehicleTypeFilter = 'ALL' | 'TRUCK' | 'MOTORBIKE';
export type DeliveryLifecycleAction = 'start-receiving' | 'complete' | 'cancel';

export interface UnitMeta {
  label: string;
  icon: string;
  prefix: string;
  color: string;
  lightBg: string;
  border: string;
  headerBg: string;
  badge: string;
  tabActive: string;
  rowBorder: string;
}
