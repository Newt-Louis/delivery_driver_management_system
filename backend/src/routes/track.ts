import { Router, Request, Response } from 'express';
import { DeliveryStatus, StaffRole } from '@prisma/client';
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
const ROLE_FOR_STATUS: Partial<Record<DeliveryStatus, StaffRole>> = {
  [DeliveryStatus.REGISTERED]: StaffRole.SECURITY,   // check-in
  [DeliveryStatus.CALLED]:     StaffRole.RECEIVING,  // start receiving
  [DeliveryStatus.RECEIVING]:  StaffRole.RECEIVING,  // complete
  [DeliveryStatus.AUTO_WAREHOUSE_RECEIVING]: StaffRole.RECEIVING,
};

const TRACK_INCLUDE = {
  assignedSlot: { include: { zone: { select: { id: true, code: true, name: true } } } },
  callLogs: {
    orderBy: { calledAt: 'asc' as const },
    include: { slot: { select: { id: true, code: true, name: true } } },
  },
} as const;

// GET /api/track/search?plate= — look up registration code by vehicle plate (read-only)
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
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

// POST /api/track/:code/action — staff PIN protected
router.post('/:code/action', asyncHandler(async (req: Request, res: Response) => {
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

  const requiredRole = ROLE_FOR_STATUS[delivery.status];
  if (!requiredRole) {
    res.status(400).json({ error: 'Không có hành động nào cho trạng thái này' }); return;
  }
  if (staff.role !== requiredRole) {
    const roleLabel = requiredRole === StaffRole.SECURITY ? 'bảo vệ' : 'nhân viên nhận hàng';
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

      const checkinTime = new Date();
      const todayStart = new Date(checkinTime);
      todayStart.setHours(0, 0, 0, 0);

      // Assign sequential ticket number per unit + vehicleType per day (atomic)
      const updated = await prisma.$transaction(async (tx) => {
        const maxRow = await tx.deliveryRegistration.findFirst({
          where: {
            receivingUnit: delivery.receivingUnit,
            vehicleType:   delivery.vehicleType,
            ticketNumber:  { not: null },
            checkinTime:   { gte: todayStart },
          },
          orderBy: { ticketNumber: 'desc' },
          select: { ticketNumber: true },
        });
        const ticketNumber = (maxRow?.ticketNumber ?? 0) + 1;
        return tx.deliveryRegistration.update({
          where: { id: delivery.id },
          data: { status: DeliveryStatus.WAITING, checkinTime, ticketNumber },
          include: TRACK_INCLUDE,
        });
      });

      const queue = await getFullQueue();
      emitQueueUpdated(queue);
      emitTrackUpdatesForQueue(queue).catch(console.error);
      res.json({ action: 'CHECKED_IN', staffName: staff.name, delivery: updated });
      triggerAutoAssign(delivery.receivingUnit).catch(console.error);
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
      const queue = await getFullQueue();
      emitQueueUpdated(queue);
      emitTrackUpdatesForQueue(queue).catch(console.error);
      res.json({ action: 'RECEIVING_STARTED', staffName: staff.name, delivery: updated });
      return;
    }

    case DeliveryStatus.RECEIVING:
    case DeliveryStatus.AUTO_WAREHOUSE_RECEIVING: {
      await prisma.$transaction(async (tx) => {
        await tx.deliveryRegistration.update({
          where: { id: delivery.id },
          data: { status: DeliveryStatus.COMPLETED, completedTime: new Date() },
        });
        if (delivery.assignedSlotId) {
          const remaining = await tx.deliveryRegistration.count({
            where: {
              assignedSlotId: delivery.assignedSlotId,
              id: { not: delivery.id },
              status: { in: ['CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'] },
            },
          });
          const slotRecord = await tx.slot.findUnique({
            where: { id: delivery.assignedSlotId },
            select: { maxCapacity: true },
          });
          await tx.slot.update({
            where: { id: delivery.assignedSlotId },
            data: {
              status: remaining < (slotRecord?.maxCapacity ?? 1) ? 'AVAILABLE' : 'OCCUPIED',
              currentDeliveryId: remaining === 0 ? null : undefined,
            },
          });
        }
      });

      const final = await prisma.deliveryRegistration.findUnique({
        where: { id: delivery.id },
        include: TRACK_INCLUDE,
      });
      const [queue, slots] = await Promise.all([getFullQueue(), getAllSlots()]);
      emitDeliveryCompleted(delivery.id);
      emitQueueUpdated(queue);
      emitSlotUpdated(slots);
      emitTrackUpdated(delivery.registrationCode).catch(console.error);
      emitTrackUpdatesForQueue(queue).catch(console.error);
      res.json({ action: 'COMPLETED', staffName: staff.name, delivery: final });
      triggerAutoAssign(delivery.receivingUnit).catch(console.error);
      return;
    }
  }
}));

export default router;
