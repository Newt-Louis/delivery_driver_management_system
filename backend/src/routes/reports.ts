import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'));

function dateRange(from?: string, to?: string) {
  const f = from ? new Date(from) : new Date(Date.now() - 30 * 86400_000);
  const t = to ? new Date(to + 'T23:59:59.999Z') : new Date();
  return { gte: f, lte: t };
}

// Unit filter fragment for raw SQL — safe via Prisma.sql tagged template
function unitClause(unit?: string) {
  if (!unit) return Prisma.empty;
  const u = unit as Prisma.EnumReceivingUnitFilter;
  return Prisma.sql`AND receiving_unit = ${u}::"ReceivingUnit"`;
}
function slotUnitClause(unit?: string) {
  if (!unit) return Prisma.empty;
  const u = unit as Prisma.EnumReceivingUnitFilter;
  return Prisma.sql`AND s.assigned_unit = ${u}::"ReceivingUnit"`;
}

// ─── Overview ─────────────────────────────────────────────────────────────────
router.get('/overview', asyncHandler(async (req: Request, res: Response) => {
  const { from, to, unit } = req.query as Record<string, string>;
  const range = dateRange(from, to);
  const unitFilter = unit ? { receivingUnit: unit as never } : {};
  const uc = unitClause(unit);

  const [total, byStatus, avgWait, avgReceiving, checkinOnTime] = await Promise.all([
    prisma.deliveryRegistration.count({ where: { createdAt: range, ...unitFilter } }),

    prisma.deliveryRegistration.groupBy({
      by: ['status'],
      where: { createdAt: range, ...unitFilter },
      _count: { id: true },
    }),

    prisma.$queryRaw<[{ avg: number | null }]>(Prisma.sql`
      SELECT AVG(EXTRACT(EPOCH FROM (called_time - checkin_time)) / 60)::float AS avg
      FROM delivery_registrations
      WHERE checkin_time IS NOT NULL AND called_time IS NOT NULL
        AND created_at >= ${range.gte} AND created_at <= ${range.lte}
        ${uc}
    `),

    prisma.$queryRaw<[{ avg: number | null }]>(Prisma.sql`
      SELECT AVG(EXTRACT(EPOCH FROM (completed_time - receiving_start_time)) / 60)::float AS avg
      FROM delivery_registrations
      WHERE receiving_start_time IS NOT NULL AND completed_time IS NOT NULL
        AND created_at >= ${range.gte} AND created_at <= ${range.lte}
        ${uc}
    `),

    prisma.deliveryRegistration.count({
      where: { createdAt: range, ...unitFilter, checkinTime: { not: null }, requestedTime: { not: null } },
    }),
  ]);

  const completed = byStatus.find((s) => s.status === 'COMPLETED')?._count.id ?? 0;
  const cancelled = byStatus.find((s) => s.status === 'CANCELLED')?._count.id ?? 0;

  res.json({
    total, completed, cancelled,
    completionRate:   total > 0 ? Math.round((completed / total) * 100) : 0,
    cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    avgWaitMinutes:       Math.round((avgWait[0]?.avg ?? 0) * 10) / 10,
    avgReceivingMinutes:  Math.round((avgReceiving[0]?.avg ?? 0) * 10) / 10,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count.id])),
    checkinOnTime,
  });
}));

// ─── Breakdown ────────────────────────────────────────────────────────────────
router.get('/breakdown', asyncHandler(async (req: Request, res: Response) => {
  const { from, to, unit } = req.query as Record<string, string>;
  const range = dateRange(from, to);
  const unitFilter = unit ? { receivingUnit: unit as never } : {};

  const [byGoods, byVehicle, byUnit] = await Promise.all([
    prisma.deliveryRegistration.groupBy({
      by: ['goodsType'], where: { createdAt: range, ...unitFilter },
      _count: { id: true }, orderBy: { _count: { id: 'desc' } },
    }),
    prisma.deliveryRegistration.groupBy({
      by: ['vehicleType'], where: { createdAt: range, ...unitFilter },
      _count: { id: true }, orderBy: { _count: { id: 'desc' } },
    }),
    prisma.deliveryRegistration.groupBy({
      by: ['receivingUnit'], where: { createdAt: range },
      _count: { id: true }, orderBy: { _count: { id: 'desc' } },
    }),
  ]);

  res.json({
    byGoods:   byGoods.map((r) => ({ key: r.goodsType,    count: r._count.id })),
    byVehicle: byVehicle.map((r) => ({ key: r.vehicleType, count: r._count.id })),
    byUnit:    byUnit.map((r) => ({ key: r.receivingUnit,  count: r._count.id })),
  });
}));

// ─── Daily trend ──────────────────────────────────────────────────────────────
router.get('/daily-trend', asyncHandler(async (req: Request, res: Response) => {
  const { from, to, unit } = req.query as Record<string, string>;
  const range = dateRange(from, to);
  const uc = unitClause(unit);

  type TrendRow = { day: Date; total: bigint; completed: bigint };
  const rows = await prisma.$queryRaw<TrendRow[]>(Prisma.sql`
    SELECT
      DATE_TRUNC('day', created_at) AS day,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE status = 'COMPLETED')::bigint AS completed
    FROM delivery_registrations
    WHERE created_at >= ${range.gte} AND created_at <= ${range.lte} ${uc}
    GROUP BY day
    ORDER BY day ASC
  `);

  res.json(rows.map((r) => ({
    day:       r.day.toISOString().slice(0, 10),
    total:     Number(r.total),
    completed: Number(r.completed),
  })));
}));

// ─── Hourly heatmap ───────────────────────────────────────────────────────────
router.get('/hourly-heatmap', asyncHandler(async (req: Request, res: Response) => {
  const { from, to, unit } = req.query as Record<string, string>;
  const range = dateRange(from, to);
  const uc = unitClause(unit);

  type HeatRow = { hour: number; dow: number; cnt: bigint };
  const rows = await prisma.$queryRaw<HeatRow[]>(Prisma.sql`
    SELECT
      EXTRACT(HOUR FROM checkin_time)::int AS hour,
      EXTRACT(DOW  FROM checkin_time)::int AS dow,
      COUNT(*)::bigint AS cnt
    FROM delivery_registrations
    WHERE checkin_time IS NOT NULL
      AND created_at >= ${range.gte} AND created_at <= ${range.lte} ${uc}
    GROUP BY hour, dow
    ORDER BY dow, hour
  `);

  res.json(rows.map((r) => ({ hour: r.hour, dow: r.dow, count: Number(r.cnt) })));
}));

// ─── Delivery history (paginated) ─────────────────────────────────────────────
router.get('/deliveries', asyncHandler(async (req: Request, res: Response) => {
  const { from, to, unit, goodsType, vehicleType, status, search, page = '1', limit = '50' } = req.query as Record<string, string>;
  const range = dateRange(from, to);
  const where = {
    createdAt: range,
    ...(unit        && { receivingUnit: unit        as never }),
    ...(goodsType   && { goodsType:   goodsType     as never }),
    ...(vehicleType && { vehicleType: vehicleType   as never }),
    ...(status      && { status:      status        as never }),
    ...(search      && {
      OR: [
        { vendorName:       { contains: search, mode: 'insensitive' as const } },
        { driverName:       { contains: search, mode: 'insensitive' as const } },
        { vehiclePlate:     { contains: search, mode: 'insensitive' as const } },
        { registrationCode: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [items, total] = await Promise.all([
    prisma.deliveryRegistration.findMany({
      where, orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit),
      select: {
        id: true, registrationCode: true, vendorName: true, driverName: true,
        vehiclePlate: true, receivingUnit: true, goodsType: true, vehicleType: true,
        status: true, checkinTime: true, calledTime: true,
        receivingStartTime: true, completedTime: true, createdAt: true,
        ticketNumber: true, assignedSlot: { select: { code: true, name: true } },
      },
    }),
    prisma.deliveryRegistration.count({ where }),
  ]);

  res.json({ items, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) });
}));

// ─── Slot performance ─────────────────────────────────────────────────────────
router.get('/slot-performance', asyncHandler(async (req: Request, res: Response) => {
  const { from, to, unit } = req.query as Record<string, string>;
  const range = dateRange(from, to);
  const suc = slotUnitClause(unit);

  type SlotRow = {
    slotId: string; slotCode: string; slotName: string;
    vehicleType: string; assignedUnit: string;
    totalDeliveries: bigint; completedDeliveries: bigint;
    avgReceivingMinutes: number | null; maxReceivingMinutes: number | null;
    minReceivingMinutes: number | null; totalOccupiedMinutes: number | null;
  };

  const rows = await prisma.$queryRaw<SlotRow[]>(Prisma.sql`
    SELECT
      s.id                                                                            AS "slotId",
      s.code                                                                          AS "slotCode",
      s.name                                                                          AS "slotName",
      s.vehicle_type::text                                                            AS "vehicleType",
      s.assigned_unit::text                                                           AS "assignedUnit",
      COUNT(d.id)::bigint                                                             AS "totalDeliveries",
      COUNT(d.id) FILTER (WHERE d.status = 'COMPLETED')::bigint                      AS "completedDeliveries",
      AVG(EXTRACT(EPOCH FROM (d.completed_time - d.receiving_start_time)) / 60)::float AS "avgReceivingMinutes",
      MAX(EXTRACT(EPOCH FROM (d.completed_time - d.receiving_start_time)) / 60)::float AS "maxReceivingMinutes",
      MIN(EXTRACT(EPOCH FROM (d.completed_time - d.receiving_start_time)) / 60)::float AS "minReceivingMinutes",
      SUM(EXTRACT(EPOCH FROM (d.completed_time - d.receiving_start_time)) / 60)::float AS "totalOccupiedMinutes"
    FROM slots s
    LEFT JOIN delivery_registrations d
      ON d.assigned_slot_id = s.id
      AND d.created_at >= ${range.gte} AND d.created_at <= ${range.lte}
    WHERE s.is_active = true ${suc}
    GROUP BY s.id, s.code, s.name, s.vehicle_type, s.assigned_unit
    ORDER BY s.assigned_unit, s.vehicle_type, s.code
  `);

  const periodMs = range.lte.getTime() - range.gte.getTime();
  const periodDays = periodMs / 86400_000;
  const availableMinutes = periodDays * 15 * 60; // 15 operating hours/day

  const data = rows.map((r) => {
    const total = Number(r.totalDeliveries);
    const completed = Number(r.completedDeliveries);
    const occupied = r.totalOccupiedMinutes ?? 0;
    const utilization = availableMinutes > 0 ? Math.min(100, Math.round((occupied / availableMinutes) * 100)) : 0;
    return {
      slotId: r.slotId, slotCode: r.slotCode, slotName: r.slotName,
      vehicleType: r.vehicleType, assignedUnit: r.assignedUnit,
      totalDeliveries: total, completedDeliveries: completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgReceivingMinutes: r.avgReceivingMinutes ? Math.round(r.avgReceivingMinutes * 10) / 10 : null,
      maxReceivingMinutes: r.maxReceivingMinutes ? Math.round(r.maxReceivingMinutes) : null,
      minReceivingMinutes: r.minReceivingMinutes ? Math.round(r.minReceivingMinutes) : null,
      totalOccupiedMinutes: Math.round(occupied), utilizationPct: utilization,
    };
  });

  res.json(data);
}));

// ─── AI slot recommendations ──────────────────────────────────────────────────
router.get('/ai-slot-recommendations', asyncHandler(async (req: Request, res: Response) => {
  const { from, to, unit } = req.query as Record<string, string>;
  const range = dateRange(from, to);
  const suc = slotUnitClause(unit);

  type SlotRow = {
    slotId: string; slotCode: string; vehicleType: string; assignedUnit: string;
    totalDeliveries: bigint; totalOccupiedMinutes: number | null;
  };
  const slots = await prisma.$queryRaw<SlotRow[]>(Prisma.sql`
    SELECT
      s.id AS "slotId", s.code AS "slotCode",
      s.vehicle_type::text AS "vehicleType", s.assigned_unit::text AS "assignedUnit",
      COUNT(d.id)::bigint AS "totalDeliveries",
      SUM(EXTRACT(EPOCH FROM (d.completed_time - d.receiving_start_time)) / 60)::float AS "totalOccupiedMinutes"
    FROM slots s
    LEFT JOIN delivery_registrations d
      ON d.assigned_slot_id = s.id AND d.created_at >= ${range.gte} AND d.created_at <= ${range.lte}
    WHERE s.is_active = true ${suc}
    GROUP BY s.id, s.code, s.vehicle_type, s.assigned_unit
  `);

  type QueueRow = { unit: string; vehicleType: string; cnt: bigint };
  const queueBacklog = await prisma.$queryRaw<QueueRow[]>(Prisma.sql`
    SELECT receiving_unit::text AS unit, vehicle_type::text AS "vehicleType", COUNT(*)::bigint AS cnt
    FROM delivery_registrations
    WHERE status IN ('WAITING','CALLED','REGISTERED')
    GROUP BY receiving_unit, vehicle_type
  `);

  type PeakRow = { unit: string; vehicleType: string; peakHour: number; peakCount: bigint };
  const peakRows = await prisma.$queryRaw<PeakRow[]>(Prisma.sql`
    SELECT
      receiving_unit::text AS unit, vehicle_type::text AS "vehicleType",
      EXTRACT(HOUR FROM checkin_time)::int AS "peakHour",
      COUNT(*)::bigint AS "peakCount"
    FROM delivery_registrations
    WHERE checkin_time IS NOT NULL AND created_at >= ${range.gte} AND created_at <= ${range.lte}
    GROUP BY receiving_unit, vehicle_type, "peakHour"
    ORDER BY "peakCount" DESC
  `);

  const periodMs = range.lte.getTime() - range.gte.getTime();
  const periodDays = Math.max(1, periodMs / 86400_000);
  const availableMinutes = periodDays * 15 * 60;

  type SlotGroup = { unit: string; vehicleType: string; count: number; totalUtil: number; avgUtil: number; avgDeliveries: number };
  const byGroup = new Map<string, SlotGroup>();
  for (const s of slots) {
    const key = `${s.assignedUnit}|${s.vehicleType}`;
    const util = availableMinutes > 0 ? Math.min(100, ((s.totalOccupiedMinutes ?? 0) / availableMinutes) * 100) : 0;
    const g = byGroup.get(key) ?? { unit: s.assignedUnit, vehicleType: s.vehicleType, count: 0, totalUtil: 0, avgUtil: 0, avgDeliveries: 0 };
    g.count += 1;
    g.totalUtil += util;
    g.avgDeliveries += Number(s.totalDeliveries);
    byGroup.set(key, g);
  }
  for (const g of byGroup.values()) {
    g.avgUtil = g.count > 0 ? g.totalUtil / g.count : 0;
    g.avgDeliveries = g.count > 0 ? g.avgDeliveries / g.count : 0;
  }

  const recommendations: {
    unit: string; vehicleType: string; currentSlots: number; avgUtilization: number;
    suggestion: 'ADD_SLOT' | 'REDUCE_SLOT' | 'OPTIMAL';
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    reason: string; action: string; backlogNow: number; peakHour: number | null;
  }[] = [];

  for (const g of byGroup.values()) {
    const backlog = Number(queueBacklog.find((q) => q.unit === g.unit && q.vehicleType === g.vehicleType)?.cnt ?? 0);
    const relevantPeak = peakRows.find((p) => p.unit === g.unit && p.vehicleType === g.vehicleType);
    const peakHour = relevantPeak ? Number(relevantPeak.peakHour) : null;
    const util = Math.round(g.avgUtil);
    const vLabel = g.vehicleType === 'TRUCK' ? 'xe tải' : g.vehicleType === 'MOTORBIKE' ? 'xe máy' : 'xe khác';
    const uLabel = ({ EMART: 'Emart', THISKYHALL: 'Thiskyhall', TENANT: 'Mall' } as Record<string, string>)[g.unit] ?? g.unit;

    if (util >= 85 || backlog >= 5) {
      recommendations.push({
        unit: g.unit, vehicleType: g.vehicleType, currentSlots: g.count, avgUtilization: util,
        suggestion: 'ADD_SLOT',
        priority: util >= 92 || backlog >= 10 ? 'HIGH' : 'MEDIUM',
        reason: `Mức sử dụng trung bình ${util}%${backlog > 0 ? ` và tồn đọng ${backlog} xe đang chờ` : ''}. Ngưỡng khuyến nghị thêm slot là 85%.`,
        action: `Thêm ít nhất 1 slot ${vLabel} cho khu ${uLabel}. Ưu tiên giờ cao điểm${peakHour != null ? ` ${peakHour}:00–${peakHour + 1}:00` : ' buổi sáng'}.`,
        backlogNow: backlog, peakHour,
      });
    } else if (util <= 25 && g.count > 1 && backlog === 0) {
      recommendations.push({
        unit: g.unit, vehicleType: g.vehicleType, currentSlots: g.count, avgUtilization: util,
        suggestion: 'REDUCE_SLOT',
        priority: util <= 15 ? 'MEDIUM' : 'LOW',
        reason: `Mức sử dụng trung bình chỉ ${util}%, thấp hơn ngưỡng hiệu quả (25%). Không có xe tồn đọng.`,
        action: `Xem xét giảm 1 slot ${vLabel} cho khu ${uLabel} hoặc chuyển sang loại xe có nhu cầu cao hơn.`,
        backlogNow: 0, peakHour,
      });
    } else {
      recommendations.push({
        unit: g.unit, vehicleType: g.vehicleType, currentSlots: g.count, avgUtilization: util,
        suggestion: 'OPTIMAL', priority: 'LOW',
        reason: `Mức sử dụng ${util}% trong vùng tối ưu (25–85%).`,
        action: 'Duy trì cấu hình hiện tại. Tiếp tục theo dõi xu hướng hàng tuần.',
        backlogNow: backlog, peakHour,
      });
    }
  }

  const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  recommendations.sort((a, b) => order[a.priority] - order[b.priority]);

  const groups = [...byGroup.values()];
  const avgOverall = groups.length > 0 ? groups.reduce((s, g) => s + g.avgUtil, 0) / groups.length : 0;
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - Math.abs(avgOverall - 65))));

  res.json({
    recommendations, healthScore,
    avgUtilization: Math.round(avgOverall),
    periodDays: Math.round(periodDays),
    analyzedAt: new Date().toISOString(),
  });
}));

export default router;
