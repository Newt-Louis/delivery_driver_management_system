import { EVENT_LABEL } from './constants';
import type { DeliveryHistoryEventItem } from './types';

export function formatDateTime(iso: string | null | undefined, timeStyle: 'short' | 'medium' = 'short') {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle });
}

export function formatEventText(event: DeliveryHistoryEventItem): string {
  const base = EVENT_LABEL[event.eventType]?.label ?? event.eventType;
  const slot = event.slotCode ? ` → ${event.slotCode}` : '';
  const actor = event.actorLabel ? ` (${event.actorLabel})` : '';
  const reason = event.reason ? `: ${event.reason}` : '';
  return `${base}${slot}${actor}${reason}`;
}
