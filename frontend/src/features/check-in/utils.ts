import type { DeliveryRegistration } from '../../lib/types';
import { deliveryUnitPresentation, formatTicketCode as formatDynamicTicketCode } from '../../lib/unitPresentation';
import { GOODS_LABEL, VEHICLE_LABEL } from './constants';

export function getTicketCode(delivery: DeliveryRegistration): string {
  return formatDynamicTicketCode(
    delivery.receivingUnit,
    delivery.vehicleType,
    delivery.ticketNumber ?? 0,
    delivery.unitConfig,
  );
}

export function getUnitMeta(delivery: DeliveryRegistration) {
  return deliveryUnitPresentation(delivery);
}

export function getWaitingMinutes(delivery: DeliveryRegistration, now = Date.now()): number | null {
  if (!delivery.checkinTime) return null;
  return Math.round((now - new Date(delivery.checkinTime).getTime()) / 60000);
}

export function buildWaitingCsvRows(deliveries: DeliveryRegistration[]) {
  const now = Date.now();
  return deliveries.map((delivery) => [
    delivery.ticketNumber != null ? getTicketCode(delivery) : '',
    delivery.registrationCode,
    delivery.vehiclePlate,
    delivery.driverName,
    delivery.vendorName,
    getUnitMeta(delivery).label,
    GOODS_LABEL[delivery.goodsType] ?? delivery.goodsType,
    VEHICLE_LABEL[delivery.vehicleType] ?? delivery.vehicleType,
    getWaitingMinutes(delivery, now) ?? '',
  ]);
}
