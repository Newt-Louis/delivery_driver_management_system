import { formatTicketCode as formatDynamicTicketCode, unitPresentation, type UnitBrandSource } from '../../lib/unitPresentation';
import type { DeliveryRegistration } from '../../lib/types';
import type { BrandConfig } from './types';

const WAITING_SCREEN_VISIBLE_STATUSES = new Set<DeliveryRegistration['status']>(['CALLED', 'WAITING']);

function timestamp(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

export function formatTicketForDelivery(delivery: DeliveryRegistration): string | null {
  if (!delivery.ticketNumber) return null;
  const unitConfig = delivery.unitConfig ?? delivery.assignedSlot?.zone?.unitConfig;
  return formatDynamicTicketCode(delivery.receivingUnit, delivery.vehicleType, delivery.ticketNumber, unitConfig);
}

export function isWaitingScreenVisibleDelivery(delivery: DeliveryRegistration): boolean {
  return WAITING_SCREEN_VISIBLE_STATUSES.has(delivery.status);
}

export function compareWaitingScreenQueueOrder(a: DeliveryRegistration, b: DeliveryRegistration): number {
  const byCheckinTime = timestamp(a.checkinTime) - timestamp(b.checkinTime);
  if (byCheckinTime !== 0) return byCheckinTime;

  const byTicketNumber = (a.ticketNumber ?? Number.POSITIVE_INFINITY) - (b.ticketNumber ?? Number.POSITIVE_INFINITY);
  if (byTicketNumber !== 0) return byTicketNumber;

  const byCreatedAt = timestamp(a.createdAt) - timestamp(b.createdAt);
  if (byCreatedAt !== 0) return byCreatedAt;

  return a.registrationCode.localeCompare(b.registrationCode);
}

export function normalizeWaitingScreenDeliveries(deliveries: DeliveryRegistration[]): DeliveryRegistration[] {
  return deliveries
    .filter(isWaitingScreenVisibleDelivery)
    .sort(compareWaitingScreenQueueOrder);
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
