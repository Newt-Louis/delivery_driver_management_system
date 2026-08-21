import type { DeliveryRegistration, DispatchData, UnitDispatch } from '../../lib/types';
import { minutesSince } from '../../lib/utils';
import {
  formatTicketCode as formatDynamicTicketCode,
  unitFallbackColor,
  unitPresentation,
} from '../../lib/unitPresentation';
import {
  DISPATCH_CSV_HEADERS,
  EVENT_LABEL,
  GOODS_CSV_LABEL,
  STATUS_CSV_LABEL,
  STATUS_ORDER,
  VEHICLE_LABEL,
  formatEventLabel,
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

export function getTicketCode(
  delivery: DeliveryRegistration,
  unitConfig?: UnitDispatch['unitConfig'] | null,
): string | null {
  const ticketUnitConfig = unitConfig
    ?? delivery.unitConfig
    ?? delivery.assignedSlot?.zone?.unitConfig;
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
  const color = unitConfig?.primaryColor || unitFallbackColor(unit);
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

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getDeliveryTimeline(delivery: DeliveryRegistration) {
  const timeline: { time: string; label: string; icon: string; accent?: string }[] = [
    { time: delivery.createdAt, label: 'Đăng ký giao hàng', icon: '📝' },
  ];

  if (delivery.checkinTime) {
    timeline.push({ time: delivery.checkinTime, label: 'Check-in tại cổng', icon: '🔐' });
  }

  if (delivery.historyEvents?.length) {
    delivery.historyEvents.forEach((event) => {
      const meta = EVENT_LABEL[event.eventType] ?? { icon: '•' };
      timeline.push({
        time: event.occurredAt,
        label: formatEventLabel(event),
        icon: meta.icon,
        accent: meta.accent,
      });
    });
  } else {
    if (delivery.receivingStartTime) {
      timeline.push({ time: delivery.receivingStartTime, label: 'Bắt đầu nhận hàng', icon: '📦', accent: 'text-green-700' });
    }
    if (delivery.completedTime) {
      timeline.push({ time: delivery.completedTime, label: 'Hoàn tất nhận hàng', icon: '✅', accent: 'text-green-700' });
    }
    if (delivery.status === 'CANCELLED') {
      timeline.push({ time: delivery.updatedAt, label: 'Đã hủy', icon: '❌', accent: 'text-red-600' });
    }
  }

  return timeline.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
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
        delivery.vendorName.toLowerCase().includes(query) ||
        delivery.driverName?.toLowerCase().includes(query) ||
        delivery.registrationCode.toLowerCase().includes(query) ||
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
    const unitConfig = delivery.unitConfig
      ?? delivery.assignedSlot?.zone?.unitConfig
      ?? unitConfigsByUnit?.[delivery.receivingUnit];
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
      delivery.assignedSlot?.code ?? '',
      STATUS_CSV_LABEL[delivery.status] ?? delivery.status,
      delivery.checkinTime ? new Date(delivery.checkinTime).toLocaleString('vi-VN') : '',
      delivery.checkinTime ? Math.round((Date.now() - new Date(delivery.checkinTime).getTime()) / 60000) : '',
    ];
  });
}

export function getAllActiveDeliveries(dispatch: DispatchData): DeliveryRegistration[] {
  return Object.keys(dispatch).flatMap((unit) => dispatch[unit]?.active ?? [])
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
    return { key, label: meta.label, icon: meta.icon, unitConfig: value.unitConfig };
  });
}

export function getDashboardTabs(dispatch?: DispatchData): { key: TabKey; label: string; icon: string; unitConfig?: UnitDispatch['unitConfig'] }[] {
  return [
    { key: 'ALL', label: 'Tất cả', icon: '📊' },
    ...getUnitTabs(dispatch),
  ];
}

export function getTotalWaiting(dispatch?: DispatchData): number {
  if (!dispatch) return 0;
  return Object.keys(dispatch).reduce(
    (sum, unit) => sum + (dispatch[unit]?.insights.stats.waiting ?? 0),
    0,
  );
}

export function getDispatchSlots(dispatch?: DispatchData) {
  return dispatch ? Object.values(dispatch).flatMap((unitDispatch) => unitDispatch.slots ?? []) : [];
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
