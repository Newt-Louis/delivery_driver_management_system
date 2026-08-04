import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type {
  DailyTrendRow,
  HourlyHeatmapRow,
  PeakHourRow,
  QueueBacklogRow,
  ReportRange,
  ReportScope,
  SlotPerformanceRow,
  SlotRecommendationRow,
} from './reportTypes';

function effectiveUnits(scope: ReportScope) {
  if (scope.unitFilter) return [scope.unitFilter];
  if (scope.businessLocationId) return scope.allowedUnits ?? [];
  return undefined;
}

function effectiveUnitConfigIds(scope: ReportScope) {
  if (scope.unitConfigIds) return scope.unitConfigIds;
  if (scope.businessLocationId) return scope.allowedUnitConfigIds ?? [];
  return undefined;
}

function activeDeliveryUnitWhere(scope: ReportScope): Prisma.DeliveryRegistrationWhereInput {
  const unitConfigIds = effectiveUnitConfigIds(scope);
  if (unitConfigIds) return { unitConfigId: { in: unitConfigIds } };

  const units = effectiveUnits(scope);
  if (!units) return {};
  return { receivingUnit: { in: units } };
}

function activeDeliveryUnitClause(scope: ReportScope): Prisma.Sql {
  const unitConfigIds = effectiveUnitConfigIds(scope);
  if (unitConfigIds) {
    if (unitConfigIds.length === 0) return Prisma.sql`AND false`;
    if (unitConfigIds.length === 1) return Prisma.sql`AND unit_config_id = ${unitConfigIds[0]}`;
    return Prisma.sql`AND unit_config_id IN (${Prisma.join(unitConfigIds)})`;
  }

  const units = effectiveUnits(scope);
  if (!units) return Prisma.empty;
  if (units.length === 0) return Prisma.sql`AND false`;
  if (units.length === 1) return Prisma.sql`AND receiving_unit = ${units[0]}`;
  return Prisma.sql`AND receiving_unit::text IN (${Prisma.join(units)})`;
}

function slotScopeClause(scope: ReportScope): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];
  if (scope.businessLocationId) {
    clauses.push(Prisma.sql`uc.business_location_id = ${scope.businessLocationId}`);
  }

  const unitConfigIds = effectiveUnitConfigIds(scope);
  if (unitConfigIds) {
    if (unitConfigIds.length === 0) clauses.push(Prisma.sql`false`);
    else if (unitConfigIds.length === 1) clauses.push(Prisma.sql`uc.id = ${unitConfigIds[0]}`);
    else clauses.push(Prisma.sql`uc.id IN (${Prisma.join(unitConfigIds)})`);
  }

  const units = effectiveUnits(scope);
  if (units && !unitConfigIds) {
    if (units.length === 0) clauses.push(Prisma.sql`false`);
    else if (units.length === 1) clauses.push(Prisma.sql`uc.unit = ${units[0]}`);
    else clauses.push(Prisma.sql`uc.unit::text IN (${Prisma.join(units)})`);
  }

  if (clauses.length === 0) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.join(clauses, ' AND ')}`;
}

export async function countActiveDeliveries(range: ReportRange, scope: ReportScope) {
  return prisma.deliveryRegistration.count({
    where: { createdAt: range, ...activeDeliveryUnitWhere(scope) },
  });
}

export async function groupActiveDeliveriesByStatus(range: ReportRange, scope: ReportScope) {
  return prisma.deliveryRegistration.groupBy({
    by: ['status'],
    where: { createdAt: range, ...activeDeliveryUnitWhere(scope) },
    _count: { id: true },
  });
}

export async function averageActiveWaitMinutes(range: ReportRange, scope: ReportScope) {
  const unitClause = activeDeliveryUnitClause(scope);
  return prisma.$queryRaw<[{ avg: number | null }]>(Prisma.sql`
    SELECT AVG(EXTRACT(EPOCH FROM (called_time - checkin_time)) / 60)::float AS avg
    FROM delivery_registrations
    WHERE checkin_time IS NOT NULL AND called_time IS NOT NULL
      AND created_at >= ${range.gte} AND created_at <= ${range.lte}
      ${unitClause}
  `);
}

export async function averageActiveReceivingMinutes(range: ReportRange, scope: ReportScope) {
  const unitClause = activeDeliveryUnitClause(scope);
  return prisma.$queryRaw<[{ avg: number | null }]>(Prisma.sql`
    SELECT AVG(EXTRACT(EPOCH FROM (completed_time - receiving_start_time)) / 60)::float AS avg
    FROM delivery_registrations
    WHERE receiving_start_time IS NOT NULL AND completed_time IS NOT NULL
      AND created_at >= ${range.gte} AND created_at <= ${range.lte}
      ${unitClause}
  `);
}

export async function countActiveCheckinsWithRequestedTime(range: ReportRange, scope: ReportScope) {
  return prisma.deliveryRegistration.count({
    where: {
      createdAt: range,
      ...activeDeliveryUnitWhere(scope),
      checkinTime: { not: null },
      requestedTime: { not: null },
    },
  });
}

export async function groupActiveBreakdown(range: ReportRange, scope: ReportScope) {
  const where = { createdAt: range, ...activeDeliveryUnitWhere(scope) };
  return Promise.all([
    prisma.deliveryRegistration.groupBy({
      by: ['goodsType'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.deliveryRegistration.groupBy({
      by: ['vehicleType'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.deliveryRegistration.groupBy({
      by: ['receivingUnit'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
  ]);
}

export async function listDailyTrendRows(range: ReportRange, scope: ReportScope) {
  const unitClause = activeDeliveryUnitClause(scope);
  return prisma.$queryRaw<DailyTrendRow[]>(Prisma.sql`
    SELECT
      DATE_TRUNC('day', created_at) AS day,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE status = 'COMPLETED')::bigint AS completed
    FROM delivery_registrations
    WHERE created_at >= ${range.gte} AND created_at <= ${range.lte} ${unitClause}
    GROUP BY day
    ORDER BY day ASC
  `);
}

export async function listHourlyHeatmapRows(range: ReportRange, scope: ReportScope) {
  const unitClause = activeDeliveryUnitClause(scope);
  return prisma.$queryRaw<HourlyHeatmapRow[]>(Prisma.sql`
    SELECT
      EXTRACT(HOUR FROM checkin_time)::int AS hour,
      EXTRACT(DOW  FROM checkin_time)::int AS dow,
      COUNT(*)::bigint AS cnt
    FROM delivery_registrations
    WHERE checkin_time IS NOT NULL
      AND created_at >= ${range.gte} AND created_at <= ${range.lte} ${unitClause}
    GROUP BY hour, dow
    ORDER BY dow, hour
  `);
}

export async function listSlotPerformanceRows(range: ReportRange, scope: ReportScope) {
  const scopeClause = slotScopeClause(scope);
  return prisma.$queryRaw<SlotPerformanceRow[]>(Prisma.sql`
    SELECT
      s.id                                                                             AS "slotId",
      s.code                                                                           AS "slotCode",
      s.name                                                                           AS "slotName",
      s.vehicle_type::text                                                             AS "vehicleType",
      s.assigned_unit::text                                                            AS "assignedUnit",
      COUNT(d.id)::bigint                                                              AS "totalDeliveries",
      COUNT(d.id) FILTER (WHERE d.status = 'COMPLETED')::bigint                       AS "completedDeliveries",
      AVG(EXTRACT(EPOCH FROM (d.completed_time - d.receiving_start_time)) / 60)::float AS "avgReceivingMinutes",
      MAX(EXTRACT(EPOCH FROM (d.completed_time - d.receiving_start_time)) / 60)::float AS "maxReceivingMinutes",
      MIN(EXTRACT(EPOCH FROM (d.completed_time - d.receiving_start_time)) / 60)::float AS "minReceivingMinutes",
      SUM(EXTRACT(EPOCH FROM (d.completed_time - d.receiving_start_time)) / 60)::float AS "totalOccupiedMinutes"
    FROM slots s
    JOIN zones z ON z.id = s.zone_id
    JOIN unit_configs uc ON uc.id = z.unit_config_id
    LEFT JOIN delivery_registrations d
      ON d.assigned_slot_id = s.id
      AND d.created_at >= ${range.gte} AND d.created_at <= ${range.lte}
    WHERE s.is_active = true ${scopeClause}
    GROUP BY s.id, s.code, s.name, s.vehicle_type, s.assigned_unit
    ORDER BY s.assigned_unit, s.vehicle_type, s.code
  `);
}

export async function listSlotRecommendationRows(range: ReportRange, scope: ReportScope) {
  const scopeClause = slotScopeClause(scope);
  return prisma.$queryRaw<SlotRecommendationRow[]>(Prisma.sql`
    SELECT
      s.id AS "slotId",
      s.code AS "slotCode",
      s.vehicle_type::text AS "vehicleType",
      s.assigned_unit::text AS "assignedUnit",
      COUNT(d.id)::bigint AS "totalDeliveries",
      SUM(EXTRACT(EPOCH FROM (d.completed_time - d.receiving_start_time)) / 60)::float AS "totalOccupiedMinutes"
    FROM slots s
    JOIN zones z ON z.id = s.zone_id
    JOIN unit_configs uc ON uc.id = z.unit_config_id
    LEFT JOIN delivery_registrations d
      ON d.assigned_slot_id = s.id AND d.created_at >= ${range.gte} AND d.created_at <= ${range.lte}
    WHERE s.is_active = true ${scopeClause}
    GROUP BY s.id, s.code, s.vehicle_type, s.assigned_unit
  `);
}

export async function listQueueBacklogRows(scope: ReportScope) {
  const unitClause = activeDeliveryUnitClause(scope);
  return prisma.$queryRaw<QueueBacklogRow[]>(Prisma.sql`
    SELECT receiving_unit::text AS unit, vehicle_type::text AS "vehicleType", COUNT(*)::bigint AS cnt
    FROM delivery_registrations
    WHERE status IN ('WAITING','CALLED','REGISTERED') ${unitClause}
    GROUP BY receiving_unit, vehicle_type
  `);
}

export async function listPeakHourRows(range: ReportRange, scope: ReportScope) {
  const unitClause = activeDeliveryUnitClause(scope);
  return prisma.$queryRaw<PeakHourRow[]>(Prisma.sql`
    SELECT
      receiving_unit::text AS unit,
      vehicle_type::text AS "vehicleType",
      EXTRACT(HOUR FROM checkin_time)::int AS "peakHour",
      COUNT(*)::bigint AS "peakCount"
    FROM delivery_registrations
    WHERE checkin_time IS NOT NULL AND created_at >= ${range.gte} AND created_at <= ${range.lte} ${unitClause}
    GROUP BY receiving_unit, vehicle_type, "peakHour"
    ORDER BY "peakCount" DESC
  `);
}
