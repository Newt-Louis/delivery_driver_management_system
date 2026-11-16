import { ReceivingUnit, type ReceivingUnit as ReceivingUnitCode } from '../../domain/unitCodes';
import { Prisma, VehicleType } from '@prisma/client';
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
  autoCancelCalledEnabled: boolean;
  autoCancelCalledAfterMinutes: number;
  displayName: string;
  shortName: string;
  icon: string | null;
}

async function resolveLocationId(user: AuthUser | undefined, scope?: ScopeInput): Promise<string> {
  if (!user?.businessLocationId) {
    throw domainError.forbidden(
      user?.role === 'SUPERADMIN'
        ? 'SUPERADMIN chưa chọn khu vực vận hành.'
        : 'Tài khoản chưa được gán khu vực hoạt động.',
    );
  }
  if (scope?.businessLocationId && scope.businessLocationId !== user.businessLocationId) {
    throw domainError.forbidden('Khu vực yêu cầu không khớp khu vực vận hành hiện tại.');
  }
  return user.businessLocationId;
}

async function assertUnitInLocation(unit: ReceivingUnitCode, businessLocationId: string) {
  const config = await unitRepository.findUnitConfig(unit, businessLocationId);
  if (!config) throw domainError.notFound('Config not found');
  return config;
}

function timeOfDayMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Khung giờ chỉ dùng để chặn check-in trong ngày nên phải bắt đầu trước khi kết thúc. */
function assertValidTimeWindowRange(startTime: string, endTime: string) {
  if (timeOfDayMinutes(startTime) >= timeOfDayMinutes(endTime)) {
    throw domainError.badRequest('Giờ bắt đầu phải sớm hơn giờ kết thúc.', 'InvalidTimeWindow');
  }
}

function assertTimeWindowInUnit(window: { unitConfigId: string | null }, unitConfigId: string) {
  if (window.unitConfigId && window.unitConfigId !== unitConfigId) throw domainError.notFound('Not found');
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
    autoCancelCalledEnabled: config.autoCancelCalledEnabled,
    autoCancelCalledAfterMinutes: config.autoCancelCalledAfterMinutes,
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

  // Luôn giới hạn theo UnitConfig của khu vực: cùng mã unit có thể tồn tại ở nhiều BusinessLocation.
  let where: Prisma.DeliveryTimeWindowWhereInput;
  if (query.unitGoodsTypeId) {
    where = { unitConfigId: config.id, unitGoodsTypeId: query.unitGoodsTypeId };
  } else if (query.goodsType) {
    where = { unitConfigId: config.id, goodsType: query.goodsType, unitGoodsTypeId: null };
  } else {
    where = { unitConfigId: config.id };
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

  assertValidTimeWindowRange(body.startTime, body.endTime);
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
  assertTimeWindowInUnit(existing, config.id);
  assertCanOperateUnit(user, existing.unitConfigId ?? config.id);

  assertValidTimeWindowRange(body.startTime ?? existing.startTime, body.endTime ?? existing.endTime);
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
  assertTimeWindowInUnit(existing, config.id);
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
  // A slot's configured vehicle type is not a restriction on a manual call.
  // Both vehicle types may register whenever this unit has operational slots.
  const capacity = slots.reduce((sum, slot) => sum + slot.maxCapacity, 0);
  const vehicles = slots.length
    ? [VehicleType.TRUCK, VehicleType.MOTORBIKE].map((vehicleType) => ({ vehicleType, slotCount: slots.length, capacity }))
    : [];

  return {
    vehicles,
    reason: vehicles.length === 0 ? 'Không có slot khả dụng cho loại hàng này' : undefined,
  };
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
