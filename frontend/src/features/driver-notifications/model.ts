import type { TrackDelivery } from '../track/types';

export const FOLLOW_KEY = 'dqm_followed_trip_v1';
export const FOLLOW_CHANGED = 'dqm-followed-trip-changed';
const PENDING_DETACH_KEY = 'dqm_pending_push_detach_v1';
export const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'INCOMPLETED']);

export interface FollowedTrip {
  code: string;
  plate: string;
  status: string;
  seen: string[];
  lastEventAt: string;
}

export interface DriverNotice {
  deliveryCode: string;
  status: string;
  eventId: string;
  occurredAt: string;
  title: string;
  body: string;
}

export function readFollowedTrip(): FollowedTrip | null {
  try {
    const value = JSON.parse(localStorage.getItem(FOLLOW_KEY) ?? 'null');
    if (!value || typeof value.code !== 'string' || typeof value.plate !== 'string'
      || typeof value.status !== 'string' || !Array.isArray(value.seen)
      || !value.seen.every((id: unknown) => typeof id === 'string') || typeof value.lastEventAt !== 'string') return null;
    return value;
  } catch { return null; }
}

export function writeFollowedTrip(value: FollowedTrip | null) {
  try {
    if (value) localStorage.setItem(FOLLOW_KEY, JSON.stringify(value));
    else localStorage.removeItem(FOLLOW_KEY);
  } catch { /* Following remains available for this page session. */ }
  window.dispatchEvent(new CustomEvent(FOLLOW_CHANGED, { detail: value }));
}

export function pendingPushDetaches(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_DETACH_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((code): code is string => typeof code === 'string') : [];
  } catch { return []; }
}

export function savePendingPushDetaches(codes: Set<string>) {
  try {
    if (codes.size) localStorage.setItem(PENDING_DETACH_KEY, JSON.stringify([...codes]));
    else localStorage.removeItem(PENDING_DETACH_KEY);
  } catch { /* Retry remains available during this app session. */ }
}

export function noticeFromDelivery(delivery: TrackDelivery): DriverNotice {
  const status = delivery.status;
  const occurredAt = (status === 'CALLED' ? delivery.notificationCalledAt ?? delivery.calledTime : status === 'WAITING'
    ? delivery.checkinTime : status === 'COMPLETED' ? delivery.completedTime
      : TERMINAL_STATUSES.has(status) ? delivery.updatedAt : delivery.receivingStartTime) ?? '';
  const slot = delivery.assignedSlot?.code ?? 'khu vực nhận hàng';
  const title = status === 'CALLED' ? `Mời xe vào ${slot}`
    : status === 'WAITING' ? 'Check-in thành công' : status === 'COMPLETED' ? 'Giao hàng hoàn thành' : 'Trạng thái chuyến đã cập nhật';
  const body = status === 'CALLED' ? `Xe ${delivery.vehiclePlate} — Vui lòng di chuyển vào ${slot} ngay.`
    : status === 'WAITING' ? `Xe ${delivery.vehiclePlate} đã vào hàng chờ.`
      : `Xe ${delivery.vehiclePlate} — Cảm ơn bạn đã giao hàng!`;
  return { deliveryCode: delivery.registrationCode, status, occurredAt, eventId: `${delivery.registrationCode}:${status}:${occurredAt}`, title, body };
}

export function acceptsNotice(trip: FollowedTrip, notice: DriverNotice): boolean {
  if (trip.code !== notice.deliveryCode || trip.seen.includes(notice.eventId)) return false;
  // A delayed check-in/call push must not replace a later operational state.
  if (notice.occurredAt && trip.lastEventAt && notice.occurredAt < trip.lastEventAt) return false;
  if (notice.status === 'REGISTERED' && trip.status !== 'REGISTERED') return false;
  if (notice.status === 'WAITING' && !['REGISTERED', 'WAITING'].includes(trip.status)) return false;
  if (notice.status === 'CALLED' && ['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(trip.status)) return false;
  return true;
}
