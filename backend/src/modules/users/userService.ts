import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../middleware/auth';
import { recordAuditLog, userActor } from '../../services/auditLog';
import { invalidateAuthUserCache, refreshAuthUserCache, revokeUserSessions } from '../../services/authSession';
import {
  assertUnitConfigsInLocation,
  invalidateUserUnitPermissionCache,
  replaceUserUnitPermissions,
  resolveLegacyUnitConfigId,
  roleRequiresUnitPermission,
} from '../../services/unitPermission';
import { domainError } from '../shared/domainError';
import type {
  CreateUserPayload,
  LocationStaffCreatePayload,
  LocationStaffUpdatePayload,
  UpdateUserPayload,
} from './userFormRequest';
import { UNIT_REQUIRED_ROLES, UNIT_VALUES } from './userFormRequest';
import * as userRepository from './userRepository';

type LegacyUnit = typeof UNIT_VALUES[number];

type SerializedUser<T extends { unitPermissions?: { unitConfig: unknown }[] }> = Omit<T, 'unitPermissions'> & {
  unitPermissions: unknown[];
};

function serializeUser<T extends { unitPermissions?: { unitConfig: unknown }[] }>(user: T): SerializedUser<T> {
  return {
    ...user,
    unitPermissions: user.unitPermissions?.map((permission) => permission.unitConfig) ?? [],
  };
}

function permissionIdsFromUser(user: { unitPermissions?: { unitConfig: { id: string } }[] }): string[] {
  return user.unitPermissions?.map((permission) => permission.unitConfig.id) ?? [];
}

function auditJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function auditUserSnapshot(user: {
  name: string;
  email: string;
  role: string;
  unit: string | null;
  unitPermissions?: unknown[];
  department?: string | null;
  isActive?: boolean;
}) {
  return auditJson({
    name: user.name,
    email: user.email,
    role: user.role,
    unit: user.unit,
    ...(user.unitPermissions !== undefined ? { unitPermissions: user.unitPermissions } : {}),
    ...(user.department !== undefined ? { department: user.department } : {}),
    ...(user.isActive !== undefined ? { isActive: user.isActive } : {}),
  });
}

async function assertBusinessLocationScope(role: string, businessLocationId: string | null | undefined) {
  if (role === 'SUPERADMIN') {
    if (businessLocationId) throw domainError.badRequest('SUPERADMIN không gắn với BusinessLocation');
    return null;
  }

  if (!businessLocationId) {
    throw domainError.badRequest('Tài khoản không phải SUPERADMIN phải có BusinessLocation ID');
  }

  const location = await userRepository.findBusinessLocation(businessLocationId);
  if (!location) {
    throw domainError.badRequest('BusinessLocation không tồn tại');
  }
  return businessLocationId;
}

async function assertUnitScope(role: string, unit: string | null | undefined, businessLocationId: string | null) {
  if (role === 'SUPERADMIN') return null;

  const normalizedUnit = unit ?? null;

  if ((UNIT_REQUIRED_ROLES as readonly string[]).includes(role) && !normalizedUnit) {
    throw domainError.badRequest('Tài khoản RECEIVING và CHECKIN bắt buộc phải chọn đơn vị.');
  }

  if (!normalizedUnit) return null;

  if (!businessLocationId) {
    throw domainError.badRequest('Không thể gán đơn vị nếu tài khoản chưa thuộc BusinessLocation.');
  }

  const unitConfig = await userRepository.findUnitConfigByLocationAndUnit(businessLocationId, normalizedUnit);
  if (!unitConfig) {
    throw domainError.badRequest('Đơn vị không tồn tại trong BusinessLocation của tài khoản.');
  }

  return normalizedUnit;
}

async function resolveUnitAssignment(args: {
  role: string;
  unit: string | null | undefined;
  unitConfigIds: string[] | undefined;
  existingUnitConfigIds?: string[];
  businessLocationId: string | null;
}) {
  if (!args.businessLocationId) {
    const unit = await assertUnitScope(args.role, args.unit, args.businessLocationId);
    return { unit: unit as LegacyUnit | null, unitConfigIds: [] as string[], unitPermissions: [] };
  }

  if (!roleRequiresUnitPermission(args.role)) {
    const unit = await assertUnitScope(args.role, args.unit, args.businessLocationId);
    return { unit: unit as LegacyUnit | null, unitConfigIds: [] as string[], unitPermissions: [] };
  }

  const requestedIds = args.unitConfigIds !== undefined
    ? [...new Set(args.unitConfigIds)]
    : [...new Set(args.existingUnitConfigIds ?? [])];

  let unitPermissions = requestedIds.length > 0
    ? await assertUnitConfigsInLocation(requestedIds, args.businessLocationId)
    : [];

  if (unitPermissions.length === 0 && args.unit) {
    const legacyUnitConfig = await resolveLegacyUnitConfigId({
      businessLocationId: args.businessLocationId,
      unit: args.unit,
    });
    if (legacyUnitConfig) unitPermissions = [legacyUnitConfig];
  }

  if (unitPermissions.length === 0) {
    throw domainError.badRequest('Tài khoản RECEIVING và CHECKIN bắt buộc phải chọn ít nhất một đơn vị.');
  }

  const requestedLegacyUnit = args.unit ?? null;
  const legacyUnit = requestedLegacyUnit && unitPermissions.some((permission) => permission.unit === requestedLegacyUnit)
    ? requestedLegacyUnit
    : unitPermissions[0].unit;

  return {
    unit: legacyUnit as LegacyUnit,
    unitConfigIds: unitPermissions.map((permission) => permission.id),
    unitPermissions,
  };
}

async function assertSingleSuperadmin(targetUserId?: string) {
  const exists = await userRepository.findOtherSuperadmin(targetUserId);
  if (exists) {
    throw domainError.conflict('Hệ thống chỉ cho phép một tài khoản SUPERADMIN');
  }
}

function requireLocationAdminScope(user: AuthUser | undefined) {
  const businessLocationId = user?.businessLocationId;
  if (!businessLocationId) {
    throw domainError.forbidden('Tài khoản ADMIN_LOC chưa được gắn BusinessLocation.');
  }
  return businessLocationId;
}

function makeInternalEmail(role: string) {
  return `${role.toLowerCase()}.${randomUUID()}@internal.local`;
}

function normalizeOptionalEmail(email: string | null | undefined, role: string) {
  return email?.trim() || makeInternalEmail(role);
}

async function loadSerializedUser(id: string) {
  const user = await userRepository.findUser(id);
  return user ? serializeUser(user) : null;
}

export async function listLocationStaff(user: AuthUser | undefined) {
  const businessLocationId = requireLocationAdminScope(user);

  const users = await userRepository.listLocationStaff(businessLocationId);
  return users.map(serializeUser);
}

export async function createLocationStaff(body: LocationStaffCreatePayload, user: AuthUser | undefined) {
  const businessLocationId = requireLocationAdminScope(user);

  const email = normalizeOptionalEmail(body.email, body.role);
  const exists = await userRepository.findUserByEmail(email);
  if (exists) throw domainError.conflict('Email đã được sử dụng', 'EmailConflict');

  const assignment = await resolveUnitAssignment({
    role: body.role,
    unit: body.unit ?? null,
    unitConfigIds: body.unitConfigIds,
    businessLocationId,
  });

  const passwordHash = await bcrypt.hash(body.password, 10);
  const created = await userRepository.createUser({
    name: body.name,
    email,
    passwordHash,
    role: body.role,
    unit: assignment.unit,
    department: body.department ?? null,
    businessLocationId,
  });
  await replaceUserUnitPermissions(created.id, assignment.unitConfigIds);
  await refreshAuthUserCache(created.id);
  const createdUser = await userRepository.findUser(created.id);
  const serialized = serializeUser(createdUser!);
  await recordAuditLog({
    ...userActor(user),
    action: 'user.create',
    targetType: 'User',
    targetId: serialized.id,
    businessLocationId,
    after: auditUserSnapshot(serialized),
  });
  return serialized;
}

export async function updateLocationStaff(id: string, body: LocationStaffUpdatePayload, user: AuthUser | undefined) {
  const businessLocationId = requireLocationAdminScope(user);

  const existing = await userRepository.findScopedStaff(id, businessLocationId);
  if (!existing) throw domainError.notFound('Không tìm thấy nhân viên trong khu vực này');

  if (body.email !== undefined && body.email) {
    const emailOwner = await userRepository.findEmailOwner(body.email, id);
    if (emailOwner) throw domainError.conflict('Email đã được sử dụng', 'EmailConflict');
  }

  const nextRole = body.role ?? existing.role;
  const nextUnit = body.unit !== undefined ? body.unit : existing.unit;
  const assignment = await resolveUnitAssignment({
    role: nextRole,
    unit: nextUnit ?? null,
    unitConfigIds: body.unitConfigIds,
    existingUnitConfigIds: permissionIdsFromUser(existing),
    businessLocationId,
  });
  const email = body.email !== undefined ? normalizeOptionalEmail(body.email, nextRole) : undefined;
  const updated = await userRepository.updateUser(id, {
    ...body,
    email,
    unit: assignment.unit,
    businessLocationId,
  });
  await replaceUserUnitPermissions(updated.id, assignment.unitConfigIds);
  await refreshAuthUserCache(updated.id);
  if (body.isActive === false) await revokeUserSessions(updated.id);

  const nextUser = await userRepository.findUser(updated.id);
  const before = serializeUser(existing);
  const after = serializeUser(nextUser!);
  await recordAuditLog({
    ...userActor(user),
    action: 'user.update',
    targetType: 'User',
    targetId: after.id,
    businessLocationId,
    before: auditUserSnapshot(before),
    after: auditUserSnapshot(after),
  });
  return after;
}

export async function resetLocationStaffPassword(id: string, password: string, user: AuthUser | undefined) {
  const businessLocationId = requireLocationAdminScope(user);

  const existing = await userRepository.findScopedStaff(id, businessLocationId);
  if (!existing) throw domainError.notFound('Không tìm thấy nhân viên trong khu vực này');

  const passwordHash = await bcrypt.hash(password, 10);
  await userRepository.updatePassword(id, passwordHash);
  await refreshAuthUserCache(id);
  await recordAuditLog({
    ...userActor(user),
    action: 'user.reset_password',
    targetType: 'User',
    targetId: id,
    businessLocationId,
    after: { passwordReset: true },
  });
  return { ok: true };
}

export async function deleteLocationStaff(id: string, user: AuthUser | undefined) {
  const businessLocationId = requireLocationAdminScope(user);

  const existing = await userRepository.findScopedStaff(id, businessLocationId);
  if (!existing) throw domainError.notFound('Không tìm thấy nhân viên trong khu vực này');

  const hasLogs = await userRepository.countHistoryByActor(id);
  if (hasLogs > 0) {
    const updated = await userRepository.updateUser(id, { isActive: false });
    await invalidateAuthUserCache(id);
    await invalidateUserUnitPermissionCache(id);
    await revokeUserSessions(id);
    await recordAuditLog({
      ...userActor(user),
      action: 'user.deactivate',
      targetType: 'User',
      targetId: id,
      businessLocationId,
      before: { name: existing.name, email: existing.email, role: existing.role, isActive: existing.isActive },
      after: { name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive },
    });
    return { deactivated: true, user: serializeUser(updated) };
  }

  await userRepository.deleteUser(id);
  await invalidateAuthUserCache(id);
  await invalidateUserUnitPermissionCache(id);
  await revokeUserSessions(id);
  await recordAuditLog({
    ...userActor(user),
    action: 'user.delete',
    targetType: 'User',
    targetId: id,
    businessLocationId,
    before: { name: existing.name, email: existing.email, role: existing.role },
  });
  return { deleted: true };
}

export async function listUsers() {
  const users = await userRepository.listUsers();
  return users.map(serializeUser);
}

export async function createUser(body: CreateUserPayload, user: AuthUser | undefined) {
  const exists = await userRepository.findUserByEmail(body.email);
  if (exists) throw domainError.conflict('Email đã được sử dụng', 'EmailConflict');

  if (body.role === 'SUPERADMIN') await assertSingleSuperadmin();
  const businessLocationId = await assertBusinessLocationScope(body.role, body.businessLocationId ?? null);
  const assignment = await resolveUnitAssignment({
    role: body.role,
    unit: body.unit ?? null,
    unitConfigIds: body.unitConfigIds,
    businessLocationId,
  });

  const passwordHash = await bcrypt.hash(body.password, 10);
  const created = await userRepository.createUser({
    name: body.name,
    email: body.email,
    passwordHash,
    role: body.role,
    unit: assignment.unit,
    department: body.department ?? null,
    businessLocationId,
  });
  await replaceUserUnitPermissions(created.id, assignment.unitConfigIds);
  await refreshAuthUserCache(created.id);
  const createdUser = await loadSerializedUser(created.id);
  await recordAuditLog({
    ...userActor(user),
    action: 'user.create',
    targetType: 'User',
    targetId: createdUser!.id,
    businessLocationId,
    after: auditUserSnapshot(createdUser!),
  });
  return createdUser;
}

export async function updateUser(id: string, body: UpdateUserPayload, requester: AuthUser | undefined) {
  const requesterId = requester?.id;
  const existing = await userRepository.findUser(id);
  if (!existing) throw domainError.notFound('Không tìm thấy tài khoản');

  if (body.isActive === false && id === requesterId) {
    throw domainError.badRequest('Không thể vô hiệu hóa tài khoản của chính mình');
  }
  if (body.role && body.role !== existing.role && id === requesterId) {
    throw domainError.badRequest('Không thể thay đổi quyền của tài khoản đang đăng nhập');
  }

  const nextRole = body.role ?? existing.role;
  const nextBusinessLocationId = body.businessLocationId !== undefined
    ? body.businessLocationId
    : existing.businessLocationId;
  if (nextRole === 'SUPERADMIN') await assertSingleSuperadmin(id);
  const businessLocationId = await assertBusinessLocationScope(nextRole, nextBusinessLocationId ?? null);
  const nextUnit = body.unit !== undefined ? body.unit : existing.unit;
  const assignment = await resolveUnitAssignment({
    role: nextRole,
    unit: nextUnit ?? null,
    unitConfigIds: body.unitConfigIds,
    existingUnitConfigIds: permissionIdsFromUser(existing),
    businessLocationId,
  });

  const updated = await userRepository.updateUser(id, {
    ...body,
    unit: assignment.unit,
    businessLocationId,
  });
  await replaceUserUnitPermissions(updated.id, assignment.unitConfigIds);
  await refreshAuthUserCache(updated.id);
  if (body.isActive === false) await revokeUserSessions(updated.id);

  const nextUser = await userRepository.findUser(updated.id);
  const before = serializeUser(existing);
  const after = serializeUser(nextUser!);
  await recordAuditLog({
    ...userActor(requester),
    action: 'user.update',
    targetType: 'User',
    targetId: after.id,
    businessLocationId,
    before: auditUserSnapshot(before),
    after: auditUserSnapshot(after),
  });
  return after;
}

export async function resetUserPassword(id: string, password: string, user: AuthUser | undefined) {
  const passwordHash = await bcrypt.hash(password, 10);
  await userRepository.updatePassword(id, passwordHash);
  await refreshAuthUserCache(id);
  await recordAuditLog({
    ...userActor(user),
    action: 'user.reset_password',
    targetType: 'User',
    targetId: id,
    after: { passwordReset: true },
  });
  return { ok: true };
}

export async function deleteUser(id: string, user: AuthUser | undefined) {
  if (id === user?.id) {
    throw domainError.badRequest('Không thể xóa tài khoản đang đăng nhập');
  }

  const target = await userRepository.findUserRole(id);
  if (!target) throw domainError.notFound('Không tìm thấy tài khoản');
  if (target.role === 'SUPERADMIN') {
    throw domainError.badRequest('Không thể xóa tài khoản SUPERADMIN duy nhất');
  }

  const hasLogs = await userRepository.countHistoryByActor(id);
  if (hasLogs > 0) {
    const updated = await userRepository.updateUser(id, { isActive: false });
    await invalidateAuthUserCache(id);
    await invalidateUserUnitPermissionCache(id);
    await revokeUserSessions(id);
    await recordAuditLog({
      ...userActor(user),
      action: 'user.deactivate',
      targetType: 'User',
      targetId: id,
      after: { name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive },
    });
    return { deactivated: true, user: serializeUser(updated) };
  }

  const deletedUser = await userRepository.findUser(id);
  await userRepository.deleteUser(id);
  await invalidateAuthUserCache(id);
  await invalidateUserUnitPermissionCache(id);
  await revokeUserSessions(id);
  await recordAuditLog({
    ...userActor(user),
    action: 'user.delete',
    targetType: 'User',
    targetId: id,
    before: deletedUser ? auditUserSnapshot(serializeUser(deletedUser)) : undefined,
  });
  return { deleted: true };
}
