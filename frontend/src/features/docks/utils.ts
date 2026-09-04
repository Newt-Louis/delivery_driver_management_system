import type { Slot } from '../../lib/types';
import type { DockStats, SlotGroup } from './types';

const DEFAULT_UNIT_COLOR = '#FF9500';

export function buildDockStats(slots: Slot[]): DockStats {
  return {
    available: slots.filter((slot) => slot.status === 'AVAILABLE').length,
    occupied: slots.filter((slot) => slot.status === 'OCCUPIED').length,
    reserved: slots.filter((slot) => slot.status === 'RESERVED').length,
    maintenance: slots.filter((slot) => slot.status === 'MAINTENANCE').length,
    trucks: slots.filter((slot) => slot.vehicleType === 'TRUCK').length,
    motorbikes: slots.filter((slot) => slot.vehicleType === 'MOTORBIKE').length,
  };
}

export function groupSlotsByUnit(slots: Slot[]): SlotGroup[] {
  const groups = new Map<string, SlotGroup>();

  for (const slot of slots) {
    const unitConfig = slot.zone?.unitConfig;
    const key = unitConfig?.id ?? slot.assignedUnit;
    const existing = groups.get(key);
    if (existing) {
      existing.slots.push(slot);
      continue;
    }

    groups.set(key, {
      key,
      label: unitConfig?.displayName || unitConfig?.shortName || slot.assignedUnit,
      icon: unitConfig?.icon || '◆',
      color: unitConfig?.primaryColor?.trim() || DEFAULT_UNIT_COLOR,
      slots: [slot],
    });
  }

  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'vi'));
}

export function splitSlotsByVehicle(slots: Slot[]) {
  return {
    truckSlots: slots.filter((slot) => slot.vehicleType === 'TRUCK'),
    motorbikeSlots: slots.filter((slot) => slot.vehicleType === 'MOTORBIKE'),
    otherSlots: slots.filter((slot) => slot.vehicleType === 'OTHER'),
  };
}
