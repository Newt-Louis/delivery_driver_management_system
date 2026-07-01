import { Router, Request, Response } from 'express';
import { DeliveryStatus, StaffRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { triggerAutoAssign } from '../services/autoAssign';
import { emitQueueUpdated, emitDeliveryCompleted, emitSlotUpdated } from '../socket/index';
import { getFullQueue, getAllSlots } from './deliveries';
import { formatTicketCode } from './track';
import { isScheduledForToday, formatVNDate } from '../lib/dateVN';
import { sendPushToDelivery } from '../services/webPush';
import { emitTrackUpdated, emitTrackUpdatesForQueue } from '../services/trackRealtime';
import { checkInDelivery } from '../services/checkInDelivery';
import { completeDelivery } from '../services/deliveryLifecycle';
import { getScopeForDelivery } from '../services/realtimeScope';
import { deviceStaffActor, recordAuditLog } from '../services/auditLog';
import { terminalAuthLimiter } from '../middleware/rateLimit';

const router = Router();

const CHECKIN_INCLUDE = {
  assignedSlot: { include: { zone: { select: { id: true, code: true, name: true } } } },
} as const;

function requestedStaffRole(role?: string): StaffRole | null {
  if (!role) return StaffRole.SECURITY;
  const normalized = role.trim().toUpperCase();
  if (normalized === 'SECURITY') return StaffRole.SECURITY;
  if (normalized === 'RECEIVING' || normalized === 'GR') return StaffRole.RECEIVING;
  return null;
}

const ROLE_FOR_TERMINAL_SCAN: Partial<Record<DeliveryStatus, StaffRole>> = {
  [DeliveryStatus.REGISTERED]: StaffRole.SECURITY,
  [DeliveryStatus.CALLED]: StaffRole.RECEIVING,
  [DeliveryStatus.RECEIVING]: StaffRole.RECEIVING,
  [DeliveryStatus.AUTO_WAREHOUSE_RECEIVING]: StaffRole.RECEIVING,
};

// ─── POST /api/checkin/terminal-auth ─────────────────────────────────────────
router.post('/terminal-auth', terminalAuthLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { pin, role, deviceCode, deviceSecret } = req.body as {
    pin?: string;
    role?: string;
    deviceCode?: string;
    deviceSecret?: string;
  };
  if (!deviceCode?.trim() || !deviceSecret) {
    res.status(400).json({ error: 'Thiết bị chưa được xác thực. Vui lòng nhập mã thiết bị và secret.' });
    return;
  }
  if (!pin) { res.status(400).json({ error: 'Vui lòng nhập mã PIN' }); return; }

  const requiredRole = requestedStaffRole(role);
  if (!requiredRole) { res.status(400).json({ error: 'Vai tro kiosk khong hop le' }); return; }

  const device = await prisma.device.findUnique({
    where: { code: deviceCode.trim().toUpperCase() },
    include: { businessLocation: { select: { id: true, code: true, locationName: true, isActive: true } } },
  });
  if (!device || !device.isActive || !device.businessLocation.isActive) {
    res.status(401).json({ error: 'Thiết bị không hợp lệ hoặc đã bị vô hiệu hóa.' });
    return;
  }
  const deviceOk = await bcrypt.compare(deviceSecret, device.deviceSecretHash);
  if (!deviceOk) {
    res.status(401).json({ error: 'Device secret không hợp lệ.' });
    return;
  }

  const staff = await prisma.staffPin.findUnique({ where: { pin, active: true } });
  if (!staff) { res.status(401).json({ error: 'Mã PIN không hợp lệ hoặc đã bị vô hiệu hóa' }); return; }
  if (staff.role !== requiredRole) {
    if (requiredRole === StaffRole.RECEIVING) {
      res.status(403).json({ error: 'Chi nhan vien nhan hang moi co the kich hoat kiosk nay' }); return;
    }
    res.status(403).json({ error: 'Chỉ bảo vệ mới có thể kích hoạt kiosk check-in' }); return;
  }

  const secret = process.env.JWT_SECRET ?? 'fallback-secret';
  const terminalToken = jwt.sign(
    {
      type: 'terminal',
      staffPinId: staff.id,
      staffName: staff.name,
      staffRole: staff.role,
      roleScoped: Boolean(role),
      deviceId: device.id,
      deviceCode: device.code,
      deviceType: device.deviceType,
      businessLocationId: device.businessLocationId,
    },
    secret,
    { expiresIn: '8h' },
  );
  await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  res.json({
    terminalToken,
    staffName: staff.name,
    staffRole: staff.role,
    deviceCode: device.code,
    deviceType: device.deviceType,
    businessLocationId: device.businessLocationId,
    businessLocationName: device.businessLocation.locationName,
    expiresIn: 8 * 3600,
  });
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
  let terminalPayload: {
    type: string;
    staffPinId: string;
    staffName: string;
    staffRole?: StaffRole;
    roleScoped?: boolean;
    deviceId: string;
    deviceCode: string;
    businessLocationId: string;
  };
  try {
    const secret = process.env.JWT_SECRET ?? 'fallback-secret';
    terminalPayload = jwt.verify(token, secret) as typeof terminalPayload;
    if (terminalPayload.type !== 'terminal') throw new Error('wrong type');
    if (!terminalPayload.deviceId || !terminalPayload.businessLocationId) throw new Error('missing device scope');
  } catch {
    res.status(401).json({ error: 'Phiên kiosk đã hết hạn. Vui lòng nhập lại mã bảo vệ.' });
    return;
  }

  const terminalDevice = await prisma.device.findUnique({
    where: { id: terminalPayload.deviceId },
    select: { id: true, isActive: true, businessLocationId: true },
  });
  if (!terminalDevice?.isActive || terminalDevice.businessLocationId !== terminalPayload.businessLocationId) {
    res.status(401).json({ error: 'Thiết bị đã bị vô hiệu hóa. Vui lòng đăng nhập lại.' });
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

  const deliveryScope = await getScopeForDelivery(delivery);
  if (deliveryScope.businessLocationId && deliveryScope.businessLocationId !== terminalPayload.businessLocationId) {
    res.status(403).json({ error: 'Mã giao hàng không thuộc khu vực của thiết bị này.' });
    return;
  }

  // ── Route by current status ──
  if (terminalPayload.roleScoped) {
    const requiredRole = ROLE_FOR_TERMINAL_SCAN[delivery.status];
    if (requiredRole && terminalPayload.staffRole !== requiredRole) {
      const roleLabel = requiredRole === StaffRole.SECURITY ? 'bao ve' : 'nhan vien nhan hang';
      res.status(403).json({ error: `Hanh dong nay yeu cau kiosk ${roleLabel}` });
      return;
    }
  }

  switch (delivery.status) {

    // ── Scan 1: Check-in ────────────────────────────────────────────────────
    case DeliveryStatus.REGISTERED: {
      if (!isScheduledForToday(delivery.requestedTime)) {
        res.status(400).json({
          error: `Lượt này được lên lịch vào ${formatVNDate(delivery.requestedTime!)}. Chỉ check-in đúng ngày.`,
        });
        return;
      }

      const checkInResult = await checkInDelivery({
        deliveryId: delivery.id,
        resultArgs: { include: CHECKIN_INCLUDE },
      });

      if (!checkInResult.delivery) {
        res.status(404).json({ error: `Không tìm thấy mã "${registrationCode.trim().toUpperCase()}"` });
        return;
      }

      const { delivery: updated } = checkInResult;
      if (updated.status !== DeliveryStatus.WAITING) {
        res.status(409).json({
          error: `Lượt đăng ký đã đổi trạng thái sang ${updated.status}. Vui lòng quét lại để xử lý bước hiện tại.`,
          delivery: updated,
        });
        return;
      }

      const ticketCode = updated.ticketNumber
        ? formatTicketCode(updated.receivingUnit, updated.vehicleType, updated.ticketNumber)
        : null;
      if (!checkInResult.checkedIn) {
        res.json({
          action: 'WAITING',
          ticketCode,
          message: 'Xe đang trong hàng chờ, chưa được gọi vào dock',
          delivery: updated,
        });
        return;
      }

      const scope = await getScopeForDelivery(updated);
      const queue = await getFullQueue(scope);
      await recordAuditLog({
        ...deviceStaffActor(terminalPayload),
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
        metadata: { source: 'checkin.scan' },
      });
      emitQueueUpdated(queue, scope);
      emitTrackUpdatesForQueue(queue).catch(console.error);
      res.json({ action: 'CHECKED_IN', staffName: terminalPayload.staffName, ticketCode, delivery: updated });
      sendPushToDelivery(delivery.registrationCode, {
        title: '✅ Check-in thành công',
        body:  `${ticketCode} — Xe ${delivery.vehiclePlate} đang trong hàng chờ.`,
        tag:   'delivery-checkin',
        url:   `/track/${delivery.registrationCode}`,
      }).catch(console.error);
      triggerAutoAssign(delivery.receivingUnit, scope).catch(console.error);
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

      const scope = await getScopeForDelivery(updated);
      const queue = await getFullQueue(scope);
      await recordAuditLog({
        ...deviceStaffActor(terminalPayload),
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
        metadata: { source: 'checkin.scan' },
      });
      emitQueueUpdated(queue, scope);
      emitTrackUpdatesForQueue(queue).catch(console.error);
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
      const result = await completeDelivery(delivery.id);
      if (!result.delivery) {
        res.status(404).json({ error: `Không tìm thấy mã "${registrationCode.trim().toUpperCase()}"` });
        return;
      }
      if (result.outcome === 'invalid_status') {
        res.status(409).json({
          error: `Lượt đăng ký đã đổi trạng thái sang ${result.delivery.status}. Vui lòng quét lại để xử lý bước hiện tại.`,
          delivery: result.delivery,
        });
        return;
      }

      const final = await prisma.deliveryRegistration.findUnique({
        where:   { id: delivery.id },
        include: CHECKIN_INCLUDE,
      });
      const scope = await getScopeForDelivery(result.delivery);
      const [queue, slots] = await Promise.all([getFullQueue(scope), getAllSlots(scope)]);
      if (result.changed) {
        await recordAuditLog({
          ...deviceStaffActor(terminalPayload),
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
            source: 'checkin.scan',
          },
        });
        emitDeliveryCompleted(delivery.id, scope);
        emitQueueUpdated(queue, scope);
        emitSlotUpdated(slots, scope);
        emitTrackUpdated(delivery.registrationCode).catch(console.error);
        emitTrackUpdatesForQueue(queue).catch(console.error);
      }
      res.json({ action: 'COMPLETED', staffName: terminalPayload.staffName, delivery: final });
      if (result.changed) {
        sendPushToDelivery(delivery.registrationCode, {
          title: '🎉 Giao hàng hoàn tất',
          body:  `Xe ${delivery.vehiclePlate} — Cảm ơn bạn đã giao hàng!`,
          tag:   'delivery-completed',
          url:   `/track/${delivery.registrationCode}`,
        }).catch(console.error);
        triggerAutoAssign(delivery.receivingUnit, scope).catch(console.error);
      }
      return;
    }

    // ── Terminal states ─────────────────────────────────────────────────────
    case DeliveryStatus.COMPLETED:
      res.json({
        action: 'COMPLETED',
        staffName: terminalPayload.staffName,
        message: 'Lượt giao hàng này đã hoàn thành',
        delivery,
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
