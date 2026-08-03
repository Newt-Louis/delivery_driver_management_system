import { ReceivingUnit, type ReceivingUnit as ReceivingUnitCode } from '../../domain/unitCodes';
import { DeliveryHistoryEventType, DeliveryHistoryFinalStatus, DeliveryStatus, GoodsType, Prisma } from '@prisma/client';
import type { AuthUser } from '../../middleware/auth';
import { formatVNDate, isScheduledForToday } from '../../lib/dateVN';
import { getUnitConfigForDefaultLocation } from '../../lib/businessLocation';
import { emitDeliveryCalled, emitDeliveryCompleted, emitQueueUpdated, emitSlotUpdated, type SocketScope } from '../../socket';
import { recordAuditLog, systemActor, userActor } from '../../services/auditLog';
import { triggerAutoAssign } from '../../services/autoAssign';
import { checkInDelivery } from '../../services/checkInDelivery';
import { cancelDelivery, completeDelivery } from '../../services/deliveryLifecycle';
import { manualCallDelivery, manualCallResultIsSuccess } from '../../services/manualCallDelivery';
import { getScopeForDelivery } from '../../services/realtimeScope';
import { roleHasUnitOperationScope } from '../../domain/permissions';
import { reserveRegistrationCode } from '../../services/registrationSequence';
import { emitTrackUpdated, emitTrackUpdatesForQueue } from '../../services/trackRealtime';
import { getUserUnitPermissions } from '../../services/unitPermission';
import { sendPushToDelivery } from '../../services/webPush';
import { formatTicketCode } from '../../routes/track';
import { archiveDelivery } from '../history/archiveService';
import { countCallHistoryEvents, listDeliveryHistoryEvents } from '../history/historyRepository';
import { recordDeliveryEvent } from '../history/historyService';
import { domainError } from '../shared/domainError';
import { isKnownMockOrderCode } from '../units/orderCodeMock';
import type { CheckInLookupPayload, PublicCancelPayload, RegisterDeliveryPayload } from './deliveryFormRequest';
import * as deliveryRepository from './deliveryRepository';

class SlotFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlotFullError';
  }
}

function assertResourceAccess(user: AuthUser | undefined, businessLocationId: string | null | undefined) {
  if (!user) throw domainError.unauthorized();
  if (user.role === 'SUPERADMIN') return;
  if (!businessLocationId) {
    throw domainError.forbidden('Không thể xác định khu vực của tài nguyên này.');
  }
  if (businessLocationId !== user.businessLocationId) {
    throw domainError.forbidden('Tài nguyên không thuộc khu vực của bạn.');
  }
}

async function assertUnitPermission(user: AuthUser | undefined, receivingUnit: ReceivingUnitCode, operation: 'checkin' | 'receiving') {
  if (!user) throw domainError.unauthorized();
  if (!roleHasUnitOperationScope(user.role)) return;

  if (!user.businessLocationId) {
    throw domainError.forbidden('Tài khoản chưa được gán khu vực hoạt động.');
  }

  const allowedUnits = await getUserUnitPermissions(user.id);
  const allowed = allowedUnits.some((unit) => (
    unit.businessLocationId === user.businessLocationId
    && unit.unit === receivingUnit
  ));

  if (!allowed) {
    throw domainError.forbidden('Bạn không có quyền thao tác trên đơn vị này.', { receivingUnit });
  }
}

async function ensureDeliveryAccess(
  user: AuthUser | undefined,
  delivery: { receivingUnit: ReceivingUnitCode; assignedSlotId?: string | null },
  operation: 'checkin' | 'receiving',
) {
  const scope = await getScopeForDelivery(delivery);
  assertResourceAccess(user, scope.businessLocationId);
  await assertUnitPermission(user, delivery.receivingUnit, operation);
  return scope;
}

function isSundayDeliveryDate(requestedTime?: Date | null, deliveryDate?: string): boolean {
  if (requestedTime) return requestedTime.getDay() === 0;
  if (!deliveryDate) return false;

  const [year, month, day] = deliveryDate.split('-').map(Number);
  if (!year || !month || !day) return false;
  return new Date(year, month - 1, day).getDay() === 0;
}

async function ensureRegistrationSlotCapacity(
  tx: Prisma.TransactionClient,
  args: {
    requestedTime: Date;
    receivingUnit: ReceivingUnitCode;
    vehicleType: RegisterDeliveryPayload['vehicleType'];
    maxPerSlot: number | null;
  },
): Promise<void> {
  if (args.maxPerSlot === null) return;

  const dateKey = deliveryRepository.localDateKey(args.requestedTime);
  const timeKey = deliveryRepository.localTimeKey(args.requestedTime);
  const lockKey = [
    'registration-slot',
    args.receivingUnit,
    args.vehicleType,
    dateKey,
    timeKey,
  ].join(':');

  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${deliveryRepository.advisoryLockId(lockKey)})`);

  const { start, end } = deliveryRepository.localDayRange(args.requestedTime);
  const bookings = await tx.deliveryRegistration.findMany({
    where: {
      receivingUnit: args.receivingUnit,
      vehicleType: args.vehicleType,
      status: {
        in: [
          DeliveryStatus.REGISTERED,
          DeliveryStatus.WAITING,
          DeliveryStatus.CALLED,
          DeliveryStatus.RECEIVING,
          DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
        ],
      },
      requestedTime: { gte: start, lt: end },
    },
    select: { requestedTime: true },
  });

  const booked = bookings.filter((booking) => (
    booking.requestedTime
    && deliveryRepository.localTimeKey(booking.requestedTime) === timeKey
  )).length;

  if (booked >= args.maxPerSlot) {
    throw new SlotFullError(`Khung gio ${timeKey} ngay ${dateKey} da het cho. Vui long chon khung gio khac.`);
  }
}

function duplicateRegistration(vehiclePlate: string, duplicate: unknown) {
  throw domainError.conflict(
    `Xe ${vehiclePlate} đã có lượt đăng ký trùng thông tin trong ngày giao đã chọn (${(duplicate as { registrationCode?: string } | null)?.registrationCode ?? 'đang xử lý'}).`,
    'Duplicate',
    { delivery: duplicate as Record<string, unknown> },
  );
}

const PUBLIC_CANCEL_REASON = 'Tài xế thao tác hủy';
const PUBLIC_CANCEL_MISMATCH_MESSAGE = 'Có thông tin bạn nhập không đúng, vui lòng nhập lại';

function parseRequestedTime(value: string | undefined): Date | null {
  const requestedTime = value ? new Date(value) : null;
  if (requestedTime && Number.isNaN(requestedTime.getTime())) {
    throw domainError.badRequest('Thoi gian giao hang khong hop le');
  }
  return requestedTime;
}

export async function autoDispatch(unit: ReceivingUnitCode, user: AuthUser | undefined) {
  await assertUnitPermission(user, unit, 'receiving');

  const called = await triggerAutoAssign(unit);
  return {
    called,
    message: called > 0 ? `Đã điều phối ${called} xe vào vị trí` : 'Không có xe nào phù hợp để điều phối',
  };
}

export async function registerDelivery(body: RegisterDeliveryPayload) {
  const vehiclePlate = deliveryRepository.normalizeVehiclePlate(body.vehiclePlate);
  if (!vehiclePlate) {
    throw domainError.badRequest('Bien so xe bat buoc');
  }

  const driverPhone = deliveryRepository.normalizeDriverPhone(body.driverPhone);
  const poNumber = deliveryRepository.normalizeOrderCode(body.poNumber);
  if (!driverPhone || driverPhone.length < 9) {
    throw domainError.badRequest('Số điện thoại không hợp lệ');
  }
  if (!poNumber || !isKnownMockOrderCode(poNumber)) {
    throw domainError.badRequest('Mã PO/Thi Công không hợp lệ');
  }

  const requestedTime = parseRequestedTime(body.requestedTime);
  const duplicate = await deliveryRepository.findDuplicateRegistration({
    vehiclePlate,
    driverPhone,
    poNumber,
    requestedTime,
    deliveryDate: body.deliveryDate,
  });
  if (duplicate) return duplicateRegistration(vehiclePlate, duplicate);

  let resolvedGoodsType = body.goodsType;
  let resolvedVendorCode: string | undefined;
  if (body.vendorCode?.trim()) {
    const normalized = body.vendorCode.toUpperCase().trim();
    const awv = await deliveryRepository.findAutoWarehouseVendor(normalized, body.receivingUnit);
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
    throw domainError.unprocessable('Chủ nhật chỉ nhận hàng tươi sống', 'SundayFreshFoodOnly');
  }

  const maxPerSlot = requestedTime
    ? await deliveryRepository.getRegistrationSlotCapacity(body.receivingUnit, body.vehicleType)
    : null;

  try {
    const delivery = await deliveryRepository.prisma.$transaction(async (tx) => {
      if (requestedTime) {
        await ensureRegistrationSlotCapacity(tx, {
          requestedTime,
          receivingUnit: body.receivingUnit,
          vehicleType: body.vehicleType,
          maxPerSlot,
        });
      }

      const registrationCode = await reserveRegistrationCode(tx, body.receivingUnit);

      const created = await tx.deliveryRegistration.create({
        data: {
          registrationCode,
          vendorName: body.vendorName,
          driverName: body.driverName,
          driverPhone,
          vehiclePlate,
          vehicleType: body.vehicleType,
          receivingUnit: body.receivingUnit,
          goodsType: resolvedGoodsType,
          unitGoodsTypeId: resolvedGoodsType === GoodsType.AUTO_WAREHOUSE ? undefined : (body.unitGoodsTypeId || undefined),
          poNumber,
          vendorCode: resolvedVendorCode,
          requestedTime,
          autoWarehouse: resolvedGoodsType === GoodsType.AUTO_WAREHOUSE,
          note: body.note,
        },
      });

      await recordDeliveryEvent(created, {
        ...systemActor('public-register'),
        eventType: DeliveryHistoryEventType.REGISTERED,
        toStatus: created.status,
        occurredAt: created.createdAt,
        message: 'Đăng ký giao hàng',
      }, tx);

      return created;
    });

    return delivery;
  } catch (error) {
    if (error instanceof SlotFullError) {
      throw domainError.conflict(error.message, 'SlotFull');
    }

    if (deliveryRepository.isUniqueConstraintError(error)) {
      const activeDuplicate = await deliveryRepository.findDuplicateRegistration({
        vehiclePlate,
        driverPhone,
        poNumber,
        requestedTime,
        deliveryDate: body.deliveryDate,
      });
      if (activeDuplicate) return duplicateRegistration(vehiclePlate, activeDuplicate);
    }
    throw error;
  }
}

export async function publicCancel(body: PublicCancelPayload) {
  const vehiclePlate = deliveryRepository.normalizeVehiclePlate(body.vehiclePlate);
  const driverPhone = deliveryRepository.normalizeDriverPhone(body.driverPhone);
  const poNumber = deliveryRepository.normalizeOrderCode(body.poNumber);
  const requestedTime = parseRequestedTime(body.requestedTime);

  if (!requestedTime || !vehiclePlate || !driverPhone || !poNumber) {
    throw domainError.badRequest(PUBLIC_CANCEL_MISMATCH_MESSAGE);
  }

  const delivery = await deliveryRepository.findDeliveryForPublicCancel({
    registrationCode: body.registrationCode,
    vehiclePlate,
    driverPhone,
    poNumber,
    requestedTime,
  });
  if (!delivery) {
    throw domainError.badRequest(PUBLIC_CANCEL_MISMATCH_MESSAGE);
  }

  const actor = systemActor('public-driver-cancel');
  const result = await cancelDelivery(delivery.id, PUBLIC_CANCEL_REASON, actor);
  if (!result.delivery || result.outcome === 'invalid_status') {
    throw domainError.badRequest(PUBLIC_CANCEL_MISMATCH_MESSAGE);
  }

  const scope = await getScopeForDelivery(result.delivery);
  await recordAuditLog({
    ...actor,
    action: 'delivery.public_cancel',
    targetType: 'DeliveryRegistration',
    targetId: result.delivery.id,
    businessLocationId: scope.businessLocationId,
    unitConfigId: scope.unitConfigId,
    after: {
      status: result.delivery.status,
      registrationCode: result.delivery.registrationCode,
      vehiclePlate: result.delivery.vehiclePlate,
      cancelReason: PUBLIC_CANCEL_REASON,
    },
    metadata: { source: 'deliveries.public-cancel' },
  });

  await archiveDelivery({
    deliveryId: result.delivery.id,
    finalStatus: DeliveryHistoryFinalStatus.CANCELLED,
    archiveReason: 'CANCELLED',
    ...actor,
    closeReason: PUBLIC_CANCEL_REASON,
    deleteOperationalRow: true,
  });

  const [queue, slots] = await Promise.all([
    deliveryRepository.getFullQueue(scope),
    deliveryRepository.getAllSlots(scope),
  ]);
  emitQueueUpdated(queue, scope);
  emitSlotUpdated(slots, scope);
  emitTrackUpdated(result.delivery.registrationCode).catch(console.error);
  emitTrackUpdatesForQueue(queue).catch(console.error);
  if (result.releasedSlotId) {
    triggerAutoAssign(result.delivery.receivingUnit, scope).catch(console.error);
  }

  return { success: true, message: 'Hủy thành công' };
}

export function listDeliveries(args: Parameters<typeof deliveryRepository.listDeliveries>[0]) {
  return deliveryRepository.listDeliveries(args);
}

export function getQueue(scope?: SocketScope) {
  return deliveryRepository.getFullQueue(scope);
}

export async function checkInLookup(body: CheckInLookupPayload, user: AuthUser | undefined) {
  const { registrationCode, vehiclePlate } = body;
  if (!registrationCode && !vehiclePlate) {
    throw domainError.badRequest('Vui lòng nhập biển số hoặc mã đăng ký');
  }

  const delivery = await deliveryRepository.findDeliveryByLookup({ registrationCode, vehiclePlate });
  if (!delivery) throw domainError.notFound('Không tìm thấy lượt đăng ký.');

  await ensureDeliveryAccess(user, delivery, 'checkin');

  if (delivery.status === DeliveryStatus.WAITING) return delivery;
  if (delivery.status !== DeliveryStatus.REGISTERED) {
    throw domainError.badRequest(
      `Xe ${delivery.vehiclePlate} đang ở trạng thái ${delivery.status}.`,
      'Không thể check-in',
      { delivery },
    );
  }

  if (!isScheduledForToday(delivery.requestedTime)) {
    throw domainError.badRequest(`Lượt này được lên lịch vào ${formatVNDate(delivery.requestedTime!)}. Chỉ check-in đúng ngày.`);
  }

  const checkInResult = await checkInDelivery({
    deliveryId: delivery.id,
    resultArgs: { include: { assignedSlot: true } },
    actor: userActor(user),
  });

  if (!checkInResult.delivery) throw domainError.notFound('Không tìm thấy lượt đăng ký.');

  const { delivery: updated } = checkInResult;
  if (updated.status !== DeliveryStatus.WAITING) {
    throw domainError.conflict(
      `Xe ${updated.vehiclePlate} đang ở trạng thái ${updated.status}.`,
      'Không thể check-in',
      { delivery: updated },
    );
  }

  if (checkInResult.checkedIn) {
    const scope = await getScopeForDelivery(updated);
    const queue = await deliveryRepository.getFullQueue(scope);
    await recordAuditLog({
      ...userActor(user),
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
    triggerAutoAssign(updated.receivingUnit, scope).catch(console.error);
  }

  return updated;
}

export async function getDeliveryDetails(id: string, user: AuthUser | undefined) {
  const delivery = await deliveryRepository.findDeliveryWithSlot(id);
  if (!delivery) throw domainError.notFound('Not found');

  await ensureDeliveryAccess(user, delivery, 'checkin');

  const [callCount, historyEvents] = await Promise.all([
    countCallHistoryEvents(delivery.id),
    listDeliveryHistoryEvents({ originalDeliveryId: delivery.id }),
  ]);
  return { ...delivery, callCount, historyEvents };
}

export async function checkInById(id: string, user: AuthUser | undefined) {
  const delivery = await deliveryRepository.findDeliveryWithSlot(id);
  if (!delivery) throw domainError.notFound('Not found');

  await ensureDeliveryAccess(user, delivery, 'checkin');

  if (delivery.status === DeliveryStatus.WAITING) return delivery;
  if (delivery.status !== DeliveryStatus.REGISTERED) {
    throw domainError.badRequest('Cannot check in delivery in current status', 'Cannot check in delivery in current status', { delivery });
  }

  if (!isScheduledForToday(delivery.requestedTime)) {
    throw domainError.badRequest(`Lượt này được lên lịch vào ${formatVNDate(delivery.requestedTime!)}. Chỉ check-in đúng ngày.`);
  }

  const checkInResult = await checkInDelivery({
    deliveryId: delivery.id,
    resultArgs: { include: { assignedSlot: true } },
    actor: userActor(user),
  });

  if (!checkInResult.delivery) throw domainError.notFound('Not found');

  const { delivery: updated } = checkInResult;
  if (updated.status !== DeliveryStatus.WAITING) {
    throw domainError.conflict('Cannot check in delivery in current status', 'Cannot check in delivery in current status', { delivery: updated });
  }

  if (checkInResult.checkedIn) {
    const scope = await getScopeForDelivery(updated);
    const queue = await deliveryRepository.getFullQueue(scope);
    await recordAuditLog({
      ...userActor(user),
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
    triggerAutoAssign(updated.receivingUnit, scope).catch(console.error);
  }
  return updated;
}

export async function callDelivery(id: string, slotId: string, user: AuthUser | undefined) {
  const result = await manualCallDelivery({
    deliveryId: id,
    slotId,
    calledByUserId: user!.id,
    actor: userActor(user),
  });

  if (result.outcome === 'delivery_not_found') throw domainError.notFound(result.message);
  if (result.outcome === 'slot_not_found') {
    throw domainError.notFound(result.message, { delivery: result.delivery });
  }

  if (result.delivery) {
    await ensureDeliveryAccess(user, result.delivery, 'receiving');
  }

  if (!manualCallResultIsSuccess(result)) {
    const details = { delivery: result.delivery, slot: result.slot };
    if (result.outcome === 'invalid_status') {
      throw domainError.conflict(result.message, result.message, details);
    }
    throw domainError.badRequest(result.message, result.message, details);
  }

  const { delivery, slot, message } = result;
  if (result.historyEventCreated) {
    const callCount = await countCallHistoryEvents(delivery.id);
    const scope = await getScopeForDelivery({ ...delivery, assignedSlotId: slot.id });
    await recordAuditLog({
      ...userActor(user),
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
        slotAssignedUnit: slot.assignedUnit,
        crossUnitSlot: slot.assignedUnit !== delivery.receivingUnit,
        source: 'deliveries.manual-call',
      },
    });
    const [queue, slots] = await Promise.all([
      deliveryRepository.getFullQueue(scope),
      deliveryRepository.getAllSlots(scope),
    ]);
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
    sendPushToDelivery(delivery.registrationCode, {
      title: `🚛 Mời vào ${slot.code}`,
      body: `Xe ${delivery.vehiclePlate} — ${slot.name}. Vui lòng vào ngay!`,
      tag: 'delivery-called-manual',
      url: `/track/${delivery.registrationCode}`,
    }).catch(console.error);
  }

  return delivery;
}

export async function startReceiving(id: string, user: AuthUser | undefined) {
  const delivery = await deliveryRepository.findDelivery(id);
  if (!delivery) throw domainError.notFound('Not found');

  await ensureDeliveryAccess(user, delivery, 'receiving');

  if (delivery.status !== DeliveryStatus.CALLED) {
    throw domainError.badRequest('Delivery must be in CALLED status');
  }

  const newStatus = delivery.autoWarehouse ? DeliveryStatus.AUTO_WAREHOUSE_RECEIVING : DeliveryStatus.RECEIVING;
  const updated = await deliveryRepository.startReceivingDelivery(id, newStatus);
  await recordDeliveryEvent(updated, {
    ...userActor(user),
    eventType: newStatus === DeliveryStatus.AUTO_WAREHOUSE_RECEIVING
      ? DeliveryHistoryEventType.AUTO_WAREHOUSE_RECEIVING_STARTED
      : DeliveryHistoryEventType.RECEIVING_STARTED,
    fromStatus: delivery.status,
    toStatus: updated.status,
    occurredAt: updated.receivingStartTime ?? new Date(),
    message: 'Bắt đầu nhận hàng',
  });

  const scope = await getScopeForDelivery(updated);
  const queue = await deliveryRepository.getFullQueue(scope);
  await recordAuditLog({
    ...userActor(user),
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

  const slotName = updated.assignedSlot?.name ?? 'dock';
  sendPushToDelivery(delivery.registrationCode, {
    title: '📦 Bắt đầu giao hàng',
    body: `Xe ${delivery.vehiclePlate} tại ${slotName}`,
    tag: 'delivery-receiving-started',
    url: `/track/${delivery.registrationCode}`,
  }).catch(console.error);

  return updated;
}

export async function complete(id: string, user: AuthUser | undefined) {
  const preDelivery = await deliveryRepository.findDeliveryForLifecycleScope(id);
  if (preDelivery) {
    await ensureDeliveryAccess(user, preDelivery, 'receiving');
  }

  const result = await completeDelivery(id, userActor(user));
  if (!result.delivery) throw domainError.notFound('Not found');
  if (result.outcome === 'invalid_status') {
    throw domainError.conflict('Cannot complete delivery in current status', 'Cannot complete delivery in current status', { delivery: result.delivery });
  }

  const scope = await getScopeForDelivery(result.delivery);
  const [queue, slots] = await Promise.all([
    deliveryRepository.getFullQueue(scope),
    deliveryRepository.getAllSlots(scope),
  ]);
  if (result.changed) {
    await recordAuditLog({
      ...userActor(user),
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
    emitDeliveryCompleted(id, scope);
    emitQueueUpdated(queue, scope);
    emitSlotUpdated(slots, scope);
    emitTrackUpdated(result.delivery.registrationCode).catch(console.error);
    emitTrackUpdatesForQueue(queue).catch(console.error);
    await archiveDelivery({
      deliveryId: result.delivery.id,
      finalStatus: DeliveryHistoryFinalStatus.COMPLETED,
      archiveReason: 'COMPLETED',
      ...userActor(user),
      closeReason: 'Hoàn tất nhận hàng',
      deleteOperationalRow: false,
    });

    sendPushToDelivery(result.delivery.registrationCode, {
      title: '🎉 Giao hàng hoàn tất',
      body: `Xe ${result.delivery.vehiclePlate} — Cảm ơn bạn đã giao hàng!`,
      tag: 'delivery-completed',
      url: `/track/${result.delivery.registrationCode}`,
    }).catch(console.error);
    triggerAutoAssign(result.delivery.receivingUnit, scope).catch(console.error);
  }

  return { success: true, delivery: result.delivery, idempotent: !result.changed };
}

export async function cancel(id: string, reason: string, user: AuthUser | undefined) {
  const preDelivery = await deliveryRepository.findDeliveryForLifecycleScope(id);
  if (preDelivery) {
    await ensureDeliveryAccess(user, preDelivery, 'receiving');
  }

  const result = await cancelDelivery(id, reason, userActor(user));
  if (!result.delivery) throw domainError.notFound('Not found');
  if (result.outcome === 'invalid_status') {
    throw domainError.conflict('Cannot cancel delivery in current status', 'Cannot cancel delivery in current status', { delivery: result.delivery });
  }

  const scope = await getScopeForDelivery(result.delivery);
  const [queue, slots] = await Promise.all([
    deliveryRepository.getFullQueue(scope),
    deliveryRepository.getAllSlots(scope),
  ]);
  if (result.changed) {
    await recordAuditLog({
      ...userActor(user),
      action: 'delivery.cancel',
      targetType: 'DeliveryRegistration',
      targetId: result.delivery.id,
      businessLocationId: scope.businessLocationId,
      unitConfigId: scope.unitConfigId,
      after: {
        status: result.delivery.status,
        registrationCode: result.delivery.registrationCode,
        vehiclePlate: result.delivery.vehiclePlate,
        cancelReason: result.delivery.cancelReason,
      },
      metadata: {
        releasedSlotId: result.releasedSlotId,
        reason,
        source: 'deliveries.cancel',
      },
    });
    emitQueueUpdated(queue, scope);
    emitSlotUpdated(slots, scope);
    emitTrackUpdated(result.delivery.registrationCode).catch(console.error);
    emitTrackUpdatesForQueue(queue).catch(console.error);
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

  return { success: true, delivery: result.delivery, idempotent: !result.changed };
}
