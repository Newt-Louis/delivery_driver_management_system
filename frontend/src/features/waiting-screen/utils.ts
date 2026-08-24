import { formatTicketCode as formatDynamicTicketCode, unitPresentation, type UnitBrandSource } from '../../lib/unitPresentation';
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

export function getUnitBrand(brand: BrandConfig | null, unit: string | null | undefined, unitConfig?: Partial<UnitBrandSource> | null) {
  const code = unit || unitConfig?.unit || 'UNIT';
  const def = unitPresentation(code, unitConfig);
  const cfg = brand?.units[code] ?? (unitConfig?.unit ? brand?.units[unitConfig.unit] : null);
  return {
    ...def,
    ...unitConfig,
    ...cfg,
    icon: cfg?.icon || unitConfig?.icon || def.icon,
    logoUrl: cfg?.logoUrl ?? unitConfig?.logoUrl ?? null,
    primaryColor: cfg?.primaryColor || unitConfig?.primaryColor || def.primaryColor,
  };
}

export function getDeliveryUnitKey(delivery: DeliveryRegistration): string {
  return delivery.assignedSlot?.zone?.unitConfig?.unit ?? delivery.receivingUnit;
}
