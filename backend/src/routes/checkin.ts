import { Router, Request, Response } from 'express';
import { DeliveryStatus, StaffRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { triggerAutoAssign } from '../services/autoAssign';
import { emitQueueUpdated, emitDeliveryCompleted, emitSlotUpdated } from '../socket/index';
import { getFullQueue, getAllSlots } from './deliveries';
import { formatTicketCode } from './track';
import { isScheduledForToday, formatVNDate } from '../lib/dateVN';
import { sendPushToDelivery } from '../services/webPush';

const router = Router();

const CHECKIN_INCLUDE = {
  assignedSlot: { include: { zone: { select: { id: true, code: true, name: true } } } },
} as const;

// ─── POST /api/checkin/terminal-auth ─────────────────────────────────────────
router.post('/terminal-auth', asyncHandler(async (req: Request, res: Response) => {
  const { pin } = req.body as { pin?: string };
  if (!pin) { res.status(400).json({ error: 'Vui lòng nhập mã PIN' }); return; }

  const staff = await prisma.staffPin.findUnique({ where: { pin, active: true } });
  if (!staff) { res.status(401).json({ error: 'Mã PIN không hợp lệ hoặc đã bị vô hiệu hóa' }); return; }
  if (staff.role !== StaffRole.SECURITY) {
    res.status(403).json({ error: 'Chỉ bảo vệ mới có thể kích hoạt kiosk check-in' }); return;
  }

  const secret = process.env.JWT_SECRET ?? 'fallback-secret';
  const terminalToken = jwt.sign(
    { type: 'terminal', staffPinId: staff.id, staffName: staff.name },
    secret,
    { expiresIn: '8h' },
  );
  res.json({ terminalToken, staffName: staff.name, expiresIn: 8 * 3600 });
}));

// ─── POST /api/checkin/scan ───────────────────────────────────────────────────
// Unified kiosk scan — handles all 3 delivery lifecycle transitions:
//   Scan 1: REGISTERED  → WAITING             (check-in, date-validated, ticket assigned)
//   Info:   WAITING     → 200 informational    (still in queue, not yet called)
//   Scan 2: CALLED      → RECEIVING            (start receiving at assigned dock)
//   Scan 3: RECEIVING / AUTO_WAREHOUSE → COMPLETED  (done, slot released)
router.post('/scan', asyncHandler(async (req: Request, res: Response) => {
  // ── Validate terminal token ──
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Terminal chưa được xác thực. Vui lòng nhập lại mã bảo vệ.' });
    return;
  }
  const token = header.slice(7);
  let terminalPayload: { type: string; staffPinId: string; staffName: string };
  try {
    const secret = process.env.JWT_SECRET ?? 'fallback-secret';
    terminalPayload = jwt.verify(token, secret) as typeof terminalPayload;
    if (terminalPayload.type !== 'terminal') throw new Error('wrong type');
  } catch {
    res.status(401).json({ error: 'Phiên kiosk đã hết hạn. Vui lòng nhập lại mã bảo vệ.' });
    return;
  }

  const { registrationCode } = req.body as { registrationCode?: string };
  if (!registrationCode) { res.status(400).json({ error: 'Thiếu mã đăng ký' }); return; }

  const delivery = await prisma.deliveryRegistration.findFirst({
    where: { registrationCode: registrationCode.trim().toUpperCase() },
    include: CHECKIN_INCLUDE,
  });
  if (!delivery) {
    res.status(404).json({ error: `Không tìm thấy mã "${registrationCode.trim().toUpperCase()}"` });
    return;
  }

  // ── Route by current status ──
  switch (delivery.status) {

    // ── Scan 1: Check-in ────────────────────────────────────────────────────
    case DeliveryStatus.REGISTERED: {
      if (!isScheduledForToday(delivery.requestedTime)) {
        res.status(400).json({
          error: `Lượt này được lên lịch vào ${formatVNDate(delivery.requestedTime!)}. Chỉ check-in đúng ngày.`,
        });
        return;
      }

      const checkinTime = new Date();
      const todayStart  = new Date(checkinTime);
      todayStart.setHours(0, 0, 0, 0);

      const updated = await prisma.$transaction(async (tx) => {
        const maxRow = await tx.deliveryRegistration.findFirst({
          where: {
            receivingUnit: delivery.receivingUnit,
            vehicleType:   delivery.vehicleType,
            ticketNumber:  { not: null },
            checkinTime:   { gte: todayStart },
          },
          orderBy: { ticketNumber: 'desc' },
          select:  { ticketNumber: true },
        });
        const ticketNumber = (maxRow?.ticketNumber ?? 0) + 1;
        return tx.deliveryRegistration.update({
          where:   { id: delivery.id },
          data:    { status: DeliveryStatus.WAITING, checkinTime, ticketNumber },
          include: CHECKIN_INCLUDE,
        });
      });

      const ticketCode = formatTicketCode(delivery.receivingUnit, delivery.vehicleType, updated.ticketNumber!);
      emitQueueUpdated(await getFullQueue());
      res.json({ action: 'CHECKED_IN', staffName: terminalPayload.staffName, ticketCode, delivery: updated });
      sendPushToDelivery(delivery.registrationCode, {
        title: '✅ Check-in thành công',
        body:  `${ticketCode} — Xe ${delivery.vehiclePlate} đang trong hàng chờ.`,
        tag:   'delivery-checkin',
        url:   `/track/${delivery.registrationCode}`,
      }).catch(console.error);
      triggerAutoAssign(delivery.receivingUnit).catch(console.error);
      return;
    }

    // ── Already in queue — informational (not an error) ─────────────────────
    case DeliveryStatus.WAITING: {
      const ticketCode = delivery.ticketNumber
        ? formatTicketCode(delivery.receivingUnit, delivery.vehicleType, delivery.ticketNumber)
        : null;
      res.json({
        action:    'WAITING',
        ticketCode,
        message:   'Xe đang trong hàng chờ, chưa được gọi vào dock',
        delivery,
      });
      return;
    }

    // ── Scan 2: Start receiving ──────────────────────────────────────────────
    case DeliveryStatus.CALLED: {
      const newStatus = delivery.autoWarehouse
        ? DeliveryStatus.AUTO_WAREHOUSE_RECEIVING
        : DeliveryStatus.RECEIVING;

      const updated = await prisma.deliveryRegistration.update({
        where:   { id: delivery.id },
        data:    { status: newStatus, receivingStartTime: new Date() },
        include: CHECKIN_INCLUDE,
      });

      emitQueueUpdated(await getFullQueue());
      const slot = updated.assignedSlot;
      res.json({
        action:   'RECEIVING_STARTED',
        staffName: terminalPayload.staffName,
        slotInfo: slot ? { code: slot.code, name: slot.name, zone: slot.zone } : null,
        delivery: updated,
      });
      return;
    }

    // ── Scan 3: Complete ────────────────────────────────────────────────────
    case DeliveryStatus.RECEIVING:
    case DeliveryStatus.AUTO_WAREHOUSE_RECEIVING: {
      await prisma.$transaction(async (tx) => {
        await tx.deliveryRegistration.update({
          where: { id: delivery.id },
          data:  { status: DeliveryStatus.COMPLETED, completedTime: new Date() },
        });
        if (delivery.assignedSlotId) {
          const remaining = await tx.deliveryRegistration.count({
            where: {
              assignedSlotId: delivery.assignedSlotId,
              id:     { not: delivery.id },
              status: { in: ['CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'] },
            },
          });
          const slotRecord = await tx.slot.findUnique({
            where:  { id: delivery.assignedSlotId },
            select: { maxCapacity: true },
          });
          await tx.slot.update({
            where: { id: delivery.assignedSlotId },
            data: {
              status:            remaining < (slotRecord?.maxCapacity ?? 1) ? 'AVAILABLE' : 'OCCUPIED',
              currentDeliveryId: remaining === 0 ? null : undefined,
            },
          });
        }
      });

      const final = await prisma.deliveryRegistration.findUnique({
        where:   { id: delivery.id },
        include: CHECKIN_INCLUDE,
      });
      const [queue, slots] = await Promise.all([getFullQueue(), getAllSlots()]);
      emitDeliveryCompleted(delivery.id);
      emitQueueUpdated(queue);
      emitSlotUpdated(slots);
      res.json({ action: 'COMPLETED', staffName: terminalPayload.staffName, delivery: final });
      sendPushToDelivery(delivery.registrationCode, {
        title: '🎉 Giao hàng hoàn tất',
        body:  `Xe ${delivery.vehiclePlate} — Cảm ơn bạn đã giao hàng!`,
        tag:   'delivery-completed',
        url:   `/track/${delivery.registrationCode}`,
      }).catch(console.error);
      triggerAutoAssign(delivery.receivingUnit).catch(console.error);
      return;
    }

    // ── Terminal states ─────────────────────────────────────────────────────
    case DeliveryStatus.COMPLETED:
      res.status(400).json({
        error:    'Lượt giao hàng này đã hoàn thành',
        delivery: { status: delivery.status, vehiclePlate: delivery.vehiclePlate },
      });
      return;

    default:
      res.status(400).json({
        error:    `Lượt đăng ký không hợp lệ (trạng thái: ${delivery.status})`,
        delivery: { status: delivery.status },
      });
  }
}));

export default router;
