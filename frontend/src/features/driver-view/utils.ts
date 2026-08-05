import type { DeliveryRegistration } from '../../lib/types';
import { deliveryUnitPresentation, unitTicketPrefix } from '../../lib/unitPresentation';
import type { DriverDeliveryLists, DriverUnitBrand } from './types';

export function getDriverBrand(delivery: DeliveryRegistration): DriverUnitBrand {
  const unit = deliveryUnitPresentation(delivery);
  return {
    label: unit.label,
    icon: unit.icon,
    bg: 'bg-thiso-50',
    border: 'border-thiso-200',
    text: 'text-thiso-700',
    sttBg: `${unit.color}18`,
    sttColor: unit.color,
  };
}

export function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // not supported
  }
}

export async function requestNotifPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function sendNotif(title: string, body: string) {
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/icons/icon-192.png' });
    } catch {
      // browser notification failed
    }
  }
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function minutesUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 60000);
}

export function computeStt(delivery: DeliveryRegistration, allDeliveries: DeliveryRegistration[]): string {
  const unit = delivery.unitConfigId ?? delivery.receivingUnit;
  const prefix = unitTicketPrefix(delivery.receivingUnit, delivery.unitConfig ?? delivery.assignedSlot?.zone?.unitConfig);

  const unitDeliveries = allDeliveries.filter((item) => (item.unitConfigId ?? item.receivingUnit) === unit);
  const called = unitDeliveries.filter((item) => item.status === 'CALLED');
  const waiting = unitDeliveries.filter((item) => item.status === 'WAITING');

  if (['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(delivery.status)) return `${prefix}-✓`;
  if (delivery.status === 'CALLED') {
    const index = called.findIndex((item) => item.id === delivery.id);
    return index < 0 ? prefix : `${prefix}-${index + 1}`;
  }
  if (delivery.status === 'WAITING') {
    const index = waiting.findIndex((item) => item.id === delivery.id);
    return index < 0 ? prefix : `${prefix}-${called.length + index + 1}`;
  }
  return prefix;
}

export function getDriverDeliveries(plate: string, allDeliveries: DeliveryRegistration[]): DriverDeliveryLists {
  const myDeliveries = plate
    ? allDeliveries.filter((delivery) => delivery.vehiclePlate.toUpperCase() === plate.toUpperCase())
    : [];
  const myActive = myDeliveries.filter((delivery) => !['COMPLETED', 'CANCELLED'].includes(delivery.status));
  const myCompleted = myDeliveries.filter((delivery) => ['COMPLETED', 'CANCELLED'].includes(delivery.status));
  return { myDeliveries, myActive, myCompleted };
}
