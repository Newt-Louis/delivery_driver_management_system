import { ReceivingUnit, type ReceivingUnit as ReceivingUnitCode } from '../../domain/unitCodes';
import { GoodsType, Prisma, VehicleType } from '@prisma/client';
import type { AuthUser } from '../../middleware/auth';
import { helperFunctions } from '../../helperFunction';
import { roleHasUnitOperationScope } from '../../domain/permissions';
import { assertCanOperateUnit } from '../../domain/permissionAssertions';
import { recordAuditLog, userActor } from '../../services/auditLog';
import { domainError } from '../shared/domainError';
import type {
  GoodsTypeQuery,
  IntegrationQuery,
  OrderCodeQuery,
  PublicLocationQuery,
  PublicUnitScopeQuery,
  SlotsQuery,
  TimeWindowPayload,
  TimeWindowQuery,
  UnitConfigPayload,
  UnitGoodsTypePayload,
  UpdateTimeWindowPayload,
  UpdateUnitGoodsTypePayload,
  VehicleAvailabilityQuery,
} from './unitFormRequest';
import { listMockOrderCodes } from './orderCodeMock';
import * as unitRepository from './unitRepository';

interface ScopeInput {
  businessLocationId?: string | null;
}

interface UnitConfigAuditSnapshot {
  freshFoodEnabled: boolean;
  generalGoodsEnabled: boolean;
  thiCongEnabled: boolean;
  sundayFreshFoodOnly: boolean;
  truckSlotMinutes: number;
  motorbikeSlotMinutes: number;
  displayName: string;
  shortName: string;
  icon: string | null;
}

async function resolveLocationId(user: AuthUser | undefined, scope?: ScopeInput): Promise<string> {
  if (user?.role === 'SUPERADMIN') {
    return scope?.businessLocationId ?? user.businessLocationId ?? (await unitRepository.getDefaultBusinessLocation()).id;
  }
  if (!user?.businessLocationId) {
    throw domainError.forbidden('Tài khoản chưa được gán khu vực hoạt động.');
  }
  return user.businessLocationId;
}

async function assertUnitInLocation(unit: ReceivingUnitCode, businessLocationId: string) {
  const config = await unitRepository.findUnitConfig(unit, businessLocationId);
  if (!config) throw domainError.notFound('Config not found');
  return config;
}

function stripSecrets<T extends { vendorApiKey?: string | null; poApiKey?: string | null }>(config: T) {
  const { vendorApiKey, poApiKey, ...safe } = config;
  void vendorApiKey;
  void poApiKey;
  return safe;
}

function auditUnitConfigSnapshot(config: UnitConfigAuditSnapshot): Record<string, Prisma.InputJsonValue | null> {
  return {
    freshFoodEnabled: config.freshFoodEnabled,
    generalGoodsEnabled: config.generalGoodsEnabled,
    thiCongEnabled: config.thiCongEnabled,
    sundayFreshFoodOnly: config.sundayFreshFoodOnly,
    truckSlotMinutes: config.truckSlotMinutes,
    motorbikeSlotMinutes: config.motorbikeSlotMinutes,
    displayName: config.displayName,
    shortName: config.shortName,
    icon: config.icon,
  };
}

async function resolvePublicUnitConfig(unit: ReceivingUnitCode, scope?: PublicUnitScopeQuery) {
  if (scope?.unitConfigId || scope?.businessLocationId) {
    const config = await unitRepository.findPublicUnitConfig({
      unit,
      unitConfigId: scope.unitConfigId,
      businessLocationId: scope.businessLocationId,
    });
    if (!config) throw domainError.notFound('Config not found');
    return config;
  }

  const config = await unitRepository.findDefaultUnitConfig(unit);
  if (!config) throw domainError.notFound('Config not found');
  return config;
}

function parseLocalDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return {
    year,
    month,
    day,
    parsedDate: new Date(year, month - 1, day),
    dayStart: new Date(year, month - 1, day, 0, 0, 0),
    dayEnd: new Date(year, month - 1, day, 23, 59, 59),
  };
}

export async function listConfigs(user: AuthUser | undefined, scope?: ScopeInput) {
  const businessLocationId = await resolveLocationId(user, scope);
  const configs = await unitRepository.listUnitConfigs(businessLocationId);
  if (!user || user.role === 'SUPERADMIN' || !roleHasUnitOperationScope(user.role)) return configs;

  const allowed = new Set(
    user.operationUnits
      .filter((unit) => unit.isActive && unit.businessLocationId === businessLocationId)
      .map((unit) => unit.id),
  );
  return configs.filter((config) => allowed.has(config.id));
}

export function listPublicBusinessLocations() {
  return unitRepository.listPublicBusinessLocations();
}

export async function listPublicConfigs(query: PublicLocationQuery) {
  const location = await unitRepository.findActiveBusinessLocation(query.businessLocationId);
  if (!location) throw domainError.notFound('BusinessLocation not found');
  const configs = await unitRepository.listUnitConfigs(query.businessLocationId);
  return configs.filter((config) => config.isActive).map(stripSecrets);
}

export function listOrderCodes(query: OrderCodeQuery) {
  return {
    items: listMockOrderCodes(query.kind, query.search),
    configured: false,
    source: 'mock',
  };
}

export async function listTimeWindows(
  unit: ReceivingUnitCode,
  query: TimeWindowQuery,
  user: AuthUser | undefined,
  scope?: ScopeInput,
) {
  const businessLocationId = await resolveLocationId(user, scope);
  const config = await assertUnitInLocation(unit, businessLocationId);
  assertCanOperateUnit(user, config.id);

  let where: Prisma.DeliveryTimeWindowWhereInput;
  if (query.unitGoodsTypeId) {
    where = { unitGoodsTypeId: query.unitGoodsTypeId };
  } else if (query.goodsType) {
    where = { unit, goodsType: query.goodsType, unitGoodsTypeId: null };
  } else {
    where = { unit };
  }

  return unitRepository.listTimeWindows(where);
}

export async function createTimeWindow(
  unit: ReceivingUnitCode,
  body: TimeWindowPayload,
  user: AuthUser | undefined,
  scope?: ScopeInput,
) {
  const businessLocationId = await resolveLocationId(user, scope);
  const config = await assertUnitInLocation(unit, businessLocationId);
  assertCanOperateUnit(user, config.id);

  const win = await unitRepository.createTimeWindow(unit, body, config.id);
  await recordAuditLog({
    ...userActor(user),
    action: 'time_window.create',
    targetType: 'DeliveryTimeWindow',
    targetId: win.id,
    businessLocationId,
    after: {
      unit: win.unit,
      goodsType: win.goodsType,
      label: win.label,
      startTime: win.startTime,
      endTime: win.endTime,
    },
  });
  return win;
}

export async function updateTimeWindow(
  id: string,
  body: UpdateTimeWindowPayload,
  user: AuthUser | undefined,
  scope?: ScopeInput,
) {
  const existing = await unitRepository.findTimeWindow(id);
  if (!existing) throw domainError.notFound('Not found');

  const businessLocationId = await resolveLocationId(user, scope);
  const config = await assertUnitInLocation(existing.unit, businessLocationId);
  assertCanOperateUnit(user, existing.unitConfigId ?? config.id);

  const win = await unitRepository.updateTimeWindow(id, body);
  await recordAuditLog({
    ...userActor(user),
    action: 'time_window.update',
    targetType: 'DeliveryTimeWindow',
    targetId: win.id,
    businessLocationId,
    before: {
      unit: existing.unit,
      goodsType: existing.goodsType,
      label: existing.label,
      startTime: existing.startTime,
      endTime: existing.endTime,
    },
    after: {
      unit: win.unit,
      goodsType: win.goodsType,
      label: win.label,
      startTime: win.startTime,
      endTime: win.endTime,
    },
  });
  return win;
}

export async function deleteTimeWindow(id: string, user: AuthUser | undefined, scope?: ScopeInput) {
  const existing = await unitRepository.findTimeWindow(id);
  if (!existing) throw domainError.notFound('Not found');

  const businessLocationId = await resolveLocationId(user, scope);
  const config = await assertUnitInLocation(existing.unit, businessLocationId);
  assertCanOperateUnit(user, existing.unitConfigId ?? config.id);

  await unitRepository.deleteTimeWindow(id);
  await recordAuditLog({
    ...userActor(user),
    action: 'time_window.delete',
    targetType: 'DeliveryTimeWindow',
    targetId: id,
    businessLocationId,
    before: {
      unit: existing.unit,
      goodsType: existing.goodsType,
      label: existing.label,
      startTime: existing.startTime,
      endTime: existing.endTime,
    },
  });
}

export async function listGoodsTypes(unit: ReceivingUnitCode, query: GoodsTypeQuery, scope?: PublicUnitScopeQuery) {
  const config = await resolvePublicUnitConfig(unit, scope);
  return unitRepository.listGoodsTypes({
    unit,
    unitConfigId: config.id,
    baseType: query.baseType,
    enabledOnly: query.all !== '1',
  });
}

export async function createGoodsType(
  unit: ReceivingUnitCode,
  body: UnitGoodsTypePayload,
  user: AuthUser | undefined,
  scope?: ScopeInput,
) {
  const businessLocationId = await resolveLocationId(user, scope);
  const config = await assertUnitInLocation(unit, businessLocationId);
  assertCanOperateUnit(user, config.id);

  const item = await unitRepository.createGoodsType(unit, body, config.id);
  await recordAuditLog({
    ...userActor(user),
    action: 'goods_type.create',
    targetType: 'UnitGoodsType',
    targetId: item.id,
    businessLocationId,
    after: { unit: item.unit, name: item.name, emoji: item.emoji, baseType: item.baseType },
  });
  return item;
}

export async function updateGoodsType(
  id: string,
  body: UpdateUnitGoodsTypePayload,
  user: AuthUser | undefined,
  scope?: ScopeInput,
) {
  const existing = await unitRepository.findGoodsType(id);
  if (!existing) throw domainError.notFound('Not found');

  const businessLocationId = await resolveLocationId(user, scope);
  const config = await assertUnitInLocation(existing.unit, businessLocationId);
  assertCanOperateUnit(user, existing.unitConfigId ?? config.id);

  const item = await unitRepository.updateGoodsType(id, body);
  await recordAuditLog({
    ...userActor(user),
    action: 'goods_type.update',
    targetType: 'UnitGoodsType',
    targetId: item.id,
    businessLocationId,
    before: {
      name: existing.name,
      emoji: existing.emoji,
      baseType: existing.baseType,
      enabled: existing.enabled,
    },
    after: {
      name: item.name,
      emoji: item.emoji,
      baseType: item.baseType,
      enabled: item.enabled,
    },
  });
  return item;
}

export async function deleteGoodsType(id: string, user: AuthUser | undefined, scope?: ScopeInput) {
  const existing = await unitRepository.findGoodsType(id);
  if (!existing) throw domainError.notFound('Not found');

  const businessLocationId = await resolveLocationId(user, scope);
  const config = await assertUnitInLocation(existing.unit, businessLocationId);
  assertCanOperateUnit(user, existing.unitConfigId ?? config.id);

  await unitRepository.deleteGoodsType(id);
  await recordAuditLog({
    ...userActor(user),
    action: 'goods_type.delete',
    targetType: 'UnitGoodsType',
    targetId: id,
    businessLocationId,
    before: {
      unit: existing.unit,
      name: existing.name,
      emoji: existing.emoji,
      baseType: existing.baseType,
    },
  });
}

export async function getPublicConfig(unit: ReceivingUnitCode, scope?: PublicUnitScopeQuery) {
  const config = await resolvePublicUnitConfig(unit, scope);
  return stripSecrets(config);
}

export async function getVehicleAvailability(unit: ReceivingUnitCode, query: VehicleAvailabilityQuery, scope?: PublicUnitScopeQuery) {
  const config = await resolvePublicUnitConfig(unit, scope);

  if (!helperFunctions.unitAcceptsGoods(config, query.goodsType)) {
    return { vehicles: [], reason: 'Đơn vị này không nhận loại hàng đã chọn' };
  }

  const slots = await unitRepository.listMatchingOperationalSlots({ unitConfigId: config.id, unit });
  const capacityByVehicle = new Map<VehicleType, { slotCount: number; capacity: number }>();
  for (const slot of slots) {
    const current = capacityByVehicle.get(slot.vehicleType) ?? { slotCount: 0, capacity: 0 };
    capacityByVehicle.set(slot.vehicleType, {
      slotCount: current.slotCount + 1,
      capacity: current.capacity + slot.maxCapacity,
    });
  }

  const vehicles = [VehicleType.TRUCK, VehicleType.MOTORBIKE, VehicleType.OTHER].flatMap((vehicleType) => {
    const stats = capacityByVehicle.get(vehicleType);
    return stats ? [{ vehicleType, ...stats }] : [];
  });

  return {
    vehicles,
    reason: vehicles.length === 0 ? 'Không có slot khả dụng cho loại hàng này' : undefined,
  };
}

export async function getAvailableSlots(unit: ReceivingUnitCode, query: SlotsQuery, scope?: PublicUnitScopeQuery) {
  const config = await resolvePublicUnitConfig(unit, scope);

  const { year, month, day, parsedDate, dayStart, dayEnd } = parseLocalDate(query.date);
  const dayOfWeek = parsedDate.getDay();

  if (dayOfWeek === 0 && config.sundayFreshFoodOnly && query.goodsType !== GoodsType.FRESH_FOOD) {
    return { slots: [], reason: 'Chủ nhật chỉ nhận hàng tươi sống' };
  }

  if (!helperFunctions.unitAcceptsGoods(config, query.goodsType)) {
    return { slots: [], reason: 'Đơn vị này không nhận loại hàng đã chọn' };
  }

  const isMotorbike = query.vehicleType === VehicleType.MOTORBIKE;
  const slotMinutes = isMotorbike ? config.motorbikeSlotMinutes : config.truckSlotMinutes;
  const matchingSlots = await unitRepository.listMatchingOperationalSlots({
    unitConfigId: config.id,
    unit,
    vehicleType: query.vehicleType,
  });
  const maxPerSlot = matchingSlots.reduce((sum, slot) => sum + slot.maxCapacity, 0);

  if (maxPerSlot <= 0) {
    return { slots: [], reason: 'Không có slot khả dụng cho loại xe này' };
  }

  let timeWindows = query.unitGoodsTypeId
    ? await unitRepository.listTimeWindows({ unitGoodsTypeId: query.unitGoodsTypeId, enabled: true })
    : await unitRepository.listTimeWindows({
        unitConfigId: config.id,
        unit,
        goodsType: query.goodsType,
        unitGoodsTypeId: null,
        enabled: true,
      });

  if (timeWindows.length === 0 && query.unitGoodsTypeId) {
    timeWindows = await unitRepository.listTimeWindows({
      unitConfigId: config.id,
      unit,
      goodsType: query.goodsType,
      unitGoodsTypeId: null,
      enabled: true,
    });
  }

  if (timeWindows.length === 0) {
    return { slots: [], reason: 'Chưa cấu hình khung giờ nhận hàng. Liên hệ quản trị viên.' };
  }

  const bookings = await unitRepository.listActiveBookingsForDay({
    unit,
    unitConfigId: config.id,
    vehicleType: query.vehicleType,
    dayStart,
    dayEnd,
  });

  const slotCounts: Record<string, number> = {};
  for (const booking of bookings) {
    if (!booking.requestedTime) continue;
    const key = helperFunctions.minutesToTime(
      booking.requestedTime.getHours() * 60 + booking.requestedTime.getMinutes(),
    );
    slotCounts[key] = (slotCounts[key] ?? 0) + 1;
  }

  const now = new Date();
  const isToday = now.getFullYear() === year && now.getMonth() === month - 1 && now.getDate() === day;
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const slots = [];
  for (const win of timeWindows) {
    const startMins = helperFunctions.timeToMinutes(win.startTime);
    const endMins = helperFunctions.timeToMinutes(win.endTime);
    let cur = startMins;
    while (cur + slotMinutes <= endMins) {
      const time = helperFunctions.minutesToTime(cur);
      const booked = slotCounts[time] ?? 0;
      const isPast = isToday && cur <= nowMins;
      slots.push({
        time,
        booked,
        maxPerSlot,
        available: !isPast && booked < maxPerSlot,
        isPast,
        windowLabel: win.label,
      });
      cur += slotMinutes;
    }
  }

  return { slots };
}

export async function updateConfig(
  unit: ReceivingUnitCode,
  body: UnitConfigPayload,
  user: AuthUser | undefined,
  scope?: ScopeInput,
) {
  const businessLocationId = await resolveLocationId(user, scope);
  const existingConfig = await unitRepository.findUnitConfigForAudit(unit, businessLocationId);
  if (existingConfig) {
    assertCanOperateUnit(user, existingConfig.id);
  }

  const config = await unitRepository.upsertUnitConfig({ unit, businessLocationId, body });
  await recordAuditLog({
    ...userActor(user),
    action: 'unit_config.update',
    targetType: 'UnitConfig',
    targetId: config.id,
    businessLocationId,
    before: existingConfig ? auditUnitConfigSnapshot(existingConfig) : undefined,
    after: auditUnitConfigSnapshot(config),
  });
  return stripSecrets(config);
}

export async function getVendors(unit: ReceivingUnitCode, query: IntegrationQuery) {
  const config = await unitRepository.findDefaultUnitConfig(unit);
  if (!config?.vendorApiUrl) {
    return { vendors: [], configured: false };
  }

  try {
    const url = new URL(config.vendorApiUrl);
    if (query.search) url.searchParams.set('search', query.search);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (config.vendorApiKey) headers.Authorization = `Bearer ${config.vendorApiKey}`;

    const response = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(5000) });
    return await response.json();
  } catch {
    return { vendors: [], error: 'Không thể kết nối API nhà cung cấp' };
  }
}

export async function getPurchaseOrders(unit: ReceivingUnitCode, query: IntegrationQuery) {
  const config = await unitRepository.findDefaultUnitConfig(unit);
  if (!config?.poApiUrl) {
    return { pos: [], configured: false };
  }

  try {
    const url = new URL(config.poApiUrl);
    if (query.search) url.searchParams.set('search', query.search);
    if (query.vendorId) url.searchParams.set('vendorId', query.vendorId);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (config.poApiKey) headers.Authorization = `Bearer ${config.poApiKey}`;

    const response = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(5000) });
    return await response.json();
  } catch {
    return { pos: [], error: 'Không thể kết nối API PO' };
  }
}
