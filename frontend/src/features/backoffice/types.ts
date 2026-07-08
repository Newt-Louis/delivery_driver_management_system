import type { ReceivingUnit } from '../../lib/types';

export type UnitKey = 'EMART' | 'THISKYHALL' | 'TENANT';

export type BackofficeTab =
  | 'slots'
  | 'zones'
  | 'units'
  | 'brand'
  | 'staff'
  | 'users'
  | 'awvendors';

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
