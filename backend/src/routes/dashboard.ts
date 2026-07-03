import { Router, Request, Response } from 'express';
import { DeliveryStatus, SlotStatus, GoodsType, ReceivingUnit, VehicleType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole, enforceScope } from '../middleware/auth';
import { expireStaleDeliveries } from '../services/expireStale';
import type { SocketScope } from '../socket';

const router = Router();

async function scopedDeliveryWhere(
  scope: SocketScope,
  base: Record<string, unknown>,
) {
  if (!scope.businessLocationId && !scope.unitConfigId) return base;

  const unitConfigs = await prisma.unitConfig.findMany({
    where: {
      ...(scope.unitConfigId ? { id: scope.unitConfigId } : {}),
      ...(scope.businessLocationId ? { businessLocationId: scope.businessLocationId } : {}),
    },
    select: { unit: true },
  });
  const units = [...new Set(unitConfigs.map((cfg) => cfg.unit))];

  const scopeWhere = {
    OR: [
      {
        assignedSlot: {
          zone: {
            ...(scope.unitConfigId ? { unitConfigId: scope.unitConfigId } : {}),
            ...(scope.businessLocationId ? { unitConfig: { businessLocationId: scope.businessLocationId } } : {}),
          },
        },
      },
      ...(units.length > 0 ? [{ assignedSlotId: null, receivingUnit: { in: units } }] : []),
    ],
  };

  return { AND: [base, scopeWhere] };
}

function scopedSlotWhere(scope: SocketScope, base: Record<string, unknown>) {
  return {
    ...base,
    zone: {
      ...(scope.unitConfigId ? { unitConfigId: scope.unitConfigId } : {}),
      ...(scope.businessLocationId ? { unitConfig: { businessLocationId: scope.businessLocationId } } : {}),
    },
  };
}

// GET /api/dashboard/summary
router.get('/summary', authenticate, enforceScope, asyncHandler(async (req: Request, res: Response) => {
  const scope = req.scope!;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    waitingCount, freshFoodWaiting, receivingCount,
    slotsOccupied, slotsAvailable,
    totalToday, completedToday, cancelledToday,
    noShowRisk, urgentFreshFood,
    registeredToday, expiredToday,
  ] = await Promise.all([
    prisma.deliveryRegistration.count({ where: await scopedDeliveryWhere(scope, { status: DeliveryStatus.WAITING }) }),
    prisma.deliveryRegistration.count({ where: await scopedDeliveryWhere(scope, { status: DeliveryStatus.WAITING, goodsType: GoodsType.FRESH_FOOD }) }),
    prisma.deliveryRegistration.count({
      where: await scopedDeliveryWhere(scope, { status: { in: [DeliveryStatus.RECEIVING, DeliveryStatus.AUTO_WAREHOUSE_RECEIVING, DeliveryStatus.CALLED] } }),
    }),
    prisma.slot.count({ where: scopedSlotWhere(scope, { status: SlotStatus.OCCUPIED }) }),
    prisma.slot.count({ where: scopedSlotWhere(scope, { status: SlotStatus.AVAILABLE }) }),
    prisma.deliveryRegistration.count({ where: await scopedDeliveryWhere(scope, { createdAt: { gte: today } }) }),
    prisma.deliveryRegistration.count({ where: await scopedDeliveryWhere(scope, { status: DeliveryStatus.COMPLETED, completedTime: { gte: today } }) }),
    prisma.deliveryRegistration.count({ where: await scopedDeliveryWhere(scope, { status: DeliveryStatus.CANCELLED, updatedAt: { gte: today } }) }),
    prisma.deliveryRegistration.count({
      where: await scopedDeliveryWhere(scope, { status: DeliveryStatus.CALLED, calledTime: { lte: new Date(Date.now() - 15 * 60 * 1000) } }),
    }),
    prisma.deliveryRegistration.count({
      where: await scopedDeliveryWhere(scope, { status: DeliveryStatus.WAITING, goodsType: GoodsType.FRESH_FOOD, checkinTime: { lte: new Date(Date.now() - 25 * 60 * 1000) } }),
    }),
    prisma.deliveryRegistration.count({ where: await scopedDeliveryWhere(scope, { status: DeliveryStatus.REGISTERED, createdAt: { gte: today } }) }),
    prisma.deliveryRegistration.count({ where: await scopedDeliveryWhere(scope, { status: 'EXPIRED' as DeliveryStatus, updatedAt: { gte: today } }) }),
  ]);

  res.json({
    waiting: waitingCount, freshFoodWaiting, receiving: receivingCount,
    slotsOccupied, slotsAvailable,
    // keep backward-compat keys for now so the frontend summary bar still works
    docksOccupied: slotsOccupied, docksAvailable: slotsAvailable,
    totalToday, completedToday, cancelledToday,
    noShowRisk, urgentFreshFood, registeredToday, expiredToday,
  });
}));

// GET /api/dashboard/dispatch
router.get('/dispatch', authenticate, enforceScope, asyncHandler(async (req: Request, res: Response) => {
  const scope = req.scope!;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  const [allActive, allUpcoming, allSlots] = await Promise.all([
    prisma.deliveryRegistration.findMany({
      where: await scopedDeliveryWhere(scope, {
        status: { in: [DeliveryStatus.WAITING, DeliveryStatus.CALLED, DeliveryStatus.RECEIVING, DeliveryStatus.AUTO_WAREHOUSE_RECEIVING] },
      }),
      include: { assignedSlot: { include: { zone: { include: { unitConfig: true } } } }, _count: { select: { callLogs: true } } },
      orderBy: [{ checkinTime: 'asc' }],
    }),
    prisma.deliveryRegistration.findMany({
      where: await scopedDeliveryWhere(scope, {
        status: DeliveryStatus.REGISTERED,
        OR: [
          { requestedTime: { gte: todayStart, lte: todayEnd } },
          { createdAt: { gte: todayStart }, requestedTime: null },
        ],
      }),
      orderBy: [{ requestedTime: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.slot.findMany({
      where: scopedSlotWhere(scope, { isActive: true }),
      orderBy: { code: 'asc' },
    }),
  ]);

  const result: Record<string, unknown> = {};

  for (const unit of [ReceivingUnit.EMART, ReceivingUnit.THISKYHALL, ReceivingUnit.TENANT]) {
    const active   = allActive.filter((d) => d.receivingUnit === unit);
    const upcoming = allUpcoming.filter((d) => d.receivingUnit === unit);
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
        if (waitMin >= 30) alerts.push({ level: 'critical', message: `🚨 ${d.vehiclePlate} tươi sống chờ ${Math.round(waitMin)} phút — GỌI NGAY`, deliveryId: d.id });
        else if (waitMin >= 20) alerts.push({ level: 'warning', message: `⚠️ ${d.vehiclePlate} tươi sống chờ ${Math.round(waitMin)} phút`, deliveryId: d.id });
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
          message: `📞 NO-SHOW: ${d.vehiclePlate} gọi vào ${(d as typeof d & { assignedSlot?: { code: string } }).assignedSlot?.code ?? '?'} chưa vào slot (${Math.round(calledMin)} phút)`,
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
        const match = bestSlot.vehicleType === topVehicle.vehicleType ? '✅ khớp loại xe' : '⚡ khác loại xe';
        const waitStr = topVehicle.checkinTime
          ? `chờ ${Math.round((now.getTime() - topVehicle.checkinTime.getTime()) / 60000)} phút`
          : '';
        recommendations.push({
          message: `💡 Gọi ngay: ${topVehicle.vehiclePlate}${waitStr ? ' (' + waitStr + ')' : ''} → ${bestSlot.code} [${match}]`,
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
        recommendations.push({ message: `⏳ ${waiting.length} xe chờ — không còn slot trống. Ưu tiên hoàn tất nhận hàng.` });
      }
    }

    const truckWaiting  = waiting.filter((d) => d.vehicleType === VehicleType.TRUCK).length;
    const mbWaiting     = waiting.filter((d) => d.vehicleType === VehicleType.MOTORBIKE).length;
    const truckSlotsAvail = availableSlots.filter((s) => s.vehicleType === VehicleType.TRUCK).length;
    const mbSlotsAvail    = availableSlots.filter((s) => s.vehicleType === VehicleType.MOTORBIKE).length;

    if (truckWaiting > truckSlotsAvail && mbSlotsAvail > 0) {
      recommendations.push({ message: `🔀 Slot xe tải đầy (${truckSlotsAvail} trống), có ${mbSlotsAvail} slot xe máy khả dụng` });
    }

    const nextHourVehicles = upcoming.filter((d) => d.requestedTime && new Date(d.requestedTime) <= oneHourLater);
    if (nextHourVehicles.length > 0) {
      const firstTime = nextHourVehicles[0].requestedTime!;
      const hh = firstTime.getHours().toString().padStart(2, '0');
      const mm = firstTime.getMinutes().toString().padStart(2, '0');
      const truckCount = nextHourVehicles.filter((d) => d.vehicleType === VehicleType.TRUCK).length;
      const mbCount    = nextHourVehicles.filter((d) => d.vehicleType === VehicleType.MOTORBIKE).length;
      recommendations.push({
        message: `📅 Dự báo 1h tới: ${nextHourVehicles.length} xe đến (🚛${truckCount} + 🛵${mbCount}), slot đầu ${hh}:${mm}`,
      });
    }

    result[unit] = {
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
router.post('/expire-stale', authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'), asyncHandler(async (_req: Request, res: Response) => {
  const result = await expireStaleDeliveries();
  res.json({ ...result, message: result.total > 0
    ? `Đã lưu vào lịch sử: ${result.expiredRegistered} đăng ký không check-in, ${result.expiredWaiting} check-in không nhận hàng`
    : 'Không có bản ghi nào cần xử lý' });
}));

export default router;
