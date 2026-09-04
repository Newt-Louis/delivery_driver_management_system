import type { Slot } from '../../lib/types';

export type SlotStatusValue = Slot['status'];

export type SlotGroup = {
  key: string;
  label: string;
  icon: string;
  color: string;
  slots: Slot[];
};

export type DockStats = {
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
  trucks: number;
  motorbikes: number;
};
