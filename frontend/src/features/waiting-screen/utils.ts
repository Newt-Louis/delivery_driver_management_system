import { formatTicketCode as formatDynamicTicketCode, unitPresentation } from '../../lib/unitPresentation';
import type { DeliveryRegistration } from '../../lib/types';
import type { BrandConfig } from './types';

export function formatTicketForDelivery(delivery: DeliveryRegistration): string | null {
  if (!delivery.ticketNumber) return null;
  const unitConfig = delivery.unitConfig ?? delivery.assignedSlot?.zone?.unitConfig;
  return formatDynamicTicketCode(delivery.receivingUnit, delivery.vehicleType, delivery.ticketNumber, unitConfig);
}

export function fallbackUnitDef(unit: string | null | undefined) {
  return unitPresentation(unit || 'UNIT');
}

export function getUnitBrand(brand: BrandConfig | null, unit: string | null | undefined) {
  const def = fallbackUnitDef(unit);
  const cfg = unit ? brand?.units[unit] : null;
  return {
    ...def,
    ...cfg,
    icon: cfg?.icon || def.icon,
    logoUrl: cfg?.logoUrl ?? null,
    primaryColor: cfg?.primaryColor || def.primaryColor,
  };
}

export function getDeliveryUnitKey(delivery: DeliveryRegistration): string {
  return delivery.assignedSlot?.zone?.unitConfig?.unit ?? delivery.receivingUnit;
}
