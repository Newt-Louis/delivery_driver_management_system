import type { DeliveryRegistration, DispatchData, UnitDispatch } from '../../lib/types';
import { minutesSince } from '../../lib/utils';
import {
  formatTicketCode as formatDynamicTicketCode,
  unitPresentation,
} from '../../lib/unitPresentation';
import {
  DISPATCH_CSV_HEADERS,
  GOODS_CSV_LABEL,
  STATUS_CSV_LABEL,
  STATUS_ORDER,
  VEHICLE_LABEL,
} from './constants';
import type { StatusFilter, TabKey, UnitKey, UnitMeta, VehicleTypeFilter } from './types';

function hexToRgb(color: string): { r: number; g: number; b: number } | null {
  const normalized = color.trim();
  const full = /^#([0-9a-fA-F]{6})$/.exec(normalized);
  if (full) {
    const value = full[1];
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  const short = /^#([0-9a-fA-F]{3})$/.exec(normalized);
  if (short) {
    const value = short[1];
    return {
      r: parseInt(value[0] + value[0], 16),
      g: parseInt(value[1] + value[1], 16),
      b: parseInt(value[2] + value[2], 16),
    };
  }

  return null;
}

function colorWithAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function mixWithBlack(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const mix = (value: number) => Math.round(value * (1 - amount));
  return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
}

/**
 * UnitConfig of the unit the driver delivers to. Never derived from a slot owned by another unit:
 * a borrowed slot ("Mượn slot") belongs to the lender, the delivery still belongs to its own unit.
 */
export function getDeliveryUnitConfig(
  delivery: Pick<DeliveryRegistration, 'receivingUnit' | 'unitConfig' | 'assignedSlot'>,
  fallback?: UnitDispatch['unitConfig'] | null,
): UnitDispatch['unitConfig'] | undefined {
  if (delivery.unitConfig) return delivery.unitConfig;
  if (fallback && fallback.unit === delivery.receivingUnit) return fallback;
  const slotUnitConfig = delivery.assignedSlot?.zone?.unitConfig;
  return slotUnitConfig?.unit === delivery.receivingUnit ? slotUnitConfig : undefined;
}

export function getTicketCode(
  delivery: DeliveryRegistration,
  unitConfig?: UnitDispatch['unitConfig'] | null,
): string | null {
  const ticketUnitConfig = getDeliveryUnitConfig(delivery, unitConfig);
  return delivery.ticketNumber
    ? formatDynamicTicketCode(
      delivery.receivingUnit,
      delivery.vehicleType,
      delivery.ticketNumber,
      ticketUnitConfig,
    )
    : null;
}

export function getUnitMeta(unit: string, unitConfig?: UnitDispatch['unitConfig']): UnitMeta {
  const brand = unitPresentation(unit, unitConfig);
  const color = unitConfig?.primaryColor || '#FF9500';
  return {
    label: brand.label,
    icon: brand.icon,
    logoUrl: brand.logoUrl,
    prefix: brand.prefix,
    color,
    headerStyle: {
      background: `linear-gradient(135deg, ${color}, ${mixWithBlack(color, 0.22)})`,
    },
    badgeStyle: {
      backgroundColor: colorWithAlpha(color, 0.12),
      color,
    },
    tabActiveStyle: {
      backgroundColor: colorWithAlpha(color, 0.08),
      borderColor: colorWithAlpha(color, 0.35),
      color,
    },
    rowBorderStyle: {
      borderLeftColor: color,
    },
  };
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function filterDispatchDeliveries(
  deliveries: DeliveryRegistration[],
  search: string,
  statusFilter: StatusFilter,
  vehicleFilter: VehicleTypeFilter,
) {
  const query = search.trim().toLowerCase();
  return deliveries
    .filter((delivery) => {
      if (statusFilter === 'RECEIVING') {
        if (!['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(delivery.status)) return false;
      } else if (statusFilter !== 'ALL' && delivery.status !== statusFilter) {
        return false;
      }

      if (vehicleFilter !== 'ALL' && delivery.vehicleType !== vehicleFilter) return false;
      if (!query) return true;

      const ticket = getTicketCode(delivery) ?? '';
      return (
        delivery.vehiclePlate.toLowerCase().includes(query) ||
        // Restricted rows (lent slot, no permission) have no vendor/driver/registration fields.
        (delivery.vendorName?.toLowerCase().includes(query) ?? false) ||
        (delivery.driverName?.toLowerCase().includes(query) ?? false) ||
        (delivery.registrationCode?.toLowerCase().includes(query) ?? false) ||
        ticket.toLowerCase().includes(query) ||
        (delivery.poNumber?.toLowerCase().includes(query) ?? false)
      );
    })
    .sort((a, b) => {
      const statusA = STATUS_ORDER[a.status] ?? 9;
      const statusB = STATUS_ORDER[b.status] ?? 9;
      if (statusA !== statusB) return statusA - statusB;
      return new Date(a.checkinTime ?? a.createdAt).getTime() -
        new Date(b.checkinTime ?? b.createdAt).getTime();
    });
}

export function buildDispatchCsvRows(
  deliveries: DeliveryRegistration[],
  unitConfigsByUnit?: Record<string, UnitDispatch['unitConfig'] | undefined>,
) {
  return deliveries.map((delivery) => {
    const unitConfig = getDeliveryUnitConfig(delivery, unitConfigsByUnit?.[delivery.receivingUnit]);
    const unitBrand = unitPresentation(delivery.receivingUnit, unitConfig);
    return [
      getTicketCode(delivery, unitConfig) ?? '',
      delivery.registrationCode,
      delivery.vehiclePlate,
      delivery.driverName,
      delivery.vendorName,
      unitBrand.label,
      GOODS_CSV_LABEL[delivery.goodsType] ?? delivery.goodsType,
      VEHICLE_LABEL[delivery.vehicleType] ?? delivery.vehicleType,
      delivery.assignedSlot?.name ?? '',
      STATUS_CSV_LABEL[delivery.status] ?? delivery.status,
      delivery.checkinTime ? new Date(delivery.checkinTime).toLocaleString('vi-VN') : '',
      delivery.checkinTime ? Math.round((Date.now() - new Date(delivery.checkinTime).getTime()) / 60000) : '',
    ];
  });
}

/**
 * "Tất cả" tab: each delivery once. A borrowed-slot delivery appears in its own unit's `active`
 * and in the lender's `lentSlotRows`; the own-unit row wins. Lent rows are kept only when the
 * borrowing unit is outside the requester's scope.
 */
export function getAllActiveDeliveries(dispatch: DispatchData): DeliveryRegistration[] {
  const own = Object.keys(dispatch).flatMap((unit) => dispatch[unit]?.active ?? []);
  const ownIds = new Set(own.map((delivery) => delivery.id));
  const lent = Object.keys(dispatch)
    .flatMap((unit) => dispatch[unit]?.lentSlotRows ?? [])
    .filter((delivery) => !ownIds.has(delivery.id));
  return [...own, ...lent]
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
      || new Date(a.checkinTime ?? a.createdAt).getTime() - new Date(b.checkinTime ?? b.createdAt).getTime());
}

export function getAllUpcomingDeliveries(dispatch: DispatchData): DeliveryRegistration[] {
  return Object.keys(dispatch).flatMap((unit) => dispatch[unit]?.upcoming ?? [])
    .sort((a, b) => new Date(a.requestedTime ?? a.createdAt).getTime() - new Date(b.requestedTime ?? b.createdAt).getTime());
}

export function getUnitTabs(dispatch?: DispatchData) {
  if (!dispatch) return [];
  return Object.entries(dispatch).map(([key, value]) => {
    const meta = getUnitMeta(key, value.unitConfig);
    return { key, label: meta.label, unitConfig: value.unitConfig };
  });
}

export function getDashboardTabs(dispatch?: DispatchData): { key: TabKey; label: string; unitConfig?: UnitDispatch['unitConfig'] }[] {
  return [
    { key: 'ALL', label: 'Tất cả' },
    ...getUnitTabs(dispatch),
  ];
}

export function getTotalActive(dispatch?: DispatchData): number {
  if (!dispatch) return 0;
  return Object.keys(dispatch).reduce(
    (sum, unit) => sum + (dispatch[unit]?.active.length ?? 0),
    0,
  );
}

export function getDeliveryWaitState(delivery: DeliveryRegistration) {
  const waitMin = minutesSince(delivery.checkinTime);
  const calledMin = minutesSince(delivery.calledTime);
  const isCritical = delivery.goodsType === 'FRESH_FOOD' && delivery.status === 'WAITING' && waitMin >= 30;
  const isWarning = (delivery.goodsType === 'FRESH_FOOD' && delivery.status === 'WAITING' && waitMin >= 20)
    || (delivery.status === 'CALLED' && calledMin >= 15);
  return { waitMin, calledMin, isCritical, isWarning };
}

export { DISPATCH_CSV_HEADERS };
export type { UnitKey };
