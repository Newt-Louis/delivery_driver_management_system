import { DeliveryStatus, GoodsType, Prisma, ReceivingUnit, SlotStatus, VehicleType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getUnitConfigForDefaultLocation } from '../../lib/businessLocation';
import type { SocketScope } from '../../socket';
import { getCallHistoryCounts } from '../history/historyRepository';

export const ACTIVE_DUPLICATE_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.REGISTERED,
  DeliveryStatus.WAITING,
  DeliveryStatus.CALLED,
  DeliveryStatus.RECEIVING,
  DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
];

export function normalizeVehiclePlate(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function normalizeDriverPhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function normalizeOrderCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function findDuplicateRegistration(args: {
  vehiclePlate: string;
  driverPhone: string;
  poNumber: string;
  requestedTime?: Date | null;
  deliveryDate?: string;
}) {
  const day = args.requestedTime ?? parseDeliveryDate(args.deliveryDate);
  if (!day) return null;

  const { start, end } = localDayRange(day);
  const candidates = await prisma.deliveryRegistration.findMany({
    where: {
      vehiclePlate: args.vehiclePlate,
      status: { in: ACTIVE_DUPLICATE_STATUSES },
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

  const phone = normalizeDriverPhone(args.driverPhone);
  const orderCode = normalizeOrderCode(args.poNumber);
  return candidates.find((delivery) => (
    normalizeDriverPhone(delivery.driverPhone) === phone
    && normalizeOrderCode(delivery.poNumber ?? '') === orderCode
  )) ?? null;
}

export function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function localTimeKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function localDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function parseDeliveryDate(value?: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
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

export async function getRegistrationSlotCapacity(unit: ReceivingUnit, vehicleType: VehicleType): Promise<number | null> {
  const config = await getUnitConfigForDefaultLocation(unit);
  if (!config) return null;

  const slots = await prisma.slot.findMany({
    where: {
      assignedUnit: unit,
      vehicleType,
      isActive: true,
      status: { notIn: [SlotStatus.MAINTENANCE, SlotStatus.RESERVED] },
      zone: { unitConfigId: config.id },
    },
    select: { maxCapacity: true },
  });

  return slots.reduce((sum, slot) => sum + slot.maxCapacity, 0);
}

export async function resolveScopedUnits(scope?: SocketScope): Promise<ReceivingUnit[]> {
  if (!scope?.businessLocationId && !scope?.unitConfigId) return [];

  const unitConfigs = await prisma.unitConfig.findMany({
    where: {
      ...(scope.unitConfigId ? { id: scope.unitConfigId } : {}),
      ...(scope.businessLocationId ? { businessLocationId: scope.businessLocationId } : {}),
    },
    select: { unit: true },
  });

  return [...new Set(unitConfigs.map((cfg) => cfg.unit))];
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

  if (!scope?.businessLocationId && !scope?.unitConfigId) {
    return { status: activeStatus };
  }

  const unitConfigs = await prisma.unitConfig.findMany({
    where: {
      ...(scope.unitConfigId ? { id: scope.unitConfigId } : {}),
      ...(scope.businessLocationId ? { businessLocationId: scope.businessLocationId } : {}),
    },
    select: { id: true, unit: true },
  });
  const units = [...new Set(unitConfigs.map((cfg) => cfg.unit))];

  return {
    status: activeStatus,
    OR: [
      {
        assignedSlot: {
          zone: {
            ...(scope.unitConfigId ? { unitConfigId: scope.unitConfigId } : {}),
            ...(scope.businessLocationId ? { unitConfig: { businessLocationId: scope.businessLocationId } } : {}),
          },
        },
      },
      ...(units.length > 0 ? [{ assignedSlotId: null, receivingUnit: { in: units } }] : []),
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
      assignedSlot: { include: { zone: { include: { unitConfig: { select: { id: true, unit: true, businessLocationId: true } } } } } },
    },
    orderBy: [{ checkinTime: 'asc' }],
  });
  return attachCallCounts(deliveries);
}

export function getAllSlots(scope?: SocketScope) {
  return prisma.slot.findMany({
    where: {
      isActive: true,
      zone: {
        ...(scope?.unitConfigId ? { unitConfigId: scope.unitConfigId } : {}),
        ...(scope?.businessLocationId ? { unitConfig: { businessLocationId: scope.businessLocationId } } : {}),
      },
    },
    orderBy: [{ assignedUnit: 'asc' }, { vehicleType: 'asc' }, { code: 'asc' }],
    include: {
      zone: { select: { id: true, code: true, name: true, unitConfig: { select: { id: true, unit: true, businessLocationId: true } } } },
      deliveries: {
        where: { status: { in: ['WAITING', 'CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'] } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
}

export async function listDeliveries(args: {
  unit?: ReceivingUnit;
  goodsType?: GoodsType;
  status?: string;
  scope?: SocketScope;
}) {
  const scopedUnits = await resolveScopedUnits(args.scope);
  const where: Prisma.DeliveryRegistrationWhereInput = {};
  if (args.unit) {
    if (scopedUnits.length > 0 && !scopedUnits.includes(args.unit)) {
      return [];
    }
    where.receivingUnit = args.unit;
  } else if (scopedUnits.length > 0) {
    where.receivingUnit = { in: scopedUnits };
  }
  if (args.goodsType) where.goodsType = args.goodsType;
  if (args.status) where.status = args.status as DeliveryStatus;

  const deliveries = await prisma.deliveryRegistration.findMany({
    where,
    include: { assignedSlot: true, unitGoodsType: { select: { id: true, name: true, emoji: true, baseType: true } } },
    orderBy: [{ checkinTime: 'asc' }, { createdAt: 'desc' }],
  });

  return attachCallCounts(deliveries);
}

export function findAutoWarehouseVendor(vendorCode: string, unit: ReceivingUnit) {
  return prisma.autoWarehouseVendor.findFirst({
    where: { vendorCode, unit, active: true },
  });
}

export function findDeliveryByLookup(args: { registrationCode?: string; vehiclePlate?: string }) {
  return prisma.deliveryRegistration.findFirst({
    where: args.registrationCode
      ? { registrationCode: args.registrationCode }
      : { vehiclePlate: args.vehiclePlate!.toUpperCase() },
    orderBy: { createdAt: 'desc' },
    include: { assignedSlot: true },
  });
}

export async function findDeliveryForPublicCancel(args: {
  registrationCode: string;
  vehiclePlate: string;
  driverPhone: string;
  poNumber: string;
  requestedTime: Date;
}) {
  const start = new Date(args.requestedTime);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 60_000);

  const candidates = await prisma.deliveryRegistration.findMany({
    where: {
      registrationCode: args.registrationCode.toUpperCase().trim(),
      vehiclePlate: args.vehiclePlate,
      status: { in: ACTIVE_DUPLICATE_STATUSES },
      requestedTime: { gte: start, lt: end },
    },
    orderBy: { createdAt: 'desc' },
  });

  const phone = normalizeDriverPhone(args.driverPhone);
  const orderCode = normalizeOrderCode(args.poNumber);
  return candidates.find((delivery) => (
    normalizeDriverPhone(delivery.driverPhone) === phone
    && normalizeOrderCode(delivery.poNumber ?? '') === orderCode
  )) ?? null;
}

export function findDeliveryWithSlot(id: string) {
  return prisma.deliveryRegistration.findUnique({
    where: { id },
    include: { assignedSlot: true },
  });
}

export function findDelivery(id: string) {
  return prisma.deliveryRegistration.findUnique({ where: { id } });
}

export function findDeliveryForLifecycleScope(id: string) {
  return prisma.deliveryRegistration.findUnique({
    where: { id },
    select: { id: true, receivingUnit: true, assignedSlotId: true },
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
