import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { recordAuditLog, userActor } from '../../services/auditLog';
import { invalidateAppConfigCache } from '../../services/appConfig';
import { refreshAuthUserCache, revokeUserSessions } from '../../services/authSession';
import { invalidateUserUnitPermissionCache } from '../../services/unitPermission';
import { domainError } from '../shared/domainError';
import type { SuperadminFormRequest } from './superadminFormRequest';

type LocationQuery = ReturnType<typeof SuperadminFormRequest.parseLocationQuery>;
type BusinessLocationCreate = ReturnType<typeof SuperadminFormRequest.parseBusinessLocationCreate>;
type BusinessLocationUpdate = ReturnType<typeof SuperadminFormRequest.parseBusinessLocationUpdate>;
type UnitConfigCreate = ReturnType<typeof SuperadminFormRequest.parseUnitConfigCreate>;
type UnitConfigUpdate = ReturnType<typeof SuperadminFormRequest.parseUnitConfigUpdate>;
type AutoWarehouseVendorCreate = ReturnType<typeof SuperadminFormRequest.parseAutoWarehouseVendorCreate>;
type AutoWarehouseVendorUpdate = ReturnType<typeof SuperadminFormRequest.parseAutoWarehouseVendorUpdate>;
type AppConfigUpdate = ReturnType<typeof SuperadminFormRequest.parseAppConfigUpdate>;
type ReceivingTimeConfigCreate = ReturnType<typeof SuperadminFormRequest.parseReceivingTimeConfigCreate>;
type ReceivingTimeConfigUpdate = ReturnType<typeof SuperadminFormRequest.parseReceivingTimeConfigUpdate>;
type DeviceCreate = ReturnType<typeof SuperadminFormRequest.parseDeviceCreate>;
type DeviceUpdate = ReturnType<typeof SuperadminFormRequest.parseDeviceUpdate>;

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function stripUnitSecrets<T extends { vendorApiKey?: string | null; poApiKey?: string | null }>(unit: T) {
  const { vendorApiKey, poApiKey, ...safe } = unit;
  void vendorApiKey;
  void poApiKey;
  return safe;
}

function maskAppConfig<T extends { isSensitive: boolean; value: unknown }>(item: T) {
  return {
    ...item,
    value: item.isSensitive ? null : item.value,
    masked: item.isSensitive,
  };
}

async function refreshUsersForUnit(unitConfigId: string) {
  const permissions = await prisma.userUnitPermission.findMany({
    where: { unitConfigId },
    select: { userId: true },
  });
  await Promise.all(permissions.map(async ({ userId }) => {
    await invalidateUserUnitPermissionCache(userId);
    await refreshAuthUserCache(userId);
  }));
}

async function refreshUsersForLocation(businessLocationId: string, revokeInactive = false) {
  const users = await prisma.user.findMany({
    where: { businessLocationId },
    select: { id: true },
  });
  await Promise.all(users.map(async ({ id }) => {
    await invalidateUserUnitPermissionCache(id);
    await refreshAuthUserCache(id);
    if (revokeInactive) await revokeUserSessions(id);
  }));
}

export async function overview() {
  const [
    businessLocations,
    unitConfigs,
    zones,
    slots,
    users,
    goodsTypes,
    appConfigs,
    devices,
  ] = await Promise.all([
    prisma.businessLocation.count(),
    prisma.unitConfig.count(),
    prisma.zone.count(),
    prisma.slot.count(),
    prisma.user.count(),
    prisma.unitGoodsType.count(),
    prisma.appConfig.count(),
    prisma.device.count(),
  ]);

  const locations = await prisma.businessLocation.findMany({
    orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    include: {
      _count: { select: { unitConfigs: true, users: true, devices: true } },
      unitConfigs: {
        where: { isActive: true },
        select: { id: true, unit: true, displayName: true, shortName: true, icon: true, isActive: true },
        orderBy: { unit: 'asc' },
      },
    },
  });

  return {
    counts: { businessLocations, unitConfigs, zones, slots, users, goodsTypes, appConfigs, devices },
    locations,
  };
}

export function listBusinessLocations() {
  return prisma.businessLocation.findMany({
    orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    include: { _count: { select: { unitConfigs: true, users: true, devices: true } } },
  });
}

export async function createBusinessLocation(body: BusinessLocationCreate, actor: AuthUser | undefined) {
  const location = await prisma.businessLocation.create({ data: body });
  await recordAuditLog({
    ...userActor(actor),
    action: 'business_location.create',
    targetType: 'BusinessLocation',
    targetId: location.id,
    businessLocationId: location.id,
    after: json(location),
  });
  return location;
}

export async function updateBusinessLocation(id: string, body: BusinessLocationUpdate, actor: AuthUser | undefined) {
  const existing = await prisma.businessLocation.findUnique({ where: { id } });
  if (!existing) throw domainError.notFound('BusinessLocation not found');

  const location = await prisma.businessLocation.update({ where: { id }, data: body });
  await refreshUsersForLocation(id, body.isActive === false);
  await recordAuditLog({
    ...userActor(actor),
    action: body.isActive === false ? 'business_location.deactivate' : 'business_location.update',
    targetType: 'BusinessLocation',
    targetId: id,
    businessLocationId: id,
    before: json(existing),
    after: json(location),
  });
  return location;
}

export async function deleteBusinessLocation(id: string, actor: AuthUser | undefined) {
  const existing = await prisma.businessLocation.findUnique({
    where: { id },
    include: { _count: { select: { unitConfigs: true, users: true, devices: true } } },
  });
  if (!existing) throw domainError.notFound('BusinessLocation not found');

  if (existing._count.unitConfigs || existing._count.users || existing._count.devices) {
    const location = await prisma.businessLocation.update({ where: { id }, data: { isActive: false } });
    await refreshUsersForLocation(id, true);
    await recordAuditLog({
      ...userActor(actor),
      action: 'business_location.deactivate',
      targetType: 'BusinessLocation',
      targetId: id,
      businessLocationId: id,
      before: json(existing),
      after: json(location),
    });
    return { deleted: false, deactivated: true, location };
  }

  await prisma.businessLocation.delete({ where: { id } });
  await recordAuditLog({
    ...userActor(actor),
    action: 'business_location.delete',
    targetType: 'BusinessLocation',
    targetId: id,
    before: json(existing),
  });
  return { deleted: true };
}

export async function listUnitConfigs(query: LocationQuery) {
  const units = await prisma.unitConfig.findMany({
    where: {
      ...(query.businessLocationId ? { businessLocationId: query.businessLocationId } : {}),
      ...(query.unitConfigId ? { id: query.unitConfigId } : {}),
      ...(query.unit ? { unit: query.unit } : {}),
    },
    include: {
      businessLocation: { select: { id: true, code: true, locationName: true, isActive: true } },
      _count: { select: { zones: true, userPermissions: true, deliveryRegistrations: true } },
    },
    orderBy: [{ businessLocationId: 'asc' }, { unit: 'asc' }],
  });
  return units.map(stripUnitSecrets);
}

export async function createUnitConfig(body: UnitConfigCreate, actor: AuthUser | undefined) {
  const location = await prisma.businessLocation.findUnique({ where: { id: body.businessLocationId } });
  if (!location) throw domainError.badRequest('BusinessLocation không tồn tại.');

  const unit = await prisma.unitConfig.create({ data: body });
  await recordAuditLog({
    ...userActor(actor),
    action: 'unit_config.create',
    targetType: 'UnitConfig',
    targetId: unit.id,
    businessLocationId: unit.businessLocationId,
    unitConfigId: unit.id,
    after: json(stripUnitSecrets(unit)),
  });
  return stripUnitSecrets(unit);
}

export async function updateUnitConfig(id: string, body: UnitConfigUpdate, actor: AuthUser | undefined) {
  const existing = await prisma.unitConfig.findUnique({ where: { id } });
  if (!existing) throw domainError.notFound('UnitConfig not found');

  const unit = await prisma.unitConfig.update({ where: { id }, data: body });
  if (body.isActive !== undefined || body.unit !== undefined || body.displayName !== undefined || body.shortName !== undefined) {
    await refreshUsersForUnit(id);
  }
  await recordAuditLog({
    ...userActor(actor),
    action: body.isActive === false ? 'unit_config.deactivate' : 'unit_config.update',
    targetType: 'UnitConfig',
    targetId: id,
    businessLocationId: unit.businessLocationId,
    unitConfigId: id,
    before: json(stripUnitSecrets(existing)),
    after: json(stripUnitSecrets(unit)),
  });
  return stripUnitSecrets(unit);
}

export async function deleteUnitConfig(id: string, actor: AuthUser | undefined) {
  const existing = await prisma.unitConfig.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          zones: true,
          userPermissions: true,
          deliveryRegistrations: true,
          ticketSequences: true,
          registrationSequences: true,
          autoWarehouseVendors: true,
          receivingTimeConfigs: true,
          unitGoodsTypes: true,
          deliveryTimeWindows: true,
        },
      },
    },
  });
  if (!existing) throw domainError.notFound('UnitConfig not found');

  const linked = Object.values(existing._count).some((count) => count > 0);
  if (linked) {
    const unit = await prisma.unitConfig.update({ where: { id }, data: { isActive: false } });
    await refreshUsersForUnit(id);
    await recordAuditLog({
      ...userActor(actor),
      action: 'unit_config.deactivate',
      targetType: 'UnitConfig',
      targetId: id,
      businessLocationId: existing.businessLocationId,
      unitConfigId: id,
      before: json(stripUnitSecrets(existing)),
      after: json(stripUnitSecrets(unit)),
    });
    return { deleted: false, deactivated: true, unitConfig: stripUnitSecrets(unit) };
  }

  await prisma.unitConfig.delete({ where: { id } });
  await recordAuditLog({
    ...userActor(actor),
    action: 'unit_config.delete',
    targetType: 'UnitConfig',
    targetId: id,
    businessLocationId: existing.businessLocationId,
    unitConfigId: id,
    before: json(stripUnitSecrets(existing)),
  });
  return { deleted: true };
}

export function listZones(query: LocationQuery) {
  return prisma.zone.findMany({
    where: {
      ...(query.unitConfigId ? { unitConfigId: query.unitConfigId } : {}),
      ...(query.businessLocationId ? { unitConfig: { businessLocationId: query.businessLocationId } } : {}),
    },
    include: {
      unitConfig: { select: { id: true, unit: true, displayName: true, businessLocationId: true } },
      _count: { select: { slots: true } },
    },
    orderBy: [{ unitConfigId: 'asc' }, { code: 'asc' }],
  });
}

export function listSlots(query: LocationQuery) {
  return prisma.slot.findMany({
    where: {
      ...(query.unit ? { assignedUnit: query.unit } : {}),
      zone: {
        ...(query.unitConfigId ? { unitConfigId: query.unitConfigId } : {}),
        ...(query.businessLocationId ? { unitConfig: { businessLocationId: query.businessLocationId } } : {}),
      },
    },
    include: {
      zone: {
        select: {
          id: true,
          code: true,
          name: true,
          unitConfigId: true,
          unitConfig: { select: { id: true, unit: true, displayName: true, businessLocationId: true } },
        },
      },
      _count: { select: { deliveries: true } },
    },
    orderBy: [{ assignedUnit: 'asc' }, { vehicleType: 'asc' }, { code: 'asc' }],
  });
}

export function listGoodsTypes(query: LocationQuery) {
  return prisma.unitGoodsType.findMany({
    where: {
      ...(query.unit ? { unit: query.unit } : {}),
      ...(query.unitConfigId ? { unitConfigId: query.unitConfigId } : {}),
      ...(query.businessLocationId ? { unitConfig: { businessLocationId: query.businessLocationId } } : {}),
    },
    include: { unitConfig: { select: { id: true, unit: true, displayName: true, businessLocationId: true } } },
    orderBy: [{ unit: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export function listTimeWindows(query: LocationQuery) {
  return prisma.deliveryTimeWindow.findMany({
    where: {
      ...(query.unit ? { unit: query.unit } : {}),
      ...(query.unitConfigId ? { unitConfigId: query.unitConfigId } : {}),
      ...(query.businessLocationId ? { unitConfig: { businessLocationId: query.businessLocationId } } : {}),
    },
    include: {
      unitConfig: { select: { id: true, unit: true, displayName: true, businessLocationId: true } },
      unitGoodsType: { select: { id: true, name: true, baseType: true } },
    },
    orderBy: [{ unit: 'asc' }, { goodsType: 'asc' }, { sortOrder: 'asc' }, { startTime: 'asc' }],
  });
}

export function listAutoWarehouseVendors(query: LocationQuery) {
  return prisma.autoWarehouseVendor.findMany({
    where: {
      ...(query.unit ? { unit: query.unit } : {}),
      ...(query.unitConfigId ? { unitConfigId: query.unitConfigId } : {}),
      ...(query.businessLocationId ? { unitConfig: { businessLocationId: query.businessLocationId } } : {}),
    },
    include: { unitConfig: { select: { id: true, unit: true, displayName: true, businessLocationId: true } } },
    orderBy: [{ unit: 'asc' }, { vendorCode: 'asc' }],
  });
}

export async function createAutoWarehouseVendor(body: AutoWarehouseVendorCreate, actor: AuthUser | undefined) {
  const unitConfig = await prisma.unitConfig.findUnique({ where: { id: body.unitConfigId } });
  if (!unitConfig) throw domainError.badRequest('UnitConfig không tồn tại.');
  const vendor = await prisma.autoWarehouseVendor.create({
    data: { ...body, unit: unitConfig.unit },
  });
  await recordAuditLog({
    ...userActor(actor),
    action: 'auto_warehouse_vendor.create',
    targetType: 'AutoWarehouseVendor',
    targetId: vendor.id,
    businessLocationId: unitConfig.businessLocationId,
    unitConfigId: unitConfig.id,
    after: json(vendor),
  });
  return vendor;
}

export async function updateAutoWarehouseVendor(id: string, body: AutoWarehouseVendorUpdate, actor: AuthUser | undefined) {
  const existing = await prisma.autoWarehouseVendor.findUnique({
    where: { id },
    include: { unitConfig: true },
  });
  if (!existing) throw domainError.notFound('AutoWarehouseVendor not found');
  const vendor = await prisma.autoWarehouseVendor.update({ where: { id }, data: body });
  await recordAuditLog({
    ...userActor(actor),
    action: 'auto_warehouse_vendor.update',
    targetType: 'AutoWarehouseVendor',
    targetId: id,
    businessLocationId: existing.unitConfig?.businessLocationId,
    unitConfigId: existing.unitConfigId,
    before: json(existing),
    after: json(vendor),
  });
  return vendor;
}

export async function deleteAutoWarehouseVendor(id: string, actor: AuthUser | undefined) {
  const existing = await prisma.autoWarehouseVendor.findUnique({ where: { id }, include: { unitConfig: true } });
  if (!existing) throw domainError.notFound('AutoWarehouseVendor not found');
  const vendor = await prisma.autoWarehouseVendor.update({ where: { id }, data: { active: false } });
  await recordAuditLog({
    ...userActor(actor),
    action: 'auto_warehouse_vendor.deactivate',
    targetType: 'AutoWarehouseVendor',
    targetId: id,
    businessLocationId: existing.unitConfig?.businessLocationId,
    unitConfigId: existing.unitConfigId,
    before: json(existing),
    after: json(vendor),
  });
  return { deleted: false, deactivated: true, vendor };
}

export function listDevices(query: LocationQuery) {
  return prisma.device.findMany({
    where: { ...(query.businessLocationId ? { businessLocationId: query.businessLocationId } : {}) },
    select: {
      id: true,
      code: true,
      name: true,
      businessLocationId: true,
      deviceType: true,
      isActive: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
      businessLocation: { select: { id: true, code: true, locationName: true } },
    },
    orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
  });
}

export async function createDevice(body: DeviceCreate, actor: AuthUser | undefined) {
  const location = await prisma.businessLocation.findUnique({ where: { id: body.businessLocationId } });
  if (!location) throw domainError.badRequest('BusinessLocation không tồn tại.');
  const deviceSecretHash = await bcrypt.hash(body.deviceSecret, 10);
  const { deviceSecret, ...safeBody } = body;
  void deviceSecret;
  const device = await prisma.device.create({
    data: { ...safeBody, deviceSecretHash },
    select: {
      id: true, code: true, name: true, businessLocationId: true, deviceType: true, isActive: true, lastSeenAt: true, createdAt: true, updatedAt: true,
    },
  });
  await recordAuditLog({
    ...userActor(actor),
    action: 'device.create',
    targetType: 'Device',
    targetId: device.id,
    businessLocationId: device.businessLocationId,
    after: json(device),
  });
  return device;
}

export async function updateDevice(id: string, body: DeviceUpdate, actor: AuthUser | undefined) {
  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) throw domainError.notFound('Device not found');
  const deviceSecretHash = body.deviceSecret ? await bcrypt.hash(body.deviceSecret, 10) : undefined;
  const { deviceSecret, ...safeBody } = body;
  void deviceSecret;
  const device = await prisma.device.update({
    where: { id },
    data: { ...safeBody, ...(deviceSecretHash ? { deviceSecretHash } : {}) },
    select: {
      id: true, code: true, name: true, businessLocationId: true, deviceType: true, isActive: true, lastSeenAt: true, createdAt: true, updatedAt: true,
    },
  });
  await recordAuditLog({
    ...userActor(actor),
    action: 'device.update',
    targetType: 'Device',
    targetId: id,
    businessLocationId: device.businessLocationId,
    before: json({ code: existing.code, name: existing.name, deviceType: existing.deviceType, isActive: existing.isActive }),
    after: json({ ...device, secretRotated: Boolean(deviceSecretHash) }),
  });
  return device;
}

export async function deleteDevice(id: string, actor: AuthUser | undefined) {
  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) throw domainError.notFound('Device not found');
  const device = await prisma.device.update({ where: { id }, data: { isActive: false } });
  await recordAuditLog({
    ...userActor(actor),
    action: 'device.deactivate',
    targetType: 'Device',
    targetId: id,
    businessLocationId: device.businessLocationId,
    before: json({ code: existing.code, name: existing.name, isActive: existing.isActive }),
    after: json({ code: device.code, name: device.name, isActive: device.isActive }),
  });
  return { deleted: false, deactivated: true, device };
}

export async function listAppConfigs() {
  const items = await prisma.appConfig.findMany({
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  });
  return items.map(maskAppConfig);
}

export async function updateAppConfig(key: string, body: AppConfigUpdate, actor: AuthUser | undefined) {
  const existing = await prisma.appConfig.findUnique({ where: { key } });
  if (existing && !existing.isRuntimeEditable) {
    throw domainError.badRequest('AppConfig này không cho phép chỉnh runtime.');
  }
  const config = await prisma.appConfig.upsert({
    where: { key },
    update: {
      value: json(body.value),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.isRuntimeEditable !== undefined ? { isRuntimeEditable: body.isRuntimeEditable } : {}),
    },
    create: {
      key,
      category: body.category ?? 'system',
      value: json(body.value),
      description: body.description ?? '',
      isRuntimeEditable: body.isRuntimeEditable ?? true,
    },
  });
  await invalidateAppConfigCache(key);
  await recordAuditLog({
    ...userActor(actor),
    action: 'app_config.update',
    targetType: 'AppConfig',
    targetId: config.id,
    before: existing ? json({ key: existing.key, category: existing.category, isSensitive: existing.isSensitive, isRuntimeEditable: existing.isRuntimeEditable }) : undefined,
    after: json({ key: config.key, category: config.category, isSensitive: config.isSensitive, isRuntimeEditable: config.isRuntimeEditable }),
  });
  return maskAppConfig(config);
}

export function listReceivingTimeConfigs(query: LocationQuery) {
  return prisma.receivingTimeConfig.findMany({
    where: {
      ...(query.unit ? { unit: query.unit } : {}),
      ...(query.unitConfigId ? { unitConfigId: query.unitConfigId } : {}),
      ...(query.businessLocationId ? { unitConfig: { businessLocationId: query.businessLocationId } } : {}),
    },
    include: { unitConfig: { select: { id: true, unit: true, displayName: true, businessLocationId: true } } },
    orderBy: [{ unit: 'asc' }, { vehicleType: 'asc' }, { goodsType: 'asc' }],
  });
}

export async function createReceivingTimeConfig(body: ReceivingTimeConfigCreate, actor: AuthUser | undefined) {
  const unitConfig = await prisma.unitConfig.findUnique({ where: { id: body.unitConfigId } });
  if (!unitConfig) throw domainError.badRequest('UnitConfig không tồn tại.');
  const config = await prisma.receivingTimeConfig.create({
    data: {
      ...body,
      unit: unitConfig.unit,
      lastAnalyzedAt: new Date(),
    },
  });
  await recordAuditLog({
    ...userActor(actor),
    action: 'receiving_time_config.create',
    targetType: 'ReceivingTimeConfig',
    targetId: config.id,
    businessLocationId: unitConfig.businessLocationId,
    unitConfigId: unitConfig.id,
    after: json(config),
  });
  return config;
}

export async function updateReceivingTimeConfig(id: string, body: ReceivingTimeConfigUpdate, actor: AuthUser | undefined) {
  const existing = await prisma.receivingTimeConfig.findUnique({ where: { id }, include: { unitConfig: true } });
  if (!existing) throw domainError.notFound('ReceivingTimeConfig not found');
  const config = await prisma.receivingTimeConfig.update({ where: { id }, data: body });
  await recordAuditLog({
    ...userActor(actor),
    action: 'receiving_time_config.update',
    targetType: 'ReceivingTimeConfig',
    targetId: id,
    businessLocationId: existing.unitConfig?.businessLocationId,
    unitConfigId: existing.unitConfigId,
    before: json(existing),
    after: json(config),
  });
  return config;
}

export async function deleteReceivingTimeConfig(id: string, actor: AuthUser | undefined) {
  const existing = await prisma.receivingTimeConfig.findUnique({ where: { id }, include: { unitConfig: true } });
  if (!existing) throw domainError.notFound('ReceivingTimeConfig not found');
  await prisma.receivingTimeConfig.delete({ where: { id } });
  await recordAuditLog({
    ...userActor(actor),
    action: 'receiving_time_config.delete',
    targetType: 'ReceivingTimeConfig',
    targetId: id,
    businessLocationId: existing.unitConfig?.businessLocationId,
    unitConfigId: existing.unitConfigId,
    before: json(existing),
  });
  return { deleted: true };
}
