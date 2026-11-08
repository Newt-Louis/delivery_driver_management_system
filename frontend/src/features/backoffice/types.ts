import type { ReceivingUnit } from '../../lib/types';

export type BackofficeTab =
  | 'slots'
  | 'zones'
  | 'units'
  | 'brand'
  | 'staff'
  | 'awvendors'
  | 'devices';

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: string;
  unit: ReceivingUnit | null;
  unitPermissions?: Array<{
    id: string;
    unit: ReceivingUnit;
    displayName: string;
    icon?: string | null;
    businessLocationId: string;
  }>;
  department: string | null;
  businessLocationId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface StaffUser extends SystemUser {
  role: 'ADMIN_OPE' | 'RECEIVING' | 'CHECKIN';
}

export type DeviceType = 'FIXED_DEVICE' | 'PDA' | 'TABLET' | 'TV';

export interface DeviceItem {
  id: string;
  code: string;
  name: string;
  businessLocationId: string;
  businessLocation?: { id: string; code: string; locationName: string } | null;
  deviceType: DeviceType;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}
