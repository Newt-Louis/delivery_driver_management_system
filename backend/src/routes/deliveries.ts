import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { DeliveryStatus, GoodsType, ReceivingUnit, VehicleType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole, enforceScope, enforceResourceScope } from '../middleware/auth';
import { triggerAutoAssign } from '../services/autoAssign';
import { sendPushToDelivery } from '../services/webPush';
import { emitTrackUpdated, emitTrackUpdatesForQueue } from '../services/trackRealtime';
import { formatTicketCode } from './track';
import { isScheduledForToday, formatVNDate } from '../lib/dateVN';
import { getUnitConfigForDefaultLocation } from '../lib/businessLocation';
import { checkInDelivery } from '../services/checkInDelivery';
import { manualCallDelivery, manualCallResultIsSuccess } from '../services/manualCallDelivery';
import { cancelDelivery, completeDelivery } from '../services/deliveryLifecycle';
import { getScopeForDelivery } from '../services/realtimeScope';
import { recordAuditLog, systemActor, userActor } from '../services/auditLog';
import { reserveRegistrationCode } from '../services/registrationSequence';
import { publicWriteLimiter } from '../middleware/rateLimit';
import {
  emitQueueUpdated,
  emitDeliveryCalled,
  emitSlotUpdated,
  emitDeliveryCompleted,
  type SocketScope,
} from '../socket';

const router = Router();

const ACTIVE_DUPLICATE_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.REGISTERED,
  DeliveryStatus.WAITING,
  DeliveryStatus.CALLED,
  DeliveryStatus.RECEIVING,
  DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
];

function normalizeVehiclePlate(value: string): string {
  return value.trim().toUpperCase();
}

async function findActiveDeliveryByPlate(vehiclePlate: string) {
  return prisma.deliveryRegistration.findFirst({
    where: {
      vehiclePlate,
      status: { in: ACTIVE_DUPLICATE_STATUSES },
    },
    orderBy: { createdAt: 'desc' },
  });
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function sendDuplicateRegistration(
  res: Response,
  vehiclePlate: string,
  duplicate: Awaited<ReturnType<typeof findActiveDeliveryByPlate>>,
) {
  res.status(409).json({
    error: 'Duplicate',
    message: `Bien so ${vehiclePlate} da co luot dang ky dang hoat dong (${duplicate?.registrationCode ?? 'dang xu ly'}).`,
    delivery: duplicate,
  });
}
class SlotFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlotFullError';
  }
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localTimeKey(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function localDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
function advisoryLockId(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

async function getRegistrationSlotCapacity(unit: ReceivingUnit, vehicleType: VehicleType): Promise<number | null> {
  const config = await getUnitConfigForDefaultLocation(unit);
  if (!config) return null;
  return vehicleType === VehicleType.MOTORBIKE ? config.motorbikeMaxPerSlot : config.truckMaxPerSlot;
}

async function resolveScopedUnits(scope?: SocketScope): Promise<ReceivingUnit[]> {
  if (!scope?.businessLocationId && !scope?.unitConfigId) return [];

  const unitConfigs = await prisma.unitConfig.findMany({
    where: {
      ...(scope.unitConfigId ? { id: scope.unitConfigId } : {}),
      ...(scope.businessLocationId ? { businessLocationId: scope.businessLocationId } : {}),
    },
    select: { unit: true },
  });

  return [...new Set(unitConfigs.map((cfg) => cfg.unit))];
}

async function ensureRegistrationSlotCapacity(
  tx: Prisma.TransactionClient,
  args: {
    requestedTime: Date;
    receivingUnit: ReceivingUnit;
    vehicleType: VehicleType;
    goodsType: GoodsType;
    maxPerSlot: number | null;
  },
): Promise<void> {
  if (args.maxPerSlot === null) return;

  const dateKey = localDateKey(args.requestedTime);
  const timeKey = localTimeKey(args.requestedTime);
  const lockKey = [
    'registration-slot',
    args.receivingUnit,
    args.vehicleType,
    args.goodsType,
    dateKey,
    timeKey,
  ].join(':');

  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${advisoryLockId(lockKey)})`);

  const { start, end } = localDayRange(args.requestedTime);
  const bookings = await tx.deliveryRegistration.findMany({
    where: {
      receivingUnit: args.receivingUnit,
      vehicleType: args.vehicleType,
      goodsType: args.goodsType,
      status: DeliveryStatus.REGISTERED,
      requestedTime: { gte: start, lt: end },
    },
    select: { requestedTime: true },
  });

  const booked = bookings.filter((booking) => (
    booking.requestedTime
    && localTimeKey(booking.requestedTime) === timeKey
  )).length;

  if (booked >= args.maxPerSlot) {
    throw new SlotFullError(`Khung gio ${timeKey} ngay ${dateKey} da het cho. Vui long chon khung gio khac.`);
  }
}
async function queueWhereForScope(scope?: SocketScope): Promise<Prisma.DeliveryRegistrationWhereInput> {
  const activeStatus = {
    in: [
      DeliveryStatus.WAITING,
      DeliveryStatus.CALLED,
      DeliveryStatus.RECEIVING,
      DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
    ],
  };

  if (!scope?.businessLocationId && !scope?.unitConfigId) {
    return { status: activeStatus };
  }

  const unitConfigs = await prisma.unitConfig.findMany({
    where: {
      ...(scope.unitConfigId ? { id: scope.unitConfigId } : {}),
      ...(scope.businessLocationId ? { businessLocationId: scope.businessLocationId } : {}),
    },
    select: { id: true, unit: true },
  });
  const units = [...new Set(unitConfigs.map((cfg) => cfg.unit))];

  return {
    status: activeStatus,
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
}

export async function getFullQueue(scope?: SocketScope) {
  return prisma.deliveryRegistration.findMany({
    where: await queueWhereForScope(scope),
    include: {
      assignedSlot: { include: { zone: { include: { unitConfig: { select: { id: true, unit: true, businessLocationId: true } } } } } },
      callLogs: { orderBy: { calledAt: 'desc' }, take: 1 },
      _count: { select: { callLogs: true } },
    },
    orderBy: [{ checkinTime: 'asc' }],
  });
}

export async function getAllSlots(scope?: SocketScope) {
  return prisma.slot.findMany({
    where: {
      isActive: true,
      zone: {
        ...(scope?.unitConfigId ? { unitConfigId: scope.unitConfigId } : {}),
        ...(scope?.businessLocationId ? { unitConfig: { businessLocationId: scope.businessLocationId } } : {}),
      },
    },
    orderBy: [{ assignedUnit: 'asc' }, { vehicleType: 'asc' }, { code: 'asc' }],
    include: {
      zone: { select: { id: true, code: true, name: true, unitConfig: { select: { id: true, unit: true, businessLocationId: true } } } },
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
  deliveryDate: z.string().optional(),
  note: z.string().optional(),
});

function isSundayDeliveryDate(requestedTime?: Date | null, deliveryDate?: string): boolean {
  if (requestedTime) {
    return requestedTime.getDay() === 0;
  }
  if (!deliveryDate) return false;

  const [year, month, day] = deliveryDate.split('-').map(Number);
  if (!year || !month || !day) return false;
  return new Date(year, month - 1, day).getDay() === 0;
}

// POST /api/deliveries/auto-dispatch/:unit  — manually trigger auto-assign for a unit
router.post('/auto-dispatch/:unit', authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
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
router.post('/register', publicWriteLimiter, asyncHandler(async (req: Request, res: Response) => {
  const body = registerSchema.parse(req.body);
  const vehiclePlate = normalizeVehiclePlate(body.vehiclePlate);

  if (!vehiclePlate) {
    res.status(400).json({ error: 'Bien so xe bat buoc' });
    return;
  }

  const duplicate = await findActiveDeliveryByPlate(vehiclePlate);
  if (duplicate) {
    sendDuplicateRegistration(res, vehiclePlate, duplicate);
    return;
  }

  const requestedTime = body.requestedTime ? new Date(body.requestedTime) : null;

  if (requestedTime && Number.isNaN(requestedTime.getTime())) {
    res.status(400).json({ error: 'Thoi gian giao hang khong hop le' });
    return;
  }

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

  const config = await getUnitConfigForDefaultLocation(body.receivingUnit);
  if (
    config?.sundayFreshFoodOnly
    && isSundayDeliveryDate(requestedTime, body.deliveryDate)
    && resolvedGoodsType !== GoodsType.FRESH_FOOD
  ) {
    res.status(422).json({
      error: 'SundayFreshFoodOnly',
      message: 'Chủ nhật chỉ nhận hàng tươi sống',
    });
    return;
  }

  const maxPerSlot = requestedTime
    ? await getRegistrationSlotCapacity(body.receivingUnit, body.vehicleType)
    : null;

  try {
    const delivery = await prisma.$transaction(async (tx) => {
      if (requestedTime) {
        await ensureRegistrationSlotCapacity(tx, {
          requestedTime,
          receivingUnit: body.receivingUnit,
          vehicleType: body.vehicleType,
          goodsType: resolvedGoodsType,
          maxPerSlot,
        });
      }

      const registrationCode = await reserveRegistrationCode(tx, body.receivingUnit);

      return tx.deliveryRegistration.create({
        data: {
          registrationCode,
          vendorName: body.vendorName,
          driverName: body.driverName,
          driverPhone: body.driverPhone,
          vehiclePlate,
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
    });

    res.status(201).json(delivery);
  } catch (error) {
    if (error instanceof SlotFullError) {
      res.status(409).json({ error: 'SlotFull', message: error.message });
      return;
    }

    if (isUniqueConstraintError(error)) {
      const activeDuplicate = await findActiveDeliveryByPlate(vehiclePlate);
      if (activeDuplicate) {
        sendDuplicateRegistration(res, vehiclePlate, activeDuplicate);
        return;
      }
    }
    throw error;
  }
}));

// GET /api/deliveries
router.get('/', authenticate, enforceScope, asyncHandler(async (req: Request, res: Response) => {
  const { unit, goodsType, status } = req.query;

  const scopedUnits = await resolveScopedUnits(req.scope);
  const where: Prisma.DeliveryRegistrationWhereInput = {};
  if (unit && typeof unit === 'string') {
    const requestedUnit = unit as ReceivingUnit;
    if (scopedUnits.length > 0 && !scopedUnits.includes(requestedUnit)) {
      res.json([]);
      return;
    }
    where.receivingUnit = requestedUnit;
  } else if (scopedUnits.length > 0) {
    where.receivingUnit = { in: scopedUnits };
  }
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
router.get('/queue', enforceScope, asyncHandler(async (req: Request, res: Response) => {
  res.json(await getFullQueue(req.scope));
}));

// PATCH /api/deliveries/check-in-lookup
router.patch('/check-in-lookup', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'CHECKIN'), asyncHandler(async (req: Request, res: Response) => {
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

  const deliveryScope = await getScopeForDelivery(delivery);
  if (!enforceResourceScope(req, res, deliveryScope.businessLocationId)) return;

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

  if (checkInResult.checkedIn) {
    const scope = await getScopeForDelivery(updated);
    const queue = await getFullQueue(scope);
    await recordAuditLog({
      ...systemActor('public-check-in-route'),
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
      metadata: { source: 'deliveries.check-in-lookup' },
    });
    emitQueueUpdated(queue, scope);
    emitTrackUpdatesForQueue(queue).catch(console.error);
  }
  res.json(updated);

  if (checkInResult.checkedIn) {
    triggerAutoAssign(updated.receivingUnit, await getScopeForDelivery(updated)).catch(console.error);
  }
}));

// GET /api/deliveries/:id
router.get('/:id', authenticate, enforceScope, asyncHandler(async (req: Request, res: Response) => {
  const delivery = await prisma.deliveryRegistration.findUnique({
    where: { id: req.params.id },
    include: {
      assignedSlot: true,
      callLogs: { include: { slot: true, calledByUser: true }, orderBy: { calledAt: 'desc' } },
      _count: { select: { callLogs: true } },
    },
  });
  if (!delivery) { res.status(404).json({ error: 'Not found' }); return; }
  const deliveryScope = await getScopeForDelivery(delivery);
  if (!enforceResourceScope(req, res, deliveryScope.businessLocationId)) return;
  res.json(delivery);
}));

// PATCH /api/deliveries/:id/check-in
router.patch('/:id/check-in', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'CHECKIN'), asyncHandler(async (req: Request, res: Response) => {
  const delivery = await prisma.deliveryRegistration.findUnique({
    where: { id: req.params.id },
    include: { assignedSlot: true },
  });
  if (!delivery) { res.status(404).json({ error: 'Not found' }); return; }
  const deliveryScope = await getScopeForDelivery(delivery);
  if (!enforceResourceScope(req, res, deliveryScope.businessLocationId)) return;
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

  if (checkInResult.checkedIn) {
    const scope = await getScopeForDelivery(updated);
    const queue = await getFullQueue(scope);
    await recordAuditLog({
      ...systemActor('public-check-in-route'),
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
      metadata: { source: 'deliveries.id-check-in' },
    });
    emitQueueUpdated(queue, scope);
    emitTrackUpdatesForQueue(queue).catch(console.error);
  }
  res.json(updated);

  if (checkInResult.checkedIn) {
    triggerAutoAssign(updated.receivingUnit, await getScopeForDelivery(updated)).catch(console.error);
  }
}));

const callSchema = z.object({ slotId: z.string() });

// PATCH /api/deliveries/:id/call
router.patch('/:id/call', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
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

  // Scope check: verify delivery belongs to user's scope
  if (result.delivery) {
    const deliveryScope = await getScopeForDelivery(result.delivery);
    if (!enforceResourceScope(req, res, deliveryScope.businessLocationId)) return;
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
    const scope = await getScopeForDelivery({ ...delivery, assignedSlotId: slot.id });
    await recordAuditLog({
      ...userActor(req.user),
      action: 'delivery.manual_call',
      targetType: 'DeliveryRegistration',
      targetId: delivery.id,
      businessLocationId: scope.businessLocationId,
      unitConfigId: scope.unitConfigId,
      after: {
        status: delivery.status,
        registrationCode: delivery.registrationCode,
        vehiclePlate: delivery.vehiclePlate,
        assignedSlotId: slot.id,
        calledTime: delivery.calledTime?.toISOString() ?? null,
      },
      metadata: {
        slotId: slot.id,
        slotCode: slot.code,
        source: 'deliveries.manual-call',
      },
    });
    const [queue, slots] = await Promise.all([getFullQueue(scope), getAllSlots(scope)]);
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
    }, scope);
    emitQueueUpdated(queue, scope);
    emitSlotUpdated(slots, scope);
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
router.patch('/:id/start-receiving', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  const delivery = await prisma.deliveryRegistration.findUnique({ where: { id: req.params.id } });
  if (!delivery) { res.status(404).json({ error: 'Not found' }); return; }

  const deliveryScope = await getScopeForDelivery(delivery);
  if (!enforceResourceScope(req, res, deliveryScope.businessLocationId)) return;

  if (delivery.status !== DeliveryStatus.CALLED) {
    res.status(400).json({ error: 'Delivery must be in CALLED status' }); return;
  }

  const newStatus = delivery.autoWarehouse ? DeliveryStatus.AUTO_WAREHOUSE_RECEIVING : DeliveryStatus.RECEIVING;

  const updated = await prisma.deliveryRegistration.update({
    where: { id: req.params.id },
    data: { status: newStatus, receivingStartTime: new Date() },
    include: { assignedSlot: true },
  });

  const scope = await getScopeForDelivery(updated);
  const queue = await getFullQueue(scope);
  await recordAuditLog({
    ...userActor(req.user),
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
    metadata: { source: 'deliveries.start-receiving' },
  });
  emitQueueUpdated(queue, scope);
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
router.patch('/:id/complete', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  // Scope check: verify delivery belongs to user's scope before operating
  const preDelivery = await prisma.deliveryRegistration.findUnique({
    where: { id: req.params.id },
    select: { id: true, receivingUnit: true, assignedSlotId: true },
  });
  if (preDelivery) {
    const preScope = await getScopeForDelivery(preDelivery);
    if (!enforceResourceScope(req, res, preScope.businessLocationId)) return;
  }

  const result = await completeDelivery(req.params.id);
  if (!result.delivery) { res.status(404).json({ error: 'Not found' }); return; }
  if (result.outcome === 'invalid_status') {
    res.status(409).json({ error: 'Cannot complete delivery in current status', delivery: result.delivery });
    return;
  }

  const scope = await getScopeForDelivery(result.delivery);
  const [queue, slots] = await Promise.all([getFullQueue(scope), getAllSlots(scope)]);
  if (result.changed) {
    await recordAuditLog({
      ...userActor(req.user),
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
        source: 'deliveries.complete',
      },
    });
    emitDeliveryCompleted(req.params.id, scope);
    emitQueueUpdated(queue, scope);
    emitSlotUpdated(slots, scope);
    emitTrackUpdated(result.delivery.registrationCode).catch(console.error);
    emitTrackUpdatesForQueue(queue).catch(console.error);
  }

  res.json({ success: true, delivery: result.delivery, idempotent: !result.changed });

  if (result.changed) {
    sendPushToDelivery(result.delivery.registrationCode, {
      title: '🎉 Giao hàng hoàn tất',
      body: `Xe ${result.delivery.vehiclePlate} — Cảm ơn bạn đã giao hàng!`,
      tag: 'delivery-completed',
      url: `/track/${result.delivery.registrationCode}`,
    }).catch(console.error);

    triggerAutoAssign(result.delivery.receivingUnit, scope).catch(console.error);
  }
}));

// PATCH /api/deliveries/:id/cancel
router.patch('/:id/cancel', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'), asyncHandler(async (req: Request, res: Response) => {
  // Scope check: verify delivery belongs to user's scope before operating
  const preDelivery = await prisma.deliveryRegistration.findUnique({
    where: { id: req.params.id },
    select: { id: true, receivingUnit: true, assignedSlotId: true },
  });
  if (preDelivery) {
    const preScope = await getScopeForDelivery(preDelivery);
    if (!enforceResourceScope(req, res, preScope.businessLocationId)) return;
  }

  const result = await cancelDelivery(req.params.id);
  if (!result.delivery) { res.status(404).json({ error: 'Not found' }); return; }
  if (result.outcome === 'invalid_status') {
    res.status(409).json({ error: 'Cannot cancel delivery in current status', delivery: result.delivery });
    return;
  }

  const scope = await getScopeForDelivery(result.delivery);
  const [queue, slots] = await Promise.all([getFullQueue(scope), getAllSlots(scope)]);
  if (result.changed) {
    await recordAuditLog({
      ...userActor(req.user),
      action: 'delivery.cancel',
      targetType: 'DeliveryRegistration',
      targetId: result.delivery.id,
      businessLocationId: scope.businessLocationId,
      unitConfigId: scope.unitConfigId,
      after: {
        status: result.delivery.status,
        registrationCode: result.delivery.registrationCode,
        vehiclePlate: result.delivery.vehiclePlate,
      },
      metadata: {
        releasedSlotId: result.releasedSlotId,
        source: 'deliveries.cancel',
      },
    });
    emitQueueUpdated(queue, scope);
    emitSlotUpdated(slots, scope);
    emitTrackUpdated(result.delivery.registrationCode).catch(console.error);
    emitTrackUpdatesForQueue(queue).catch(console.error);
  }

  res.json({ success: true, delivery: result.delivery, idempotent: !result.changed });

  if (result.changed) {
    sendPushToDelivery(result.delivery.registrationCode, {
      title: '❌ Lượt giao hàng đã hủy',
      body: `Xe ${result.delivery.vehiclePlate} — vui lòng liên hệ nhân viên nếu cần hỗ trợ.`,
      tag: 'delivery-cancelled',
      url: `/track/${result.delivery.registrationCode}`,
    }).catch(console.error);

    if (result.releasedSlotId) {
      triggerAutoAssign(result.delivery.receivingUnit, scope).catch(console.error);
    }
  }
}));

export default router;
