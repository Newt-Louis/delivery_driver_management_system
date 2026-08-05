import type { DeliveryRegistration } from '../../lib/types';

export interface DriverUnitBrand {
  label: string;
  icon: string;
  bg: string;
  border: string;
  text: string;
  sttBg: string;
  sttColor: string;
}

export interface AppNotification {
  id: number;
  type: 'called' | 'upcoming' | 'info';
  message: string;
}

export interface DriverDeliveryLists {
  myDeliveries: DeliveryRegistration[];
  myActive: DeliveryRegistration[];
  myCompleted: DeliveryRegistration[];
}
