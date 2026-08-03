import { ReceivingUnit, type ReceivingUnit as ReceivingUnitCode } from '../domain/unitCodes';
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { getRedis } from './redis';
import { AuthPermissionUnit, roleHasUnitOperationScope } from '../domain/permissions';

export type PermissionUnit = AuthPermissionUnit & {
  unit: string;
};

type CachedPermissionUnit = {
  id: string;
  unit: string;
  code: string;
  displayName: string;
  shortName: string;
  icon: string | null;
  businessLocationId: string;
  isActive: boolean;
};

function unitPermissionKey(userId: string): string {
  return `auth:user:${userId}:unit-permissions`;
}

export function roleRequiresUnitPermission(role: string | null | undefined): boolean {
  return roleHasUnitOperationScope(role);
}

function parseCachedPermissions(raw: string | null): PermissionUnit[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedPermissionUnit[];
    return Array.isArray(parsed) ? parsed.map(normalizePermissionUnit) : null;
  } catch {
    return null;
  }
}

function normalizePermissionUnit(unit: CachedPermissionUnit): PermissionUnit {
  return {
    ...unit,
    unit: unit.unit ?? unit.code,
    code: unit.code ?? unit.unit,
    shortName: unit.shortName ?? unit.displayName,
    isActive: unit.isActive ?? true,
  };
}

async function queryUserUnitPermissions(userId: string): Promise<PermissionUnit[]> {
  const rows = await prisma.userUnitPermission.findMany({
    where: { userId },
    select: {
      unitConfig: {
        select: {
          id: true,
          unit: true,
          displayName: true,
          shortName: true,
          icon: true,
          businessLocationId: true,
          isActive: true,
        },
      },
    },
    orderBy: { unitConfig: { unit: 'asc' } },
  });

  return rows.map((row) => normalizePermissionUnit({
    ...row.unitConfig,
    code: row.unitConfig.unit,
  }));
}

async function writeUserUnitPermissionCache(userId: string, units: PermissionUnit[]): Promise<void> {
  const redis = await getRedis();
  await redis.set(unitPermissionKey(userId), JSON.stringify(units));
}

export async function invalidateUserUnitPermissionCache(userId: string): Promise<void> {
  const redis = await getRedis();
  await redis.del(unitPermissionKey(userId));
}

export async function refreshUserUnitPermissionCache(userId: string): Promise<PermissionUnit[]> {
  const units = await queryUserUnitPermissions(userId);
  await writeUserUnitPermissionCache(userId, units);
  return units;
}

export async function getUserUnitPermissions(userId: string): Promise<PermissionUnit[]> {
  const redis = await getRedis();
  const cached = parseCachedPermissions(await redis.get(unitPermissionKey(userId)));
  if (cached) return cached;

  return refreshUserUnitPermissionCache(userId);
}

export async function getUserUnitPermissionsFromDb(userId: string): Promise<PermissionUnit[]> {
  return prisma.userUnitPermission.findMany({
    where: { userId },
    select: {
      unitConfig: {
        select: {
            id: true,
            unit: true,
            displayName: true,
            shortName: true,
            icon: true,
            businessLocationId: true,
            isActive: true,
          },
        },
      },
    orderBy: { unitConfig: { unit: 'asc' } },
  }).then((rows) => rows.map((row) => normalizePermissionUnit({
    ...row.unitConfig,
    code: row.unitConfig.unit,
  })));
}

export async function replaceUserUnitPermissions(userId: string, unitConfigIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(unitConfigIds)];
  await prisma.$transaction(async (tx) => {
    await tx.userUnitPermission.deleteMany({ where: { userId } });
    if (uniqueIds.length > 0) {
      await tx.userUnitPermission.createMany({
        data: uniqueIds.map((unitConfigId) => ({ userId, unitConfigId })),
        skipDuplicates: true,
      });
    }
  });
  await refreshUserUnitPermissionCache(userId);
}

export async function assertUnitConfigsInLocation(unitConfigIds: string[], businessLocationId: string): Promise<PermissionUnit[]> {
  const uniqueIds = [...new Set(unitConfigIds)];
  if (uniqueIds.length === 0) return [];

  const unitConfigs = await prisma.unitConfig.findMany({
    where: { id: { in: uniqueIds }, businessLocationId },
    select: { id: true, unit: true, displayName: true, shortName: true, icon: true, businessLocationId: true, isActive: true },
    orderBy: { unit: 'asc' },
  });

  if (unitConfigs.length !== uniqueIds.length) {
    throw Object.assign(new Error('Danh sách đơn vị phân quyền không thuộc khu vực của tài khoản.'), { statusCode: 400 });
  }

  return unitConfigs.map((unitConfig) => normalizePermissionUnit({ ...unitConfig, code: unitConfig.unit }));
}

export async function resolveLegacyUnitConfigId(args: {
  businessLocationId: string;
  unit: string | null | undefined;
}): Promise<PermissionUnit | null> {
  if (!args.unit) return null;
  const unitConfig = await prisma.unitConfig.findUnique({
    where: {
      businessLocationId_unit: {
        businessLocationId: args.businessLocationId,
        unit: args.unit as ReceivingUnitCode,
      },
    },
    select: { id: true, unit: true, displayName: true, shortName: true, icon: true, businessLocationId: true, isActive: true },
  });
  return unitConfig ? normalizePermissionUnit({ ...unitConfig, code: unitConfig.unit }) : null;
}

export async function enforceDeliveryUnitPermission(
  req: Request,
  res: Response,
  delivery: { receivingUnit: ReceivingUnitCode },
  operation: 'checkin' | 'receiving',
): Promise<boolean> {
  return enforceUserUnitPermissionForUnit(req, res, delivery.receivingUnit, operation);
}

export async function enforceUserUnitPermissionForUnit(
  req: Request,
  res: Response,
  receivingUnit: ReceivingUnitCode,
  operation: 'checkin' | 'receiving',
): Promise<boolean> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  if (!roleHasUnitOperationScope(user.role)) return true;

  if (!user.businessLocationId) {
    res.status(403).json({ error: 'Tài khoản chưa được gán khu vực hoạt động.' });
    return false;
  }

  const allowedUnits = await getUserUnitPermissions(user.id);
  const allowed = allowedUnits.some((unit) => (
    unit.businessLocationId === user.businessLocationId
    && unit.unit === receivingUnit
  ));

  if (!allowed) {
    res.status(403).json({
      error: 'Bạn không có quyền thao tác trên đơn vị này.',
      receivingUnit,
    });
    return false;
  }

  return true;
}
