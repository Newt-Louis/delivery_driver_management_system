import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { DeliveryStatus, GoodsType, ReceivingUnit, VehicleType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { triggerAutoAssign } from '../services/autoAssign';
import { sendPushToDelivery } from '../services/webPush';
import { emitTrackUpdated, emitTrackUpdatesForQueue } from '../services/trackRealtime';
import { formatTicketCode } from './track';
import { isScheduledForToday, formatVNDate } from '../lib/dateVN';
import { checkInDelivery } from '../services/checkInDelivery';
import { manualCallDelivery, manualCallResultIsSuccess } from '../services/manualCallDelivery';
import {
  emitQueueUpdated,
  emitDeliveryCalled,
  emitSlotUpdated,
  emitDeliveryCompleted,
} from '../socket';

const router = Router();

const UNIT_PREFIX: Record<ReceivingUnit, string> = {
  [ReceivingUnit.EMART]:      'E',
  [ReceivingUnit.THISKYHALL]: 'T',
  [ReceivingUnit.TENANT]:     'M',
};

async function generateCode(unit: ReceivingUnit): Promise<string> {
  const prefix = UNIT_PREFIX[unit];
  const now    = new Date();
  const yy     = now.getFullYear().toString().slice(2);
  const mm     = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd     = now.getDate().toString().padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`;

  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd   = new Date(dayStart.getTime() + 86400_000);

  const count = await prisma.deliveryRegistration.count({
    where: { receivingUnit: unit, createdAt: { gte: dayStart, lt: dayEnd } },
  });

  const seq = (count + 1).toString().padStart(3, '0');
  return `${prefix}${dateStr}${seq}`;
}

export async function getFullQueue() {
  return prisma.deliveryRegistration.findMany({
    where: {
      status: {
        in: [
          DeliveryStatus.WAITING,
          DeliveryStatus.CALLED,
          DeliveryStatus.RECEIVING,
          DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
        ],
      },
    },
    include: {
      assignedSlot: true,
      callLogs: { orderBy: { calledAt: 'desc' }, take: 1 },
      _count: { select: { callLogs: true } },
    },
    orderBy: [{ checkinTime: 'asc' }],
  });
}

export async function getAllSlots() {
  return prisma.slot.findMany({
    where: { isActive: true },
    orderBy: [{ assignedUnit: 'asc' }, { vehicleType: 'asc' }, { code: 'asc' }],
    include: {
      zone: { select: { id: true, code: true, name: true } },
      deliveries: {
        where: { status: { in: ['WAITING', 'CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'] } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
}

const registerSchema = z.object({
  vendorName: z.string().min(1, 'Tên nhà cung cấp bắt buộc'),
  driverName: z.string().min(1, 'Tên tài xế bắt buộc'),
  driverPhone: z.string().min(9, 'Số điện thoại không hợp lệ'),
  vehiclePlate: z.string().min(1, 'Biển số xe bắt buộc'),
  vehicleType: z.nativeEnum(VehicleType).default(VehicleType.OTHER),
  receivingUnit: z.nativeEnum(ReceivingUnit),
  goodsType: z.nativeEnum(GoodsType),
  unitGoodsTypeId: z.string().optional(),
  poNumber: z.string().optional(),
  vendorCode: z.string().optional(),
  requestedTime: z.string().optional(),
  note: z.string().optional(),
});

// POST /api/deliveries/auto-dispatch/:unit  — manually trigger auto-assign for a unit
router.post('/auto-dispatch/:unit', authenticate, requireRole('ADMIN', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  const { unit } = req.params;
  const validUnits: string[] = ['EMART', 'THISKYHALL', 'TENANT'];
  if (!validUnits.includes(unit)) {
    res.status(400).json({ error: 'Đơn vị không hợp lệ' });
    return;
  }
  const called = await triggerAutoAssign(unit as ReceivingUnit);
  res.json({
    called,
    message: called > 0 ? `Đã điều phối ${called} xe vào vị trí` : 'Không có xe nào phù hợp để điều phối',
  });
}));

// POST /api/deliveries/register
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const body = registerSchema.parse(req.body);

  const duplicate = await prisma.deliveryRegistration.findFirst({
    where: {
      vehiclePlate: body.vehiclePlate.toUpperCase(),
      status: { in: [DeliveryStatus.REGISTERED, DeliveryStatus.WAITING, DeliveryStatus.CALLED] },
    },
  });
  if (duplicate) {
    res.status(409).json({
      error: 'Duplicate',
      message: `Biển số ${body.vehiclePlate.toUpperCase()} đã có lượt đăng ký đang hoạt động (${duplicate.registrationCode}).`,
    });
    return;
  }

  const requestedTime = body.requestedTime ? new Date(body.requestedTime) : null;

  // Check auto-warehouse vendor code if provided
  let resolvedGoodsType = body.goodsType;
  let resolvedVendorCode: string | undefined;
  if (body.vendorCode?.trim()) {
    const normalized = body.vendorCode.toUpperCase().trim();
    const awv = await prisma.autoWarehouseVendor.findFirst({
      where: { vendorCode: normalized, unit: body.receivingUnit, active: true },
    });
    if (awv) {
      resolvedGoodsType = GoodsType.AUTO_WAREHOUSE;
      resolvedVendorCode = normalized;
    } else {
      resolvedVendorCode = normalized;
    }
  }

  const registrationCode = await generateCode(body.receivingUnit);

  const delivery = await prisma.deliveryRegistration.create({
    data: {
      registrationCode,
      vendorName: body.vendorName,
      driverName: body.driverName,
      driverPhone: body.driverPhone,
      vehiclePlate: body.vehiclePlate.toUpperCase(),
      vehicleType: body.vehicleType,
      receivingUnit: body.receivingUnit,
      goodsType: resolvedGoodsType,
      unitGoodsTypeId: resolvedGoodsType === GoodsType.AUTO_WAREHOUSE ? undefined : (body.unitGoodsTypeId || undefined),
      poNumber: body.poNumber,
      vendorCode: resolvedVendorCode,
      requestedTime,
      autoWarehouse: resolvedGoodsType === GoodsType.AUTO_WAREHOUSE,
      note: body.note,
    },
  });

  res.status(201).json(delivery);
}));

// GET /api/deliveries
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { unit, goodsType, status } = req.query;

  const where: Prisma.DeliveryRegistrationWhereInput = {};
  if (unit && typeof unit === 'string') where.receivingUnit = unit as ReceivingUnit;
  if (goodsType && typeof goodsType === 'string') where.goodsType = goodsType as GoodsType;
  if (status && typeof status === 'string') where.status = status as DeliveryStatus;

  const deliveries = await prisma.deliveryRegistration.findMany({
    where,
    include: { assignedSlot: true, unitGoodsType: { select: { id: true, name: true, emoji: true, baseType: true } }, _count: { select: { callLogs: true } } },
    orderBy: [{ checkinTime: 'asc' }, { createdAt: 'desc' }],
  });

  res.json(deliveries);
}));

// GET /api/deliveries/queue
router.get('/queue', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await getFullQueue());
}));

// PATCH /api/deliveries/check-in-lookup
router.patch('/check-in-lookup', asyncHandler(async (req: Request, res: Response) => {
  const { registrationCode, vehiclePlate } = req.body as {
    registrationCode?: string;
    vehiclePlate?: string;
  };

  if (!registrationCode && !vehiclePlate) {
    res.status(400).json({ error: 'Vui lòng nhập biển số hoặc mã đăng ký' });
    return;
  }

  const delivery = await prisma.deliveryRegistration.findFirst({
    where: registrationCode
      ? { registrationCode }
      : { vehiclePlate: vehiclePlate!.toUpperCase() },
    orderBy: { createdAt: 'desc' },
    include: { assignedSlot: true },
  });

  if (!delivery) {
    res.status(404).json({ error: 'Không tìm thấy lượt đăng ký.' });
    return;
  }

  if (delivery.status === DeliveryStatus.WAITING) {
    res.json(delivery);
    return;
  }
  if (delivery.status !== DeliveryStatus.REGISTERED) {
    res.status(400).json({
      error: 'Không thể check-in',
      message: `Xe ${delivery.vehiclePlate} đang ở trạng thái ${delivery.status}.`,
      delivery,
    });
    return;
  }

  if (!isScheduledForToday(delivery.requestedTime)) {
    res.status(400).json({
      error: `Lượt này được lên lịch vào ${formatVNDate(delivery.requestedTime!)}. Chỉ check-in đúng ngày.`,
    });
    return;
  }

  const checkInResult = await checkInDelivery({
    deliveryId: delivery.id,
    resultArgs: { include: { assignedSlot: true } },
  });

  if (!checkInResult.delivery) {
    res.status(404).json({ error: 'Không tìm thấy lượt đăng ký.' });
    return;
  }

  const { delivery: updated } = checkInResult;
  if (updated.status !== DeliveryStatus.WAITING) {
    res.status(409).json({
      error: 'Không thể check-in',
      message: `Xe ${updated.vehiclePlate} đang ở trạng thái ${updated.status}.`,
      delivery: updated,
    });
    return;
  }

  const queue = await getFullQueue();
  if (checkInResult.checkedIn) {
    emitQueueUpdated(queue);
    emitTrackUpdatesForQueue(queue).catch(console.error);
  }
  res.json(updated);

  if (checkInResult.checkedIn) {
    triggerAutoAssign(updated.receivingUnit).catch(console.error);
  }
}));

// GET /api/deliveries/:id
router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const delivery = await prisma.deliveryRegistration.findUnique({
    where: { id: req.params.id },
    include: {
      assignedSlot: true,
      callLogs: { include: { slot: true, calledByUser: true }, orderBy: { calledAt: 'desc' } },
      _count: { select: { callLogs: true } },
    },
  });
  if (!delivery) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(delivery);
}));

// PATCH /api/deliveries/:id/check-in
router.patch('/:id/check-in', asyncHandler(async (req: Request, res: Response) => {
  const delivery = await prisma.deliveryRegistration.findUnique({
    where: { id: req.params.id },
    include: { assignedSlot: true },
  });
  if (!delivery) { res.status(404).json({ error: 'Not found' }); return; }
  if (delivery.status === DeliveryStatus.WAITING) {
    res.json(delivery);
    return;
  }
  if (delivery.status !== DeliveryStatus.REGISTERED) {
    res.status(400).json({ error: 'Cannot check in delivery in current status', delivery }); return;
  }

  if (!isScheduledForToday(delivery.requestedTime)) {
    res.status(400).json({
      error: `Lượt này được lên lịch vào ${formatVNDate(delivery.requestedTime!)}. Chỉ check-in đúng ngày.`,
    });
    return;
  }

  const checkInResult = await checkInDelivery({
    deliveryId: delivery.id,
    resultArgs: { include: { assignedSlot: true } },
  });

  if (!checkInResult.delivery) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const { delivery: updated } = checkInResult;
  if (updated.status !== DeliveryStatus.WAITING) {
    res.status(409).json({ error: 'Cannot check in delivery in current status', delivery: updated });
    return;
  }

  const queue = await getFullQueue();
  if (checkInResult.checkedIn) {
    emitQueueUpdated(queue);
    emitTrackUpdatesForQueue(queue).catch(console.error);
  }
  res.json(updated);

  if (checkInResult.checkedIn) {
    triggerAutoAssign(updated.receivingUnit).catch(console.error);
  }
}));

const callSchema = z.object({ slotId: z.string() });

// PATCH /api/deliveries/:id/call
router.patch('/:id/call', authenticate, requireRole('ADMIN', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  const { slotId } = callSchema.parse(req.body);

  const result = await manualCallDelivery({
    deliveryId: req.params.id,
    slotId,
    calledByUserId: req.user!.id,
  });

  if (result.outcome === 'delivery_not_found') {
    res.status(404).json({ error: result.message });
    return;
  }
  if (result.outcome === 'slot_not_found') {
    res.status(404).json({ error: result.message, delivery: result.delivery });
    return;
  }
  if (!manualCallResultIsSuccess(result)) {
    const statusCode = result.outcome === 'invalid_status' ? 409 : 400;
    res.status(statusCode).json({
      error: result.message,
      delivery: result.delivery,
      slot: result.slot,
    });
    return;
  }

  const { delivery, slot, message } = result;
  if (result.callLogCreated) {
    const callCount = await prisma.callLog.count({ where: { deliveryRegistrationId: delivery.id } });
    const [queue, slots] = await Promise.all([getFullQueue(), getAllSlots()]);
    emitDeliveryCalled({
      id: delivery.id,
      vehiclePlate: delivery.vehiclePlate,
      slotCode: slot.code,
      slotName: slot.name,
      message,
      receivingUnit: delivery.receivingUnit,
      callCount,
      ticketCode: delivery.ticketNumber
        ? formatTicketCode(delivery.receivingUnit, delivery.vehicleType, delivery.ticketNumber)
        : undefined,
    });
    emitQueueUpdated(queue);
    emitSlotUpdated(slots);
    emitTrackUpdatesForQueue(queue).catch(console.error);
  }

  res.json(delivery);

  if (result.callLogCreated) {
    sendPushToDelivery(delivery.registrationCode, {
      title: `🚛 Mời vào ${slot.code}`,
      body: `Xe ${delivery.vehiclePlate} — ${slot.name}. Vui lòng vào ngay!`,
      tag: 'delivery-called-manual',
      url: `/track/${delivery.registrationCode}`,
    }).catch(console.error);
  }
}));

// PATCH /api/deliveries/:id/start-receiving
router.patch('/:id/start-receiving', authenticate, requireRole('ADMIN', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  const delivery = await prisma.deliveryRegistration.findUnique({ where: { id: req.params.id } });
  if (!delivery) { res.status(404).json({ error: 'Not found' }); return; }
  if (delivery.status !== DeliveryStatus.CALLED) {
    res.status(400).json({ error: 'Delivery must be in CALLED status' }); return;
  }

  const newStatus = delivery.autoWarehouse ? DeliveryStatus.AUTO_WAREHOUSE_RECEIVING : DeliveryStatus.RECEIVING;

  const updated = await prisma.deliveryRegistration.update({
    where: { id: req.params.id },
    data: { status: newStatus, receivingStartTime: new Date() },
    include: { assignedSlot: true },
  });

  const queue = await getFullQueue();
  emitQueueUpdated(queue);
  emitTrackUpdatesForQueue(queue).catch(console.error);
  res.json(updated);

  // Send push notification to driver
  const slotName = updated.assignedSlot?.name ?? 'dock';
  sendPushToDelivery(delivery.registrationCode, {
    title: '📦 Bắt đầu giao hàng',
    body: `Xe ${delivery.vehiclePlate} tại ${slotName}`,
    tag: 'delivery-receiving-started',
    url: `/track/${delivery.registrationCode}`,
  }).catch(console.error);
}));

// PATCH /api/deliveries/:id/complete
router.patch('/:id/complete', authenticate, requireRole('ADMIN', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  const delivery = await prisma.deliveryRegistration.findUnique({ where: { id: req.params.id } });
  if (!delivery) { res.status(404).json({ error: 'Not found' }); return; }

  const completableStatuses: DeliveryStatus[] = [
    DeliveryStatus.RECEIVING,
    DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
    DeliveryStatus.CALLED,
  ];
  if (!completableStatuses.includes(delivery.status)) {
    res.status(400).json({ error: 'Cannot complete delivery in current status' }); return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.deliveryRegistration.update({
      where: { id: req.params.id },
      data: { status: DeliveryStatus.COMPLETED, completedTime: new Date() },
    });
    if (delivery.assignedSlotId) {
      const remainingCount = await tx.deliveryRegistration.count({
        where: {
          assignedSlotId: delivery.assignedSlotId,
          id: { not: req.params.id },
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
          status: remainingCount < (slotRecord?.maxCapacity ?? 1) ? 'AVAILABLE' : 'OCCUPIED',
          currentDeliveryId: remainingCount === 0 ? null : undefined,
        },
      });
    }
  });

  const [queue, slots] = await Promise.all([getFullQueue(), getAllSlots()]);
  emitDeliveryCompleted(req.params.id);
  emitQueueUpdated(queue);
  emitSlotUpdated(slots);
  emitTrackUpdated(delivery.registrationCode).catch(console.error);
  emitTrackUpdatesForQueue(queue).catch(console.error);

  res.json({ success: true });

  // Send push notification to driver
  sendPushToDelivery(delivery.registrationCode, {
    title: '🎉 Giao hàng hoàn tất',
    body: `Xe ${delivery.vehiclePlate} — Cảm ơn bạn đã giao hàng!`,
    tag: 'delivery-completed',
    url: `/track/${delivery.registrationCode}`,
  }).catch(console.error);

  triggerAutoAssign(delivery.receivingUnit).catch(console.error);
}));

// PATCH /api/deliveries/:id/cancel
router.patch('/:id/cancel', authenticate, requireRole('ADMIN', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  const delivery = await prisma.deliveryRegistration.findUnique({ where: { id: req.params.id } });
  if (!delivery) { res.status(404).json({ error: 'Not found' }); return; }

  const nonCancellableStatuses: DeliveryStatus[] = [DeliveryStatus.COMPLETED, DeliveryStatus.CANCELLED];
  if (nonCancellableStatuses.includes(delivery.status)) {
    res.status(400).json({ error: 'Cannot cancel completed or already cancelled delivery' }); return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.deliveryRegistration.update({
      where: { id: req.params.id },
      data: { status: DeliveryStatus.CANCELLED },
    });
    if (delivery.assignedSlotId) {
      const remainingCount = await tx.deliveryRegistration.count({
        where: {
          assignedSlotId: delivery.assignedSlotId,
          id: { not: req.params.id },
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
          status: remainingCount < (slotRecord?.maxCapacity ?? 1) ? 'AVAILABLE' : 'OCCUPIED',
          currentDeliveryId: remainingCount === 0 ? null : undefined,
        },
      });
    }
  });

  const [queue, slots] = await Promise.all([getFullQueue(), getAllSlots()]);
  emitQueueUpdated(queue);
  emitSlotUpdated(slots);
  emitTrackUpdated(delivery.registrationCode).catch(console.error);
  emitTrackUpdatesForQueue(queue).catch(console.error);

  res.json({ success: true });

  sendPushToDelivery(delivery.registrationCode, {
    title: '❌ Lượt giao hàng đã hủy',
    body: `Xe ${delivery.vehiclePlate} — vui lòng liên hệ nhân viên nếu cần hỗ trợ.`,
    tag: 'delivery-cancelled',
    url: `/track/${delivery.registrationCode}`,
  }).catch(console.error);

  if (delivery.assignedSlotId) {
    triggerAutoAssign(delivery.receivingUnit).catch(console.error);
  }
}));

export default router;
