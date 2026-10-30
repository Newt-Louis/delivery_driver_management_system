import { Router, Request, Response } from 'express';
import { DeliveryStatus, SchedulerJobTrigger, SlotStatus, GoodsType, VehicleType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole, enforceScope } from '../middleware/auth';
import { getCallHistoryCounts } from '../modules/history/historyRepository';
import { closeDailyDeliveries } from '../modules/scheduler/deliveryJobs';
import { roleHasUnitOperationScope } from '../domain/permissions';

const router = Router();

type DashboardUnitConfig = {
  id: string;
  unit: string;
  displayName: string;
  shortName: string;
  icon: string | null;
  logoUrl: string | null;
  primaryColor: string;
  businessLocationId: string;
};

async function resolveDashboardUnits(req: Request): Promise<DashboardUnitConfig[]> {
  const scope = req.scope!;
  const businessLocationId = scope.businessLocationId;
  if (!businessLocationId) return [];

  const allowedUnitIds = req.user && req.user.role !== 'SUPERADMIN' && roleHasUnitOperationScope(req.user.role)
    ? req.user.operationUnits
        .filter((unit) => unit.isActive && unit.businessLocationId === businessLocationId)
        .map((unit) => unit.id)
    : null;

  if (allowedUnitIds && allowedUnitIds.length === 0) return [];

  return prisma.unitConfig.findMany({
    where: {
      businessLocationId,
      isActive: true,
      ...(scope.unitConfigId ? { id: scope.unitConfigId } : {}),
      ...(allowedUnitIds ? { id: { in: allowedUnitIds } } : {}),
    },
    select: {
      id: true,
      unit: true,
      displayName: true,
      shortName: true,
      icon: true,
      logoUrl: true,
      primaryColor: true,
      businessLocationId: true,
    },
    orderBy: { unit: 'asc' },
  });
}

function scopedDeliveryWhere(
  units: DashboardUnitConfig[],
  base: Record<string, unknown>,
) {
  if (units.length === 0) return { AND: [base, { id: '__no_unit_scope__' }] };

  const scopeWhere = {
    OR: [
      { unitConfigId: { in: units.map((unit) => unit.id) } },
      {
        assignedSlot: {
          zone: {
            unitConfigId: { in: units.map((unit) => unit.id) },
          },
        },
      },
    ],
  };

  return { AND: [base, scopeWhere] };
}

function scopedSlotWhere(units: DashboardUnitConfig[], base: Record<string, unknown>) {
  if (units.length === 0) return { ...base, id: '__no_unit_scope__' };
  return {
    ...base,
    zone: {
      unitConfigId: { in: units.map((unit) => unit.id) },
    },
  };
}

async function dashboardDailyTotals(units: DashboardUnitConfig[], start: Date, end: Date) {
  if (!units.length) return { registered: 0, checkedIn: 0 };
  const ids = Prisma.join(units.map((unit) => unit.id));
  const [totals] = await prisma.$queryRaw<{ registered: bigint; checkedIn: bigint }[]>(Prisma.sql`
    WITH scoped_deliveries AS (
      SELECT d.created_at AS registered_at, d.checkin_time
      FROM delivery_registrations d
      LEFT JOIN slots s ON s.id = d.assigned_slot_id
      LEFT JOIN zones z ON z.id = s.zone_id
      WHERE (d.unit_config_id IN (${ids}) OR z.unit_config_id IN (${ids}))
        AND (d.created_at >= ${start} AND d.created_at < ${end}
          OR d.checkin_time >= ${start} AND d.checkin_time < ${end})
      UNION ALL
      SELECT h.registered_at, h.checkin_time
      FROM delivery_history h
      WHERE h.unit_config_id IN (${ids}) AND h.business_location_id = ${units[0].businessLocationId}
        AND (h.registered_at >= ${start} AND h.registered_at < ${end}
          OR h.checkin_time >= ${start} AND h.checkin_time < ${end})
        AND NOT EXISTS (SELECT 1 FROM delivery_registrations d WHERE d.id = h.original_delivery_id)
    )
    SELECT COUNT(*) FILTER (WHERE registered_at >= ${start} AND registered_at < ${end}) AS registered,
      COUNT(*) FILTER (WHERE checkin_time >= ${start} AND checkin_time < ${end}) AS "checkedIn"
    FROM scoped_deliveries
  `);
  return { registered: Number(totals.registered), checkedIn: Number(totals.checkedIn) };
}

// GET /api/dashboard/summary
router.get('/summary', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  const units = await resolveDashboardUnits(req);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    waitingCount, freshFoodWaiting, receivingCount,
    slotsOccupied, slotsAvailable,
    totalToday, completedToday, cancelledToday,
    noShowRisk, urgentFreshFood,
    registeredToday, expiredToday, dailyTotals,
  ] = await Promise.all([
    prisma.deliveryRegistration.count({ where: scopedDeliveryWhere(units, { status: DeliveryStatus.WAITING }) }),
    prisma.deliveryRegistration.count({ where: scopedDeliveryWhere(units, { status: DeliveryStatus.WAITING, goodsType: GoodsType.FRESH_FOOD }) }),
    prisma.deliveryRegistration.count({
      where: scopedDeliveryWhere(units, { status: { in: [DeliveryStatus.RECEIVING, DeliveryStatus.AUTO_WAREHOUSE_RECEIVING, DeliveryStatus.CALLED] } }),
    }),
    prisma.slot.count({ where: scopedSlotWhere(units, { status: SlotStatus.OCCUPIED }) }),
    prisma.slot.count({ where: scopedSlotWhere(units, { status: SlotStatus.AVAILABLE }) }),
    prisma.deliveryRegistration.count({ where: scopedDeliveryWhere(units, { createdAt: { gte: today } }) }),
    prisma.deliveryRegistration.count({ where: scopedDeliveryWhere(units, { status: DeliveryStatus.COMPLETED, completedTime: { gte: today } }) }),
    prisma.deliveryRegistration.count({ where: scopedDeliveryWhere(units, { status: DeliveryStatus.CANCELLED, updatedAt: { gte: today } }) }),
    prisma.deliveryRegistration.count({
      where: scopedDeliveryWhere(units, { status: DeliveryStatus.CALLED, calledTime: { lte: new Date(Date.now() - 15 * 60 * 1000) } }),
    }),
    prisma.deliveryRegistration.count({
      where: scopedDeliveryWhere(units, { status: DeliveryStatus.WAITING, goodsType: GoodsType.FRESH_FOOD, checkinTime: { lte: new Date(Date.now() - 25 * 60 * 1000) } }),
    }),
    prisma.deliveryRegistration.count({ where: scopedDeliveryWhere(units, { status: DeliveryStatus.REGISTERED, createdAt: { gte: today } }) }),
    prisma.deliveryRegistration.count({ where: scopedDeliveryWhere(units, { status: 'EXPIRED' as DeliveryStatus, updatedAt: { gte: today } }) }),
    dashboardDailyTotals(units, today, tomorrow),
  ]);

  res.json({
    waiting: waitingCount, freshFoodWaiting, receiving: receivingCount,
    slotsOccupied, slotsAvailable,
    // keep backward-compat keys for now so the frontend summary bar still works
    docksOccupied: slotsOccupied, docksAvailable: slotsAvailable,
    totalToday, completedToday, cancelledToday,
    noShowRisk, urgentFreshFood, registeredToday, expiredToday,
    totalRegisteredToday: dailyTotals.registered, totalCheckedInToday: dailyTotals.checkedIn,
  });
}));

// GET /api/dashboard/dispatch
router.get('/dispatch', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  const units = await resolveDashboardUnits(req);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  const [allActive, allUpcoming, allSlots] = await Promise.all([
    prisma.deliveryRegistration.findMany({
      where: scopedDeliveryWhere(units, {
        status: { in: [DeliveryStatus.WAITING, DeliveryStatus.CALLED, DeliveryStatus.RECEIVING, DeliveryStatus.AUTO_WAREHOUSE_RECEIVING] },
      }),
      include: { assignedSlot: { include: { zone: { include: { unitConfig: true } } } } },
      orderBy: [{ checkinTime: 'asc' }],
    }),
    prisma.deliveryRegistration.findMany({
      where: scopedDeliveryWhere(units, {
        status: DeliveryStatus.REGISTERED,
        OR: [
          { requestedTime: { gte: todayStart, lte: todayEnd } },
          { createdAt: { gte: todayStart }, requestedTime: null },
        ],
      }),
      orderBy: [{ requestedTime: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.slot.findMany({
      where: scopedSlotWhere(units, { isActive: true }),
      orderBy: { code: 'asc' },
    }),
  ]);

  const callCounts = await getCallHistoryCounts(allActive.map((delivery) => delivery.id));
  const activeWithCallCounts = allActive.map((delivery) => ({
    ...delivery,
    callCount: callCounts.get(delivery.id) ?? 0,
  }));

  const result: Record<string, unknown> = {};

  for (const unitConfig of units) {
    const unit = unitConfig.unit;
    const active   = activeWithCallCounts.filter((d) => d.unitConfigId === unitConfig.id);
    const upcoming = allUpcoming.filter((d) => d.unitConfigId === unitConfig.id);
    const slots    = allSlots.filter((s) => s.assignedUnit === unit);

    const availableSlots = slots.filter((s) => s.status === 'AVAILABLE');
    const waiting  = active.filter((d) => d.status === DeliveryStatus.WAITING);
    const called   = active.filter((d) => d.status === DeliveryStatus.CALLED);
    const receiving = active.filter((d) =>
      d.status === DeliveryStatus.RECEIVING || d.status === DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
    );

    const waitMins = waiting.filter((d) => d.checkinTime).map(
      (d) => (now.getTime() - d.checkinTime!.getTime()) / 60000,
    );
    const avgWaitMinutes = waitMins.length > 0
      ? Math.round(waitMins.reduce((a, b) => a + b, 0) / waitMins.length)
      : null;

    // ── Alerts ──────────────────────────────────────────────────────────────
    const alerts: { level: string; message: string; deliveryId?: string }[] = [];

    for (const d of waiting) {
      if (!d.checkinTime) continue;
      const waitMin = (now.getTime() - d.checkinTime.getTime()) / 60000;
      if (d.goodsType === GoodsType.FRESH_FOOD) {
        if (waitMin >= 30) alerts.push({ level: 'critical', message: `${d.vehiclePlate} tươi sống chờ ${Math.round(waitMin)} phút — GỌI NGAY`, deliveryId: d.id });
        else if (waitMin >= 20) alerts.push({ level: 'warning', message: `${d.vehiclePlate} tươi sống chờ ${Math.round(waitMin)} phút`, deliveryId: d.id });
      }
      if (waitMin > 45 && d.goodsType !== GoodsType.FRESH_FOOD) {
        alerts.push({ level: 'warning', message: `⚠️ ${d.vehiclePlate} chờ ${Math.round(waitMin)} phút (hàng thường)`, deliveryId: d.id });
      }
    }

    for (const d of called) {
      if (!d.calledTime) continue;
      const calledMin = (now.getTime() - d.calledTime.getTime()) / 60000;
      if (calledMin >= 15) {
        alerts.push({
          level: 'warning',
          message: `Chưa vào: ${d.vehiclePlate} gọi vào ${(d as typeof d & { assignedSlot?: { code: string } }).assignedSlot?.code ?? '?'} chưa vào slot (${Math.round(calledMin)} phút)`,
          deliveryId: d.id,
        });
      }
    }

    // ── Recommendations ──────────────────────────────────────────────────────
    const recommendations: { message: string; deliveryId?: string; slotId?: string }[] = [];

    if (waiting.length > 0) {
      // Fresh food takes priority — pick first FRESH_FOOD if any, else first in queue
      const topVehicle = waiting.find((d) => d.goodsType === GoodsType.FRESH_FOOD) ?? waiting[0];
      const matchSlot  = availableSlots.find((s) => s.vehicleType === topVehicle.vehicleType);
      const bestSlot   = matchSlot ?? availableSlots[0];

      if (bestSlot) {
        const match = bestSlot.vehicleType === topVehicle.vehicleType ? 'Cùng loại xe' : 'Khác loại xe';
        const waitStr = topVehicle.checkinTime
          ? `chờ ${Math.round((now.getTime() - topVehicle.checkinTime.getTime()) / 60000)} phút`
          : '';
        recommendations.push({
          message: `Gọi ngay: ${topVehicle.vehiclePlate}${waitStr ? ' (' + waitStr + ')' : ''} → ${bestSlot.code} [${match}]`,
          deliveryId: topVehicle.id,
          slotId: bestSlot.id,
        });

        if (waiting.length > 1 && availableSlots.length > 1) {
          const remaining = waiting.filter((d) => d.id !== topVehicle.id);
          const next = remaining.find((d) => d.goodsType === GoodsType.FRESH_FOOD) ?? remaining[0];
          if (next) {
            const nextSlot = availableSlots
              .filter((s) => s.id !== bestSlot.id)
              .find((s) => s.vehicleType === next.vehicleType)
              ?? availableSlots.find((s) => s.id !== bestSlot.id);
            if (nextSlot) {
              recommendations.push({
                message: `💡 Tiếp theo: ${next.vehiclePlate} → ${nextSlot.code}`,
                deliveryId: next.id,
                slotId: nextSlot.id,
              });
            }
          }
        }
      } else {
        recommendations.push({ message: `${waiting.length} xe chờ — không còn slot trống. Ưu tiên hoàn tất nhận hàng.` });
      }
    }

    const truckWaiting  = waiting.filter((d) => d.vehicleType === VehicleType.TRUCK).length;
    const mbWaiting     = waiting.filter((d) => d.vehicleType === VehicleType.MOTORBIKE).length;
    const truckSlotsAvail = availableSlots.filter((s) => s.vehicleType === VehicleType.TRUCK).length;
    const mbSlotsAvail    = availableSlots.filter((s) => s.vehicleType === VehicleType.MOTORBIKE).length;

    if (truckWaiting > truckSlotsAvail && mbSlotsAvail > 0) {
      recommendations.push({ message: `Khu vực nhận hàng xe tải đầy (${truckSlotsAvail} trống), có ${mbSlotsAvail} khu vực nhận hàng xe máy còn trống` });
    }

    const nextHourVehicles = upcoming.filter((d) => d.requestedTime && new Date(d.requestedTime) <= oneHourLater);
    if (nextHourVehicles.length > 0) {
      const firstTime = nextHourVehicles[0].requestedTime!;
      const hh = firstTime.getHours().toString().padStart(2, '0');
      const mm = firstTime.getMinutes().toString().padStart(2, '0');
      const truckCount = nextHourVehicles.filter((d) => d.vehicleType === VehicleType.TRUCK).length;
      const mbCount    = nextHourVehicles.filter((d) => d.vehicleType === VehicleType.MOTORBIKE).length;
      recommendations.push({
        message: `Dự báo 1h tới: ${nextHourVehicles.length} xe đến (${truckCount} xe tải + ${mbCount} xe máy), khu vực nhận hàng đầu ${hh}:${mm}`,
      });
    }

    result[unit] = {
      unitConfig,
      active,
      upcoming,
      slots,
      insights: {
        alerts,
        recommendations,
        stats: {
          registered: upcoming.length,
          waiting: waiting.length,
          called: called.length,
          receiving: receiving.length,
          trucksWaiting: truckWaiting,
          motorbikesWaiting: mbWaiting,
          slotsTotal: slots.length,
          slotsAvailable: availableSlots.length,
          truckSlotsAvailable: truckSlotsAvail,
          mbSlotsAvailable: mbSlotsAvail,
          // backward-compat aliases
          docksTotal: slots.length,
          docksAvailable: availableSlots.length,
          truckDocksAvailable: truckSlotsAvail,
          mbDocksAvailable: mbSlotsAvail,
          avgWaitMinutes,
        },
        nextHour: { count: nextHourVehicles.length, firstSlot: nextHourVehicles[0]?.requestedTime ?? null },
      },
    };
  }

  res.json(result);
}));

// POST /api/dashboard/expire-stale  — manual trigger (admin)
router.post('/expire-stale', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (req: Request, res: Response) => {
  const unitConfigIds = req.user && roleHasUnitOperationScope(req.user.role)
    ? req.user.operationUnits
        .filter((unit) => unit.isActive && unit.businessLocationId === req.scope?.businessLocationId)
        .map((unit) => unit.id)
    : undefined;
  const result = await closeDailyDeliveries({
    trigger: SchedulerJobTrigger.MANUAL,
    businessLocationId: req.scope?.businessLocationId,
    unitConfigIds,
  });
  res.json({
    ...result,
    total: result.processed,
    message: result.processed > 0
      ? `Đã xử lý ${result.succeeded}/${result.processed} lượt vào lịch sử`
      : 'Không có bản ghi nào cần xử lý',
  });
}));

export default router;
