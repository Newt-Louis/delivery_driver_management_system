import { Request, Response } from 'express';
import { ReceivingUnit } from '@prisma/client';
import { prisma } from '../lib/prisma';

type PermissionUnit = {
  id: string;
  unit: ReceivingUnit;
  displayName: string;
  icon: string | null;
  businessLocationId: string;
};

type PermissionCacheEntry = {
  expiresAt: number;
  units: PermissionUnit[];
};

const CACHE_TTL_MS = 60_000;
const unitPermissionCache = new Map<string, PermissionCacheEntry>();

export function roleRequiresUnitPermission(role: string | null | undefined): boolean {
  return role === 'CHECKIN' || role === 'RECEIVING';
}

export function invalidateUserUnitPermissionCache(userId: string): void {
  unitPermissionCache.delete(userId);
}

export async function getUserUnitPermissions(userId: string): Promise<PermissionUnit[]> {
  const cached = unitPermissionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.units;

  const rows = await prisma.userUnitPermission.findMany({
    where: { userId },
    select: {
      unitConfig: {
        select: {
          id: true,
          unit: true,
          displayName: true,
          icon: true,
          businessLocationId: true,
        },
      },
    },
    orderBy: { unitConfig: { unit: 'asc' } },
  });

  const units = rows.map((row) => row.unitConfig);
  unitPermissionCache.set(userId, { units, expiresAt: Date.now() + CACHE_TTL_MS });
  return units;
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
  invalidateUserUnitPermissionCache(userId);
}

export async function assertUnitConfigsInLocation(unitConfigIds: string[], businessLocationId: string): Promise<PermissionUnit[]> {
  const uniqueIds = [...new Set(unitConfigIds)];
  if (uniqueIds.length === 0) return [];

  const unitConfigs = await prisma.unitConfig.findMany({
    where: { id: { in: uniqueIds }, businessLocationId },
    select: { id: true, unit: true, displayName: true, icon: true, businessLocationId: true },
    orderBy: { unit: 'asc' },
  });

  if (unitConfigs.length !== uniqueIds.length) {
    throw Object.assign(new Error('Danh sách đơn vị phân quyền không thuộc khu vực của tài khoản.'), { statusCode: 400 });
  }

  return unitConfigs;
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
        unit: args.unit as ReceivingUnit,
      },
    },
    select: { id: true, unit: true, displayName: true, icon: true, businessLocationId: true },
  });
  return unitConfig;
}

export async function enforceDeliveryUnitPermission(
  req: Request,
  res: Response,
  delivery: { receivingUnit: ReceivingUnit },
  operation: 'checkin' | 'receiving',
): Promise<boolean> {
  return enforceUserUnitPermissionForUnit(req, res, delivery.receivingUnit, operation);
}

export async function enforceUserUnitPermissionForUnit(
  req: Request,
  res: Response,
  receivingUnit: ReceivingUnit,
  operation: 'checkin' | 'receiving',
): Promise<boolean> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  if (operation === 'checkin' && user.role !== 'CHECKIN') return true;
  if (operation === 'receiving' && user.role !== 'RECEIVING') return true;

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
