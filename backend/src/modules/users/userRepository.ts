import { prisma } from '../../lib/prisma';
import type { CreateUserPayload, UpdateUserPayload } from './userFormRequest';
import { LOCATION_STAFF_ROLES } from './userFormRequest';

export const USER_SAFE_SELECT = {
  id: true, name: true, email: true,
  role: true, unit: true, department: true,
  businessLocationId: true,
  isActive: true, createdAt: true,
  unitPermissions: {
    select: {
      unitConfig: {
        select: { id: true, unit: true, displayName: true, icon: true, businessLocationId: true },
      },
    },
  },
} as const;

export function listLocationStaff(businessLocationId: string) {
  return prisma.user.findMany({
    where: {
      businessLocationId,
      role: { in: [...LOCATION_STAFF_ROLES] },
    },
    select: USER_SAFE_SELECT,
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { unit: 'asc' }, { name: 'asc' }],
  });
}

export function listUsers() {
  return prisma.user.findMany({
    select: USER_SAFE_SELECT,
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
  });
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findEmailOwner(email: string, excludeUserId: string) {
  return prisma.user.findFirst({
    where: { email, id: { not: excludeUserId } },
    select: { id: true },
  });
}

export function findBusinessLocation(id: string) {
  return prisma.businessLocation.findUnique({
    where: { id },
    select: { id: true },
  });
}

export function findUnitConfigByLocationAndUnit(businessLocationId: string, unit: string) {
  return prisma.unitConfig.findUnique({
    where: {
      businessLocationId_unit: {
        businessLocationId,
        unit: unit as never,
      },
    },
    select: { id: true },
  });
}

export function findOtherSuperadmin(targetUserId?: string) {
  return prisma.user.findFirst({
    where: {
      role: 'SUPERADMIN',
      ...(targetUserId ? { id: { not: targetUserId } } : {}),
    },
    select: { id: true },
  });
}

export function findScopedStaff(id: string, businessLocationId: string) {
  return prisma.user.findFirst({
    where: {
      id,
      businessLocationId,
      role: { in: [...LOCATION_STAFF_ROLES] },
    },
    select: USER_SAFE_SELECT,
  });
}

export function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  unit: string | null;
  department: string | null;
  businessLocationId: string | null;
}) {
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role as never,
      unit: data.unit as never,
      department: data.department,
      businessLocationId: data.businessLocationId,
    },
    select: USER_SAFE_SELECT,
  });
}

export function findUser(id: string) {
  return prisma.user.findUnique({ where: { id }, select: USER_SAFE_SELECT });
}

export function findUserRole(id: string) {
  return prisma.user.findUnique({ where: { id }, select: { role: true } });
}

export function updateUser(id: string, data: Partial<UpdateUserPayload> & {
  email?: string;
  unit?: string | null;
  businessLocationId?: string | null;
}) {
  return prisma.user.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.role !== undefined && { role: data.role as never }),
      ...(data.unit !== undefined && { unit: data.unit as never }),
      ...(data.department !== undefined && { department: data.department ?? null }),
      ...(data.businessLocationId !== undefined && { businessLocationId: data.businessLocationId }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    select: USER_SAFE_SELECT,
  });
}

export function updatePassword(id: string, passwordHash: string) {
  return prisma.user.update({ where: { id }, data: { passwordHash } });
}

export function countHistoryByActor(id: string) {
  return prisma.deliveryHistoryEvent.count({ where: { actorId: id } });
}

export function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}
