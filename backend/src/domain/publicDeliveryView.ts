/**
 * Public-safe projections for payloads that reach unauthenticated clients:
 * `GET /api/deliveries/queue` and the `queue_updated` / `slot_updated` socket events
 * (the business-location and unit-config rooms are joinable without login, e.g. waiting-screen TVs).
 *
 * Keep these as explicit allow-lists. Never spread a delivery/slot row into a public payload:
 * driver name/phone, vendor, PO, note and registrationCode (the /track/:code key) must not leak.
 */

type DateLike = Date | string | null;

type UnitConfigSource = {
  id: string;
  unit: string;
  businessLocationId?: string;
  displayName?: string | null;
  shortName?: string | null;
  icon?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

type ZoneSource = {
  id: string;
  code: string;
  name: string;
  unitConfigId?: string;
  unitConfig?: UnitConfigSource | null;
};

type SlotSource = {
  id: string;
  name: string;
  code?: string;
  vehicleType: string;
  status: string;
  assignedUnit?: string;
  zoneId?: string | null;
  maxCapacity?: number;
  isActive?: boolean;
  autoAssign?: boolean;
  autoWarehouseOnly?: boolean;
  zone?: ZoneSource | null;
};

export type PublicDeliverySource = {
  id: string;
  status: string;
  ticketNumber: number | null;
  vehiclePlate: string;
  vehicleType: string;
  goodsType: string;
  receivingUnit: string;
  unitConfigId: string | null;
  assignedSlotId: string | null;
  checkinTime: DateLike;
  calledTime: DateLike;
  receivingStartTime?: DateLike;
  createdAt: DateLike;
  callCount?: number;
  unitConfig?: UnitConfigSource | null;
  assignedSlot?: SlotSource | null;
};

export type PublicSlotSource = SlotSource & {
  deliveries?: PublicDeliverySource[];
};

function publicUnitConfig(unitConfig: UnitConfigSource | null | undefined) {
  if (!unitConfig) return unitConfig ?? null;
  return {
    id: unitConfig.id,
    unit: unitConfig.unit,
    businessLocationId: unitConfig.businessLocationId,
    displayName: unitConfig.displayName,
    shortName: unitConfig.shortName,
    icon: unitConfig.icon,
    logoUrl: unitConfig.logoUrl,
    primaryColor: unitConfig.primaryColor,
  };
}

function publicZone(zone: ZoneSource | null | undefined) {
  if (!zone) return zone ?? null;
  return {
    id: zone.id,
    code: zone.code,
    name: zone.name,
    unitConfigId: zone.unitConfigId ?? zone.unitConfig?.id,
    unitConfig: publicUnitConfig(zone.unitConfig),
  };
}

function publicSlotSummary(slot: SlotSource | null | undefined) {
  if (!slot) return slot ?? null;
  return {
    id: slot.id,
    name: slot.name,
    vehicleType: slot.vehicleType,
    zone: publicZone(slot.zone),
  };
}

export function toPublicDelivery(delivery: PublicDeliverySource) {
  return {
    id: delivery.id,
    status: delivery.status,
    ticketNumber: delivery.ticketNumber,
    vehiclePlate: delivery.vehiclePlate,
    vehicleType: delivery.vehicleType,
    goodsType: delivery.goodsType,
    receivingUnit: delivery.receivingUnit,
    unitConfigId: delivery.unitConfigId,
    assignedSlotId: delivery.assignedSlotId,
    checkinTime: delivery.checkinTime,
    calledTime: delivery.calledTime,
    receivingStartTime: delivery.receivingStartTime ?? null,
    createdAt: delivery.createdAt,
    callCount: delivery.callCount ?? 0,
    unitConfig: publicUnitConfig(delivery.unitConfig),
    assignedSlot: publicSlotSummary(delivery.assignedSlot),
  };
}

export function toPublicQueue(queue: PublicDeliverySource[]) {
  return queue.map(toPublicDelivery);
}

export function toPublicSlot(slot: PublicSlotSource) {
  return {
    id: slot.id,
    name: slot.name,
    code: slot.code,
    vehicleType: slot.vehicleType,
    status: slot.status,
    assignedUnit: slot.assignedUnit,
    zoneId: slot.zoneId,
    maxCapacity: slot.maxCapacity,
    isActive: slot.isActive,
    autoAssign: slot.autoAssign,
    autoWarehouseOnly: slot.autoWarehouseOnly,
    zone: publicZone(slot.zone),
    deliveries: slot.deliveries?.map(toPublicDelivery),
  };
}

export function toPublicSlots(slots: PublicSlotSource[]) {
  return slots.map(toPublicSlot);
}
