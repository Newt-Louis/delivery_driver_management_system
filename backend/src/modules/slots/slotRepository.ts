import { ReceivingUnit, type ReceivingUnit as ReceivingUnitCode } from '../../domain/unitCodes';
import { SlotStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { SocketScope } from '../../socket';
import type { CreateSlotPayload, UpdateSlotPayload } from './slotFormRequest';

export function listSlotsWithDeliveries(activeOnly = true, scope?: SocketScope) {
  return prisma.slot.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      zone: {
        ...(scope?.unitConfigIds?.length ? { unitConfigId: { in: scope.unitConfigIds } } : {}),
        ...(scope?.unitConfigId && !scope?.unitConfigIds?.length ? { unitConfigId: scope.unitConfigId } : {}),
        ...(scope?.businessLocationId ? { unitConfig: { businessLocationId: scope.businessLocationId } } : {}),
      },
    },
    orderBy: [{ assignedUnit: 'asc' }, { vehicleType: 'asc' }, { code: 'asc' }],
    include: {
      zone: {
        select: {
          id: true,
          code: true,
          name: true,
          unitConfig: {
            select: {
              id: true,
              unit: true,
              displayName: true,
              shortName: true,
              icon: true,
              logoUrl: true,
              primaryColor: true,
              businessLocationId: true,
            },
          },
        },
      },
      deliveries: {
        where: { status: { in: ['WAITING', 'CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'] } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
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

export function findSlotByCode(code: string) {
  return prisma.slot.findUnique({ where: { code } });
}

export function createSlot(data: CreateSlotPayload) {
  return prisma.slot.create({ data });
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
