import { ReceivingUnit, type ReceivingUnit as ReceivingUnitCode } from '../../domain/unitCodes';
import { DeliveryStatus, GoodsType, Prisma, SlotStatus, VehicleType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { SocketScope } from '../../socket';
import { getVNDateKey, getVNDateRangeUtc } from '../../lib/dateVN';
import { getCallHistoryCounts } from '../history/historyRepository';
import { normalizeVehiclePlate } from '../../domain/vehiclePlate';
import { normalizeDriverPhone } from '../../domain/driverPhone';

const DELIVERY_UNIT_CONFIG_SELECT = {
  id: true,
  unit: true,
  businessLocationId: true,
  displayName: true,
  shortName: true,
  icon: true,
  logoUrl: true,
  primaryColor: true,
} as const;

export { normalizeVehiclePlate, normalizeDriverPhone };

export function normalizeOrderCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function findDuplicateRegistration(args: {
  vehiclePlate: string;
  businessLocationId: string;
  requestedTime?: Date | null;
  deliveryDate?: string;
  client?: Prisma.TransactionClient | typeof prisma;
}) {
  const day = args.requestedTime ?? parseDeliveryDate(args.deliveryDate) ?? new Date();

  const { start, end } = localDayRange(day);
  const client = args.client ?? prisma;
  return client.deliveryRegistration.findMany({
    where: {
      vehiclePlate: args.vehiclePlate,
      unitConfig: { businessLocationId: args.businessLocationId },
      status: { notIn: [DeliveryStatus.COMPLETED, DeliveryStatus.CANCELLED] },
      OR: [
        { requestedTime: { gte: start, lt: end } },
        {
          requestedTime: null,
          createdAt: { gte: start, lt: end },
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

}

export function localDateKey(date: Date): string {
  return getVNDateKey(date);
}

export function localTimeKey(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function localDayRange(date: Date): { start: Date; end: Date } {
  return getVNDateRangeUtc(getVNDateKey(date));
}

export function parseDeliveryDate(value?: string): Date | null {
  return parseDeliveryDateStartVN(value);
}

export function parseDeliveryDateStartVN(value?: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function advisoryLockId(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

export async function getRegistrationSlotCapacity(unitConfigId: string, unit: ReceivingUnitCode, vehicleType: VehicleType): Promise<number | null> {
  const slots = await prisma.slot.findMany({
    where: {
      assignedUnit: unit,
      vehicleType,
      isActive: true,
      status: { notIn: [SlotStatus.MAINTENANCE, SlotStatus.RESERVED] },
      zone: { unitConfigId },
    },
    select: { maxCapacity: true },
  });

  return slots.reduce((sum, slot) => sum + slot.maxCapacity, 0);
}

export async function resolveScopedUnits(scope?: SocketScope): Promise<ReceivingUnitCode[]> {
  if (!scope?.businessLocationId && !scope?.unitConfigId && !scope?.unitConfigIds?.length) return [];

  const unitConfigs = await prisma.unitConfig.findMany({
    where: {
      ...(scope.unitConfigId ? { id: scope.unitConfigId } : {}),
      ...(scope.unitConfigIds?.length ? { id: { in: scope.unitConfigIds } } : {}),
      ...(scope.businessLocationId ? { businessLocationId: scope.businessLocationId } : {}),
    },
    select: { unit: true },
  });

  return [...new Set(unitConfigs.map((cfg) => cfg.unit))];
}

async function resolveScopedUnitConfigIds(scope?: SocketScope): Promise<string[]> {
  if (!scope?.businessLocationId && !scope?.unitConfigId && !scope?.unitConfigIds?.length) return [];

  const unitConfigs = await prisma.unitConfig.findMany({
    where: {
      ...(scope.unitConfigIds?.length ? { id: { in: scope.unitConfigIds } } : {}),
      ...(scope.unitConfigId && !scope.unitConfigIds?.length ? { id: scope.unitConfigId } : {}),
      ...(scope.businessLocationId ? { businessLocationId: scope.businessLocationId } : {}),
    },
    select: { id: true },
  });

  return unitConfigs.map((cfg) => cfg.id);
}

async function queueWhereForScope(scope?: SocketScope): Promise<Prisma.DeliveryRegistrationWhereInput> {
  const activeStatus = {
    in: [
      DeliveryStatus.WAITING,
      DeliveryStatus.CALLED,
      DeliveryStatus.RECEIVING,
      DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
    ],
  };

  if (!scope?.businessLocationId && !scope?.unitConfigId && !scope?.unitConfigIds?.length) {
    return { status: activeStatus };
  }

  const unitConfigs = await prisma.unitConfig.findMany({
    where: {
      ...(scope.unitConfigId ? { id: scope.unitConfigId } : {}),
      ...(scope.unitConfigIds?.length ? { id: { in: scope.unitConfigIds } } : {}),
      ...(scope.businessLocationId ? { businessLocationId: scope.businessLocationId } : {}),
    },
    select: { id: true },
  });
  const unitConfigIds = unitConfigs.map((cfg) => cfg.id);

  if (unitConfigIds.length === 0) {
    return { id: '__empty_scope__', status: activeStatus };
  }

  return {
    status: activeStatus,
    OR: [
      { unitConfigId: { in: unitConfigIds } },
      {
        assignedSlot: {
          zone: {
            unitConfigId: { in: unitConfigIds },
          },
        },
      },
    ],
  };
}

export async function attachCallCounts<T extends { id: string }>(deliveries: T[]): Promise<Array<T & { callCount: number }>> {
  const counts = await getCallHistoryCounts(deliveries.map((delivery) => delivery.id));
  return deliveries.map((delivery) => ({
    ...delivery,
    callCount: counts.get(delivery.id) ?? 0,
  }));
}

export async function getFullQueue(scope?: SocketScope) {
  const deliveries = await prisma.deliveryRegistration.findMany({
    where: await queueWhereForScope(scope),
    include: {
      unitConfig: { select: DELIVERY_UNIT_CONFIG_SELECT },
      assignedSlot: { include: { zone: { include: { unitConfig: { select: DELIVERY_UNIT_CONFIG_SELECT } } } } },
    },
    orderBy: [{ checkinTime: 'asc' }],
  });
  return attachCallCounts(deliveries);
}


export async function listDeliveries(args: {
  unit?: ReceivingUnitCode;
  goodsType?: GoodsType;
  status?: string;
  scope?: SocketScope;
}) {
  const scopedUnits = await resolveScopedUnits(args.scope);
  const scopedUnitConfigIds = await resolveScopedUnitConfigIds(args.scope);
  const where: Prisma.DeliveryRegistrationWhereInput = {};
  const hasExplicitScope = Boolean(args.scope?.businessLocationId || args.scope?.unitConfigId || args.scope?.unitConfigIds?.length);
  if (hasExplicitScope && scopedUnitConfigIds.length === 0) {
    return [];
  }
  if (scopedUnitConfigIds.length > 0) {
    where.unitConfigId = { in: scopedUnitConfigIds };
  }
  if (args.unit) {
    if (scopedUnits.length > 0 && !scopedUnits.includes(args.unit)) {
      return [];
    }
    where.receivingUnit = args.unit;
  } else if (scopedUnits.length > 0 && scopedUnitConfigIds.length === 0) {
    where.receivingUnit = { in: scopedUnits };
  }
  if (args.goodsType) where.goodsType = args.goodsType;
  if (args.status) where.status = args.status as DeliveryStatus;

  const deliveries = await prisma.deliveryRegistration.findMany({
    where,
    include: {
      assignedSlot: true,
      unitConfig: { select: DELIVERY_UNIT_CONFIG_SELECT },
      unitGoodsType: { select: { id: true, name: true, emoji: true, baseType: true } },
    },
    orderBy: [{ checkinTime: 'asc' }, { createdAt: 'desc' }],
  });

  return attachCallCounts(deliveries);
}

export function findAutoWarehouseVendor(vendorCode: string, unit: ReceivingUnitCode, unitConfigId?: string | null) {
  return prisma.autoWarehouseVendor.findFirst({
    where: {
      vendorCode,
      unit,
      ...(unitConfigId ? { unitConfigId } : {}),
      active: true,
    },
  });
}

export async function resolveRegistrationUnitConfig(args: {
  receivingUnit: ReceivingUnitCode;
  unitConfigId?: string | null;
  businessLocationId?: string | null;
}) {
  if (args.unitConfigId || args.businessLocationId) {
    return prisma.unitConfig.findFirst({
      where: {
        unit: args.receivingUnit,
        isActive: true,
        businessLocation: { isActive: true },
        ...(args.unitConfigId ? { id: args.unitConfigId } : {}),
        ...(args.businessLocationId ? { businessLocationId: args.businessLocationId } : {}),
      },
      include: { businessLocation: { select: { code: true } } },
    });
  }

  const location = await prisma.businessLocation.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!location) return null;

  return prisma.unitConfig.findUnique({
    where: { businessLocationId_unit: { businessLocationId: location.id, unit: args.receivingUnit } },
    include: { businessLocation: { select: { code: true } } },
  });
}

export function findDeliveryByLookup(args: { registrationCode?: string; vehiclePlate?: string; businessLocationId: string }) {
  return prisma.deliveryRegistration.findFirst({
    where: {
      ...(args.registrationCode ? { registrationCode: args.registrationCode } : { vehiclePlate: normalizeVehiclePlate(args.vehiclePlate!) }),
      unitConfig: { businessLocationId: args.businessLocationId },
    },
    orderBy: { createdAt: 'desc' },
    include: { assignedSlot: true, unitConfig: { select: DELIVERY_UNIT_CONFIG_SELECT } },
  });
}

/**
 * GET /api/deliveries/:id (dashboard detail panel). Explicit fields only; includes the slot's zone
 * (panel shows "slot (zone code)") but not slot internals.
 */
export function findDeliveryDetail(id: string) {
  return prisma.deliveryRegistration.findUnique({
    where: { id },
    select: {
      id: true,
      registrationCode: true,
      status: true,
      ticketNumber: true,
      vehiclePlate: true,
      vehicleType: true,
      goodsType: true,
      receivingUnit: true,
      unitConfigId: true,
      assignedSlotId: true,
      vendorName: true,
      driverName: true,
      driverPhone: true,
      poNumber: true,
      note: true,
      cancelReason: true,
      requestedTime: true,
      createdAt: true,
      checkinTime: true,
      calledTime: true,
      receivingStartTime: true,
      completedTime: true,
      unitConfig: { select: DELIVERY_UNIT_CONFIG_SELECT },
      assignedSlot: {
        select: { id: true, name: true, vehicleType: true, zone: { select: { id: true, code: true, name: true } } },
      },
    },
  });
}

export function findDeliveryWithSlot(id: string) {
  return prisma.deliveryRegistration.findUnique({
    where: { id },
    include: { assignedSlot: true, unitConfig: { select: DELIVERY_UNIT_CONFIG_SELECT } },
  });
}

export function findDelivery(id: string) {
  return prisma.deliveryRegistration.findUnique({ where: { id } });
}

export function findDeliveryForLifecycleScope(id: string) {
  return prisma.deliveryRegistration.findUnique({
    where: { id },
    select: { id: true, receivingUnit: true, unitConfigId: true, assignedSlotId: true },
  });
}

export function startReceivingDelivery(id: string, status: DeliveryStatus) {
  return prisma.deliveryRegistration.update({
    where: { id },
    data: { status, receivingStartTime: new Date() },
    include: { assignedSlot: true },
  });
}

export { prisma };
