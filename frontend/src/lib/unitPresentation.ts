import type { DeliveryRegistration } from './types';

export interface UnitBrandSource {
  unit?: string | null;
  displayName?: string | null;
  shortName?: string | null;
  icon?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

const FALLBACK_COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#6366F1', '#E11D48', '#1C1C1C'];

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function unitFallbackColor(unit: string | null | undefined): string {
  const key = unit || 'UNIT';
  return FALLBACK_COLORS[hashText(key) % FALLBACK_COLORS.length];
}

export function normalizeTicketPrefix(value: string | null | undefined): string {
  const normalized = (value || 'UNIT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  return normalized || 'UNIT';
}

export function unitTicketPrefix(unit: string, unitConfig?: Partial<UnitBrandSource> | null): string {
  return normalizeTicketPrefix(unitConfig?.shortName || unitConfig?.displayName || unit);
}

export function formatTicketCode(
  unit: string,
  vehicleType: string,
  ticketNumber: number,
  unitConfig?: Partial<UnitBrandSource> | null,
): string {
  const vehiclePrefix: Record<string, string> = { TRUCK: 'T', MOTORBIKE: 'M', OTHER: 'X' };
  return `${unitTicketPrefix(unit, unitConfig)}-${vehiclePrefix[vehicleType] ?? 'X'}${String(ticketNumber).padStart(3, '0')}`;
}

export function getDeliveryUnitConfig(delivery: DeliveryRegistration): Partial<UnitBrandSource> | null {
  return delivery.unitConfig ?? delivery.assignedSlot?.zone?.unitConfig ?? null;
}

export function unitPresentation(
  unit: string,
  unitConfig?: Partial<UnitBrandSource> | null,
) {
  const color = unitConfig?.primaryColor || unitFallbackColor(unit);
  const label = unitConfig?.displayName || unitConfig?.shortName || unit;
  return {
    code: unitConfig?.unit || unit,
    label,
    shortName: unitConfig?.shortName || unitConfig?.displayName || unit,
    icon: unitConfig?.icon || '◆',
    logoUrl: unitConfig?.logoUrl ?? null,
    primaryColor: color,
    color,
    prefix: unitTicketPrefix(unit, unitConfig),
  };
}

export function deliveryUnitPresentation(delivery: DeliveryRegistration) {
  return unitPresentation(delivery.receivingUnit, getDeliveryUnitConfig(delivery));
}
