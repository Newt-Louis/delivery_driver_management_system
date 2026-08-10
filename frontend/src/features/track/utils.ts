import { formatTicketCode as formatDynamicTicketCode, unitPresentation } from '../../lib/unitPresentation';
import type { TrackDelivery } from './types';

export function looksLikeCode(val: string): boolean {
  return /^[ETM]\d{7,}/.test(val);
}

export function formatTicketCode(delivery: TrackDelivery): string {
  return formatDynamicTicketCode(
    delivery.receivingUnit,
    delivery.vehicleType,
    delivery.ticketNumber ?? 0,
    delivery.unitConfig,
  );
}

export function getTrackUnit(delivery: TrackDelivery) {
  const cfg = delivery.unitConfig ?? delivery.assignedSlot?.zone?.unitConfig ?? null;
  return unitPresentation(delivery.receivingUnit, cfg);
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
  });
}

export function fmtDateOnly(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
