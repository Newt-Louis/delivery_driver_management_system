import { prisma } from '../../lib/prisma';
import type { SocketScope } from '../../socket';
import type { ZonePayload, ZoneUpdatePayload } from './zoneFormRequest';

export function listZones(scope?: SocketScope) {
  return prisma.zone.findMany({
    where: {
      ...(scope?.businessLocationId ? { unitConfig: { businessLocationId: scope.businessLocationId } } : {}),
      ...(scope?.unitConfigId ? { unitConfigId: scope.unitConfigId } : {}),
    },
    orderBy: { code: 'asc' },
    include: {
      unitConfig: { select: { id: true, unit: true, displayName: true, businessLocationId: true } },
      _count: { select: { slots: true } },
      slots: {
        where: { isActive: true },
        orderBy: [{ vehicleType: 'asc' }, { code: 'asc' }],
        select: { id: true, code: true, name: true, vehicleType: true, assignedUnit: true, status: true, isActive: true },
      },
    },
  });
}

export function findUnitConfig(id: string) {
  return prisma.unitConfig.findUnique({ where: { id } });
}

export function findZoneByUnitAndCode(unitConfigId: string, code: string) {
  return prisma.zone.findUnique({
    where: { unitConfigId_code: { unitConfigId, code } },
  });
}

export function createZone(data: ZonePayload) {
  return prisma.zone.create({ data });
}

export function findZoneForUpdate(id: string) {
  return prisma.zone.findUnique({
    where: { id },
    include: { unitConfig: { select: { businessLocationId: true } } },
  });
}

export function updateZone(id: string, data: ZoneUpdatePayload) {
  return prisma.zone.update({ where: { id }, data });
}

export function findZoneForDelete(id: string) {
  return prisma.zone.findUnique({
    where: { id },
    include: { _count: { select: { slots: true } }, unitConfig: { select: { id: true, businessLocationId: true } } },
  });
}

export function deleteZone(id: string) {
  return prisma.zone.delete({ where: { id } });
}
