import { Router, Request, Response } from 'express';
import { DeliveryStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { triggerAutoAssign } from '../services/autoAssign';
import {
  emitQueueUpdated,
  emitDeliveryCompleted,
  emitSlotUpdated,
} from '../socket';
import { getFullQueue, getAllSlots } from './deliveries';
import { isScheduledForToday, formatVNDate } from '../lib/dateVN';
import { emitTrackUpdated, emitTrackUpdatesForQueue, getTrackDelivery } from '../services/trackRealtime';
import { sendPushToDelivery } from '../services/webPush';
import { checkInDelivery } from '../services/checkInDelivery';
import { completeDelivery } from '../services/deliveryLifecycle';
import { getScopeForDelivery } from '../services/realtimeScope';
import { recordAuditLog, staffActor } from '../services/auditLog';
import { publicLookupLimiter, staffActionLimiter } from '../middleware/rateLimit';

// ─── Ticket code format: UNIT-VTYPE + 3-digit sequence ───────────────────────
const UNIT_TICKET_PREFIX: Record<string, string> = {
  EMART: 'EMART', THISKYHALL: 'THISKY', TENANT: 'MALL',
};
const VT_TICKET_PREFIX: Record<string, string> = {
  TRUCK: 'T', MOTORBIKE: 'M', OTHER: 'X',
};
export function formatTicketCode(unit: string, vehicleType: string, n: number): string {
  const up = UNIT_TICKET_PREFIX[unit] ?? unit;
  const vp = VT_TICKET_PREFIX[vehicleType] ?? 'X';
  return `${up}-${vp}${String(n).padStart(3, '0')}`;
}

const router = Router();

// Which staff roles may perform which delivery-status transitions
const ROLE_FOR_STATUS: Partial<Record<DeliveryStatus, Role>> = {
  [DeliveryStatus.REGISTERED]: Role.CHECKIN,    // check-in
  [DeliveryStatus.CALLED]:     Role.RECEIVING,  // start receiving
  [DeliveryStatus.RECEIVING]:  Role.RECEIVING,  // complete
  [DeliveryStatus.AUTO_WAREHOUSE_RECEIVING]: Role.RECEIVING,
};

const TRACK_INCLUDE = {
  assignedSlot: { include: { zone: { select: { id: true, code: true, name: true } } } },
  callLogs: {
    orderBy: { calledAt: 'asc' as const },
    include: { slot: { select: { id: true, code: true, name: true } } },
  },
} as const;

// GET /api/track/search?plate= — look up registration code by vehicle plate (read-only)
router.get('/search', publicLookupLimiter, asyncHandler(async (req: Request, res: Response) => {
  const plate = typeof req.query.plate === 'string' ? req.query.plate.trim().toUpperCase() : '';
  if (!plate) {
    res.status(400).json({ error: 'Vui lòng nhập biển số xe' });
    return;
  }

  // Find most recent non-expired/cancelled delivery for this plate
  const delivery = await prisma.deliveryRegistration.findFirst({
    where: {
      vehiclePlate: plate,
      status: { notIn: ['CANCELLED', 'EXPIRED'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { registrationCode: true, status: true, receivingUnit: true, driverName: true },
  });

  if (!delivery) {
    res.status(404).json({ error: `Không tìm thấy lượt đăng ký nào cho biển số ${plate}` });
    return;
  }

  res.json({ registrationCode: delivery.registrationCode });
}));

// GET /api/track/:code — public, no sensitive fields
// When status=WAITING, also returns queueInfo { position, totalWaiting, estimatedWaitMinutes, availableSlots }
router.get('/:code', asyncHandler(async (req: Request, res: Response) => {
  const delivery = await getTrackDelivery(req.params.code);
  if (!delivery) { res.status(404).json({ error: 'Không tìm thấy đăng ký' }); return; }
  res.json(delivery);
}));

// POST /api/track/active-session
// Accepts an array of codes, returns the single most relevant active code (if any).
// Priority: WAITING/CALLED > REGISTERED > Others (not COMPLETED/CANCELLED/EXPIRED).
router.post('/active-session', asyncHandler(async (req: Request, res: Response) => {
  const { codes } = req.body as { codes?: string[] };
  if (!Array.isArray(codes) || codes.length === 0) {
    res.json({ activeCode: null });
    return;
  }
  const cleanCodes = codes.map(c => typeof c === 'string' ? c.trim().toUpperCase() : '').filter(Boolean);
  if (cleanCodes.length === 0) {
    res.json({ activeCode: null });
    return;
  }

  const deliveries = await prisma.deliveryRegistration.findMany({
    where: {
      registrationCode: { in: cleanCodes },
      status: { notIn: ['COMPLETED', 'CANCELLED', 'EXPIRED'] },
    },
    select: { registrationCode: true, status: true, requestedTime: true },
  });

  if (deliveries.length === 0) {
    res.json({ activeCode: null });
    return;
  }

  // Find priority
  let best = deliveries[0];
  const priority = (d: typeof deliveries[0]) => {
    if (d.status === 'CALLED') return 4;
    if (d.status === 'WAITING') return 3;
    if (d.status === 'RECEIVING' || d.status === 'AUTO_WAREHOUSE_RECEIVING') return 2;
    if (d.status === 'REGISTERED') return 1;
    return 0;
  };

  for (let i = 1; i < deliveries.length; i++) {
    const d = deliveries[i];
    const pD = priority(d);
    const pBest = priority(best);
    if (pD > pBest) {
      best = d;
    } else if (pD === pBest) {
      // If both are REGISTERED, prefer the one with requestedTime closest to now
      if (pD === 1 && d.requestedTime && best.requestedTime) {
        if (d.requestedTime < best.requestedTime) {
          best = d;
        }
      }
    }
  }

  res.json({ activeCode: best.registrationCode });
}));

// POST /api/track/:code/action — staff PIN protected
router.post('/:code/action', staffActionLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { staffPin } = req.body as { staffPin?: string };

  const delivery = await prisma.deliveryRegistration.findFirst({
    where: { registrationCode: req.params.code.toUpperCase() },
    include: TRACK_INCLUDE,
  });
  if (!delivery) { res.status(404).json({ error: 'Không tìm thấy đăng ký' }); return; }

  // Validate staff PIN and role
  if (!staffPin) {
    res.status(401).json({ error: 'Vui lòng nhập mã nhân viên' }); return;
  }
  const staff = await prisma.staffPin.findUnique({
    where: { pin: staffPin, active: true },
  });
  if (!staff) {
    res.status(401).json({ error: 'Mã nhân viên không hợp lệ hoặc đã bị vô hiệu hóa' }); return;
  }

  if (delivery.status === DeliveryStatus.WAITING) {
    const ticketCode = delivery.ticketNumber
      ? formatTicketCode(delivery.receivingUnit, delivery.vehicleType, delivery.ticketNumber)
      : null;
    res.json({
      action: 'WAITING',
      staffName: staff.name,
      ticketCode,
      message: 'Xe đang trong hàng chờ, chưa được gọi vào dock',
      delivery,
    });
    return;
  }
  if (delivery.status === DeliveryStatus.COMPLETED) {
    res.json({
      action: 'COMPLETED',
      staffName: staff.name,
      message: 'Lượt giao hàng này đã hoàn thành',
      delivery,
    });
    return;
  }

  const requiredRole = ROLE_FOR_STATUS[delivery.status];
  if (!requiredRole) {
    res.status(400).json({ error: 'Không có hành động nào cho trạng thái này' }); return;
  }
  if (staff.role !== requiredRole) {
    const roleLabel = requiredRole === Role.CHECKIN ? 'nhân viên check-in' : 'nhân viên nhận hàng';
    res.status(403).json({ error: `Hành động này yêu cầu mã của ${roleLabel}` }); return;
  }

  switch (delivery.status) {
    case DeliveryStatus.REGISTERED: {
      // Only allow check-in on the scheduled day
      if (!isScheduledForToday(delivery.requestedTime)) {
        res.status(400).json({
          error: `Lượt này được lên lịch vào ${formatVNDate(delivery.requestedTime!)}. Chỉ check-in đúng ngày.`,
        });
        return;
      }

      const checkInResult = await checkInDelivery({
        deliveryId: delivery.id,
        resultArgs: { include: TRACK_INCLUDE },
      });

      if (!checkInResult.delivery) {
        res.status(404).json({ error: 'Không tìm thấy đăng ký' });
        return;
      }

      const { delivery: updated } = checkInResult;
      if (updated.status !== DeliveryStatus.WAITING) {
        res.status(409).json({
          error: `Lượt đăng ký đã đổi trạng thái sang ${updated.status}. Vui lòng tải lại trạng thái hiện tại.`,
          delivery: updated,
        });
        return;
      }

      if (!checkInResult.checkedIn) {
        const ticketCode = updated.ticketNumber
          ? formatTicketCode(updated.receivingUnit, updated.vehicleType, updated.ticketNumber)
          : null;
        res.json({
          action: 'WAITING',
          staffName: staff.name,
          ticketCode,
          message: 'Xe đang trong hàng chờ, chưa được gọi vào dock',
          delivery: updated,
        });
        return;
      }

      const scope = await getScopeForDelivery(updated);
      const queue = await getFullQueue(scope);
      await recordAuditLog({
        ...staffActor(staff),
        action: 'delivery.check_in',
        targetType: 'DeliveryRegistration',
        targetId: updated.id,
        businessLocationId: scope.businessLocationId,
        unitConfigId: scope.unitConfigId,
        after: {
          status: updated.status,
          registrationCode: updated.registrationCode,
          vehiclePlate: updated.vehiclePlate,
          ticketNumber: updated.ticketNumber,
        },
        metadata: { source: 'track.action' },
      });
      emitQueueUpdated(queue, scope);
      emitTrackUpdatesForQueue(queue).catch(console.error);
      res.json({ action: 'CHECKED_IN', staffName: staff.name, delivery: updated });
      const ticketCode = updated.ticketNumber
        ? formatTicketCode(updated.receivingUnit, updated.vehicleType, updated.ticketNumber)
        : delivery.vehiclePlate;
      sendPushToDelivery(delivery.registrationCode, {
        title: '✅ Check-in thành công',
        body: `${ticketCode} — Xe ${delivery.vehiclePlate} đang trong hàng chờ.`,
        tag: 'delivery-checkin-track',
        url: `/track/${delivery.registrationCode}`,
      }).catch(console.error);
      triggerAutoAssign(delivery.receivingUnit, scope).catch(console.error);
      return;
    }

    case DeliveryStatus.CALLED: {
      const newStatus = delivery.autoWarehouse
        ? DeliveryStatus.AUTO_WAREHOUSE_RECEIVING
        : DeliveryStatus.RECEIVING;
      const updated = await prisma.deliveryRegistration.update({
        where: { id: delivery.id },
        data: { status: newStatus, receivingStartTime: new Date() },
        include: TRACK_INCLUDE,
      });
      const scope = await getScopeForDelivery(updated);
      const queue = await getFullQueue(scope);
      await recordAuditLog({
        ...staffActor(staff),
        action: 'delivery.start_receiving',
        targetType: 'DeliveryRegistration',
        targetId: updated.id,
        businessLocationId: scope.businessLocationId,
        unitConfigId: scope.unitConfigId,
        before: { status: delivery.status },
        after: {
          status: updated.status,
          registrationCode: updated.registrationCode,
          vehiclePlate: updated.vehiclePlate,
          assignedSlotId: updated.assignedSlotId,
          receivingStartTime: updated.receivingStartTime?.toISOString() ?? null,
        },
        metadata: { source: 'track.action' },
      });
      emitQueueUpdated(queue, scope);
      emitTrackUpdatesForQueue(queue).catch(console.error);
      res.json({ action: 'RECEIVING_STARTED', staffName: staff.name, delivery: updated });
      const slotName = updated.assignedSlot?.name ?? 'dock';
      sendPushToDelivery(delivery.registrationCode, {
        title: '📦 Bắt đầu giao hàng',
        body: `Xe ${delivery.vehiclePlate} tại ${slotName}`,
        tag: 'delivery-receiving-started-track',
        url: `/track/${delivery.registrationCode}`,
      }).catch(console.error);
      return;
    }

    case DeliveryStatus.RECEIVING:
    case DeliveryStatus.AUTO_WAREHOUSE_RECEIVING: {
      const result = await completeDelivery(delivery.id);
      if (!result.delivery) {
        res.status(404).json({ error: 'Không tìm thấy đăng ký' });
        return;
      }
      if (result.outcome === 'invalid_status') {
        res.status(409).json({
          error: `Lượt đăng ký đã đổi trạng thái sang ${result.delivery.status}. Vui lòng tải lại trạng thái hiện tại.`,
          delivery: result.delivery,
        });
        return;
      }

      const final = await prisma.deliveryRegistration.findUnique({
        where: { id: delivery.id },
        include: TRACK_INCLUDE,
      });
      const scope = await getScopeForDelivery(result.delivery);
      const [queue, slots] = await Promise.all([getFullQueue(scope), getAllSlots(scope)]);
      if (result.changed) {
        await recordAuditLog({
          ...staffActor(staff),
          action: 'delivery.complete',
          targetType: 'DeliveryRegistration',
          targetId: result.delivery.id,
          businessLocationId: scope.businessLocationId,
          unitConfigId: scope.unitConfigId,
          after: {
            status: result.delivery.status,
            registrationCode: result.delivery.registrationCode,
            vehiclePlate: result.delivery.vehiclePlate,
            completedTime: result.delivery.completedTime?.toISOString() ?? null,
          },
          metadata: {
            releasedSlotId: result.releasedSlotId,
            source: 'track.action',
          },
        });
        emitDeliveryCompleted(delivery.id, scope);
        emitQueueUpdated(queue, scope);
        emitSlotUpdated(slots, scope);
        emitTrackUpdated(delivery.registrationCode).catch(console.error);
        emitTrackUpdatesForQueue(queue).catch(console.error);
      }
      res.json({ action: 'COMPLETED', staffName: staff.name, delivery: final });
      if (result.changed) {
        sendPushToDelivery(delivery.registrationCode, {
          title: '🎉 Giao hàng hoàn tất',
          body: `Xe ${delivery.vehiclePlate} — Cảm ơn bạn đã giao hàng!`,
          tag: 'delivery-completed-track',
          url: `/track/${delivery.registrationCode}`,
        }).catch(console.error);
        triggerAutoAssign(delivery.receivingUnit, scope).catch(console.error);
      }
      return;
    }
  }
}));

export default router;
