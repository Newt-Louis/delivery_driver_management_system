import type { AutoWarehouseVendor, DeliveryTimeWindow, ReceivingTimeConfig, Slot, UnitConfig, UnitGoodsType, User, Zone } from '../../lib/types';

export interface BusinessLocation {
  id: string;
  code: string;
  locationName: string;
  address: string;
  avatarUrl: string | null;
  logoUrl: string | null;
  tagline: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { unitConfigs?: number; users?: number; devices?: number };
}

export interface SuperadminOverview {
  counts: Record<string, number>;
  locations: Array<BusinessLocation & {
    unitConfigs: Pick<UnitConfig, 'id' | 'unit' | 'displayName' | 'shortName' | 'icon' | 'isActive'>[];
  }>;
}

export interface AppConfigItem {
  id: string;
  key: string;
  category: string;
  value: unknown;
  valueType: string;
  description: string;
  isSensitive: boolean;
  isRuntimeEditable: boolean;
  masked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceItem {
  id: string;
  code: string;
  name: string;
  businessLocationId: string;
  deviceType: string;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SuperadminTab =
  | 'locations'
  | 'units'
  | 'zones'
  | 'slots'
  | 'users'
  | 'goods'
  | 'windows'
  | 'awvendors'
  | 'devices'
  | 'appconfigs'
  | 'apiconfigs'
  | 'receivingTimes';

export interface SuperadminData {
  overview: SuperadminOverview;
  locations: BusinessLocation[];
  units: UnitConfig[];
  zones: Zone[];
  slots: Slot[];
  users: User[];
  goodsTypes: UnitGoodsType[];
  timeWindows: DeliveryTimeWindow[];
  autoWarehouseVendors: AutoWarehouseVendor[];
  devices: DeviceItem[];
  appConfigs: AppConfigItem[];
  receivingTimeConfigs: ReceivingTimeConfig[];
}
