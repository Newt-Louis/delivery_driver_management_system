import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { LiveReceivingTimeStat } from './analyticsTypes';

const UNIT_CONFIG_SELECT = {
  id: true,
  unit: true,
  displayName: true,
  shortName: true,
  icon: true,
  logoUrl: true,
  primaryColor: true,
  businessLocationId: true,
} as const;

function unitConfigClause(unitConfigIds?: string[]): Prisma.Sql {
  if (!unitConfigIds) return Prisma.empty;
  if (unitConfigIds.length === 0) return Prisma.sql`AND false`;
  if (unitConfigIds.length === 1) return Prisma.sql`AND unit_config_id = ${unitConfigIds[0]}`;
  return Prisma.sql`AND unit_config_id IN (${Prisma.join(unitConfigIds)})`;
}

export async function listReceivingTimeConfigs(unitConfigIds?: string[]) {
  if (unitConfigIds?.length === 0) return [];
  return prisma.receivingTimeConfig.findMany({
    where: unitConfigIds ? { unitConfigId: { in: unitConfigIds } } : undefined,
    include: { unitConfig: { select: UNIT_CONFIG_SELECT } },
    orderBy: [{ unit: 'asc' }, { vehicleType: 'asc' }, { goodsType: 'asc' }],
  });
}

export async function listLiveReceivingTimeStats(unitConfigIds?: string[]) {
  if (unitConfigIds?.length === 0) return [];
  const scopeClause = unitConfigClause(unitConfigIds);
  return prisma.$queryRaw<LiveReceivingTimeStat[]>(Prisma.sql`
    SELECT
      unit_config_id      AS "unitConfigId",
      receiving_unit      AS unit,
      vehicle_type        AS "vehicleType",
      goods_type          AS "goodsType",
      AVG(EXTRACT(EPOCH FROM (completed_time - receiving_start_time)) / 60)::float AS "avgMinutes",
      COUNT(*)::bigint AS "sampleCount"
    FROM delivery_registrations
    WHERE status = 'COMPLETED'
      AND receiving_start_time IS NOT NULL
      AND completed_time IS NOT NULL
      AND completed_time > receiving_start_time
      ${scopeClause}
    GROUP BY unit_config_id, receiving_unit, vehicle_type, goods_type
  `);
}

export async function countCompletedReceivingSamples(unitConfigIds?: string[]) {
  if (unitConfigIds?.length === 0) return 0;
  return prisma.deliveryRegistration.count({
    where: {
      status: 'COMPLETED',
      receivingStartTime: { not: null },
      completedTime: { not: null },
      ...(unitConfigIds ? { unitConfigId: { in: unitConfigIds } } : {}),
    },
  });
}

export async function updateRecommendedReceivingTime(stat: LiveReceivingTimeStat) {
  return prisma.receivingTimeConfig.updateMany({
    where: {
      ...(stat.unitConfigId ? { unitConfigId: stat.unitConfigId } : { unit: stat.unit as never }),
      vehicleType: stat.vehicleType as never,
      goodsType: stat.goodsType as never,
    },
    data: {
      recommendedMinutes: Math.round(stat.avgMinutes * 10) / 10,
      sampleCount: Number(stat.sampleCount),
      lastAnalyzedAt: new Date(),
    },
  });
}

export async function getReceivingTimeConfig(id: string, unitConfigIds?: string[]) {
  if (unitConfigIds?.length === 0) return null;
  return prisma.receivingTimeConfig.findFirst({
    where: {
      id,
      ...(unitConfigIds ? { unitConfigId: { in: unitConfigIds } } : {}),
    },
  });
}

export async function acceptRecommendedReceivingTime(id: string, configuredMinutes: number) {
  return prisma.receivingTimeConfig.update({
    where: { id },
    data: { configuredMinutes },
  });
}

export async function listPendingReceivingTimeConfigs(unitConfigIds?: string[]) {
  if (unitConfigIds?.length === 0) return [];
  return prisma.receivingTimeConfig.findMany({
    where: {
      recommendedMinutes: { not: null },
      ...(unitConfigIds ? { unitConfigId: { in: unitConfigIds } } : {}),
    },
  });
}
