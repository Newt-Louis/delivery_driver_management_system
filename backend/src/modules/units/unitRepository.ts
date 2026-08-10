import { ReceivingUnit, type ReceivingUnit as ReceivingUnitCode } from '../../domain/unitCodes';
import { DeliveryStatus, GoodsType, Prisma, SlotStatus, VehicleType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  TimeWindowPayload,
  UnitConfigPayload,
  UnitGoodsTypePayload,
  UpdateTimeWindowPayload,
  UpdateUnitGoodsTypePayload,
} from './unitFormRequest';

export const UNIT_CONFIG_AUDIT_SELECT = {
  id: true,
  freshFoodEnabled: true,
  generalGoodsEnabled: true,
  thiCongEnabled: true,
  sundayFreshFoodOnly: true,
  truckSlotMinutes: true,
  motorbikeSlotMinutes: true,
  truckMaxPerSlot: true,
  motorbikeMaxPerSlot: true,
  autoCancelCalledEnabled: true,
  autoCancelCalledAfterMinutes: true,
  displayName: true,
  shortName: true,
  icon: true,
} as const;

export function findDefaultBusinessLocation() {
  return prisma.businessLocation.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
}

export function createDefaultBusinessLocation() {
  return prisma.businessLocation.create({
    data: {
      code: 'DEFAULT',
      locationName: 'THISO GROUP',
      tagline: 'Delivery Management System',
    },
  });
}

export async function getDefaultBusinessLocation() {
  return (await findDefaultBusinessLocation()) ?? await createDefaultBusinessLocation();
}

export function listPublicBusinessLocations() {
  return prisma.businessLocation.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      locationName: true,
      address: true,
      avatarUrl: true,
      logoUrl: true,
      tagline: true,
      isActive: true,
      unitConfigs: {
        where: { isActive: true },
        select: { id: true, unit: true, displayName: true, shortName: true, icon: true, isActive: true },
        orderBy: { unit: 'asc' },
      },
    },
    orderBy: [{ locationName: 'asc' }, { code: 'asc' }],
  });
}

export function findActiveBusinessLocation(id: string) {
  return prisma.businessLocation.findFirst({
    where: { id, isActive: true },
    select: { id: true },
  });
}

export function listUnitConfigs(businessLocationId: string) {
  return prisma.unitConfig.findMany({
    where: { businessLocationId },
    orderBy: { unit: 'asc' },
  });
}

export function findUnitConfig(unit: ReceivingUnitCode, businessLocationId: string) {
  return prisma.unitConfig.findUnique({
    where: { businessLocationId_unit: { businessLocationId, unit } },
  });
}

export function findPublicUnitConfig(args: {
  unit: ReceivingUnitCode;
  unitConfigId?: string | null;
  businessLocationId?: string | null;
}) {
  return prisma.unitConfig.findFirst({
    where: {
      unit: args.unit,
      isActive: true,
      businessLocation: { isActive: true },
      ...(args.unitConfigId ? { id: args.unitConfigId } : {}),
      ...(args.businessLocationId ? { businessLocationId: args.businessLocationId } : {}),
    },
  });
}

export async function findDefaultUnitConfig(unit: ReceivingUnitCode) {
  const location = await getDefaultBusinessLocation();
  return findUnitConfig(unit, location.id);
}

export function findUnitConfigForAudit(unit: ReceivingUnitCode, businessLocationId: string) {
  return prisma.unitConfig.findUnique({
    where: { businessLocationId_unit: { businessLocationId, unit } },
    select: UNIT_CONFIG_AUDIT_SELECT,
  });
}

export function listTimeWindows(where: Prisma.DeliveryTimeWindowWhereInput) {
  return prisma.deliveryTimeWindow.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
  });
}

export function createTimeWindow(unit: ReceivingUnitCode, body: TimeWindowPayload, unitConfigId: string) {
  return prisma.deliveryTimeWindow.create({
    data: {
      unit,
      unitConfigId,
      goodsType: body.goodsType,
      unitGoodsTypeId: body.unitGoodsTypeId ?? null,
      label: body.label ?? null,
      startTime: body.startTime,
      endTime: body.endTime,
      enabled: body.enabled ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
  });
}

export function findTimeWindow(id: string) {
  return prisma.deliveryTimeWindow.findUnique({
    where: { id },
    select: {
      unit: true,
      unitConfigId: true,
      goodsType: true,
      label: true,
      startTime: true,
      endTime: true,
    },
  });
}

export function updateTimeWindow(id: string, body: UpdateTimeWindowPayload) {
  return prisma.deliveryTimeWindow.update({
    where: { id },
    data: body,
  });
}

export function deleteTimeWindow(id: string) {
  return prisma.deliveryTimeWindow.delete({ where: { id } });
}

export function listGoodsTypes(args: {
  unit: ReceivingUnitCode;
  unitConfigId?: string;
  baseType?: GoodsType;
  enabledOnly: boolean;
}) {
  return prisma.unitGoodsType.findMany({
    where: {
      unit: args.unit,
      ...(args.unitConfigId ? { unitConfigId: args.unitConfigId } : {}),
      ...(args.baseType ? { baseType: args.baseType } : {}),
      ...(args.enabledOnly ? { enabled: true } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export function createGoodsType(unit: ReceivingUnitCode, body: UnitGoodsTypePayload, unitConfigId: string) {
  return prisma.unitGoodsType.create({
    data: {
      unit,
      unitConfigId,
      name: body.name,
      emoji: body.emoji,
      baseType: body.baseType,
      enabled: body.enabled ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
  });
}

export function findGoodsType(id: string) {
  return prisma.unitGoodsType.findUnique({
    where: { id },
    select: {
      unit: true,
      unitConfigId: true,
      name: true,
      emoji: true,
      baseType: true,
      enabled: true,
    },
  });
}

export function updateGoodsType(id: string, body: UpdateUnitGoodsTypePayload) {
  return prisma.unitGoodsType.update({
    where: { id },
    data: body,
  });
}

export function deleteGoodsType(id: string) {
  return prisma.unitGoodsType.delete({ where: { id } });
}

export function listMatchingOperationalSlots(args: {
  unitConfigId: string;
  unit: ReceivingUnitCode;
  vehicleType?: VehicleType;
}) {
  return prisma.slot.findMany({
    where: {
      assignedUnit: args.unit,
      isActive: true,
      status: { notIn: [SlotStatus.MAINTENANCE, SlotStatus.RESERVED] },
      ...(args.vehicleType ? { vehicleType: args.vehicleType } : {}),
      zone: { unitConfigId: args.unitConfigId },
    },
    select: {
      id: true,
      vehicleType: true,
      maxCapacity: true,
      acceptedGoods: true,
      goodsPriority: true,
      autoWarehouseOnly: true,
    },
  });
}

export function listActiveBookingsForDay(args: {
  unit: ReceivingUnitCode;
  unitConfigId?: string;
  vehicleType: VehicleType;
  dayStart: Date;
  dayEnd: Date;
}) {
  return prisma.deliveryRegistration.findMany({
    where: {
      receivingUnit: args.unit,
      ...(args.unitConfigId ? { unitConfigId: args.unitConfigId } : {}),
      vehicleType: args.vehicleType,
      requestedTime: { gte: args.dayStart, lte: args.dayEnd },
      status: {
        in: [
          DeliveryStatus.REGISTERED,
          DeliveryStatus.WAITING,
          DeliveryStatus.CALLED,
          DeliveryStatus.RECEIVING,
          DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
        ],
      },
    },
    select: { requestedTime: true },
  });
}

export function listActiveBookingsForRange(args: {
  unit: ReceivingUnitCode;
  unitConfigId?: string;
  vehicleType: VehicleType;
  rangeStart: Date;
  rangeEnd: Date;
}) {
  return prisma.deliveryRegistration.findMany({
    where: {
      receivingUnit: args.unit,
      ...(args.unitConfigId ? { unitConfigId: args.unitConfigId } : {}),
      vehicleType: args.vehicleType,
      requestedTime: { gte: args.rangeStart, lt: args.rangeEnd },
      status: {
        in: [
          DeliveryStatus.REGISTERED,
          DeliveryStatus.WAITING,
          DeliveryStatus.CALLED,
          DeliveryStatus.RECEIVING,
          DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
        ],
      },
    },
    select: { requestedTime: true },
  });
}

export function upsertUnitConfig(args: {
  unit: ReceivingUnitCode;
  businessLocationId: string;
  body: UnitConfigPayload;
}) {
  return prisma.unitConfig.upsert({
    where: {
      businessLocationId_unit: {
        businessLocationId: args.businessLocationId,
        unit: args.unit,
      },
    },
    create: { businessLocationId: args.businessLocationId, unit: args.unit, ...args.body },
    update: args.body,
  });
}
