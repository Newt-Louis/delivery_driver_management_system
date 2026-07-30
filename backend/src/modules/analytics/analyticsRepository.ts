import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { LiveReceivingTimeStat } from './analyticsTypes';

export async function listReceivingTimeConfigs() {
  return prisma.receivingTimeConfig.findMany({
    orderBy: [{ unit: 'asc' }, { vehicleType: 'asc' }, { goodsType: 'asc' }],
  });
}

export async function listLiveReceivingTimeStats() {
  return prisma.$queryRaw<LiveReceivingTimeStat[]>(Prisma.sql`
    SELECT
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
    GROUP BY receiving_unit, vehicle_type, goods_type
  `);
}

export async function countCompletedReceivingSamples() {
  return prisma.deliveryRegistration.count({
    where: {
      status: 'COMPLETED',
      receivingStartTime: { not: null },
      completedTime: { not: null },
    },
  });
}

export async function updateRecommendedReceivingTime(stat: LiveReceivingTimeStat) {
  return prisma.receivingTimeConfig.updateMany({
    where: {
      unit: stat.unit as never,
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

export async function getReceivingTimeConfig(id: string) {
  return prisma.receivingTimeConfig.findUnique({ where: { id } });
}

export async function acceptRecommendedReceivingTime(id: string, configuredMinutes: number) {
  return prisma.receivingTimeConfig.update({
    where: { id },
    data: { configuredMinutes },
  });
}

export async function listPendingReceivingTimeConfigs() {
  return prisma.receivingTimeConfig.findMany({
    where: { recommendedMinutes: { not: null } },
  });
}
