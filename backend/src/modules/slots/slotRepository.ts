import { ReceivingUnit, type ReceivingUnit as ReceivingUnitCode } from '../../domain/unitCodes';
import { Prisma, SlotStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { SocketScope } from '../../socket';
import { compareSlotsForDisplay } from '../../domain/slotCode';
import { advisoryLockId } from '../deliveries/deliveryRepository';
import type { CreateSlotPayload, UpdateSlotPayload } from './slotFormRequest';

/**
 * Slot list payload shared by GET /api/slots, GET /api/slots/all and the `slot_updated` socket
 * event (which additionally projects deliveries through the public allow-list).
 * Only fields the docks/Backoffice screens read: no `code` (not displayed), no `currentDeliveryId`;
 * deliveries carry only what docks and the public projection need.
 */
export const SLOT_LIST_SELECT = {
  id: true,
  name: true,
  assignedUnit: true,
  vehicleType: true,
  acceptedGoods: true,
  goodsPriority: true,
  autoAssign: true,
  maxCapacity: true,
  status: true,
  isActive: true,
  lastUsedAt: true,
  zoneId: true,
  zone: {
    select: {
      id: true,
      code: true,
      name: true,
      unitConfig: {
        select: {
          id: true, unit: true, displayName: true, shortName: true,
          icon: true, logoUrl: true, primaryColor: true, businessLocationId: true,
        },
      },
    },
  },
  deliveries: {
    where: { status: { in: ['WAITING', 'CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'] } },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      status: true,
      ticketNumber: true,
      vehiclePlate: true,
      vehicleType: true,
      goodsType: true,
      receivingUnit: true,
      unitConfigId: true,
      assignedSlotId: true,
      vendorName: true,
      checkinTime: true,
      calledTime: true,
      receivingStartTime: true,
      createdAt: true,
    },
  },
} as const satisfies Prisma.SlotSelect;

export async function listSlotsWithDeliveries(activeOnly = true, scope?: SocketScope) {
  const slots = await prisma.slot.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      zone: {
        ...(scope?.unitConfigIds
          ? { unitConfigId: scope.unitConfigIds.length > 0 ? { in: scope.unitConfigIds } : '__NO_UNIT_SCOPE__' }
          : {}),
        ...(scope?.unitConfigId && !scope?.unitConfigIds ? { unitConfigId: scope.unitConfigId } : {}),
        ...(scope?.businessLocationId ? { unitConfig: { businessLocationId: scope.businessLocationId } } : {}),
      },
    },
    select: SLOT_LIST_SELECT,
  });
  return slots.sort(compareSlotsForDisplay);
}

export function findSlotWithLocation(id: string) {
  return prisma.slot.findUnique({
    where: { id },
    include: { zone: { include: { unitConfig: { select: { businessLocationId: true } } } } },
  });
}

export function findSlot(id: string) {
  return prisma.slot.findUnique({ where: { id } });
}

export function findDeliveryForScope(deliveryId: string) {
  return prisma.deliveryRegistration.findUnique({
    where: { id: deliveryId },
    select: { id: true, receivingUnit: true, assignedSlotId: true },
  });
}

export function findZoneWithLocation(zoneId: string) {
  return prisma.zone.findUnique({
    where: { id: zoneId },
    include: { unitConfig: { select: { businessLocationId: true } } },
  });
}

export function findZoneForUnit(zoneId: string) {
  return prisma.zone.findUnique({
    where: { id: zoneId },
    include: { unitConfig: { select: { unit: true } } },
  });
}

/**
 * Khóa ghi slot theo business location trong transaction hiện tại: tuần tự hóa việc kiểm tra
 * trùng tên và sinh mã slot để hai thao tác đồng thời không tạo trùng.
 */
export async function lockSlotWrites(tx: Prisma.TransactionClient, businessLocationId: string) {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${advisoryLockId(`slot-write:${businessLocationId}`)})`);
}

/** Slot khác (kể cả đã vô hiệu hóa) trong cùng business location có cùng tên, không phân biệt hoa thường. */
export function findSlotNameConflict(tx: Prisma.TransactionClient, businessLocationId: string, name: string, excludeSlotId?: string) {
  return tx.slot.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      zone: { unitConfig: { businessLocationId } },
      ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
    },
    select: { id: true, name: true, isActive: true },
  });
}

export async function listZoneSlotCodes(tx: Prisma.TransactionClient, zoneId: string) {
  const slots = await tx.slot.findMany({ where: { zoneId }, select: { code: true } });
  return slots.map((slot) => slot.code);
}

export function createSlot(tx: Prisma.TransactionClient, data: CreateSlotPayload & { code: string }) {
  return tx.slot.create({ data });
}

export function countSlotHistoryEvents(slotId: string) {
  return prisma.deliveryHistoryEvent.count({ where: { slotId } });
}

export function findSlotForDelete(id: string) {
  return prisma.slot.findUnique({
    where: { id },
    include: { _count: { select: { deliveries: true } }, zone: { include: { unitConfig: { select: { businessLocationId: true } } } } },
  });
}

export function deactivateSlot(id: string) {
  return prisma.slot.update({
    where: { id },
    data: { isActive: false, status: SlotStatus.MAINTENANCE },
  });
}

export function deleteSlot(id: string) {
  return prisma.slot.delete({ where: { id } });
}

export function updateSlotData(id: string, data: Omit<UpdateSlotPayload, 'status'>) {
  return prisma.slot.update({ where: { id }, data });
}

export async function validateZoneForUnit(zoneId: string, assignedUnit: ReceivingUnitCode) {
  const zone = await findZoneForUnit(zoneId);
  if (!zone) return 'Khu nhận hàng không tồn tại.';
  if (zone.unitConfig.unit !== assignedUnit) return 'Khu nhận hàng không thuộc đúng đơn vị của slot.';
  return null;
}
