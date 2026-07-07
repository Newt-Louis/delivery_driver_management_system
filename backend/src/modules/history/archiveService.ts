import {
  DeliveryHistoryEventType,
  DeliveryHistoryFinalStatus,
  DeliveryRegistration,
  DeliveryStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { reconcileSlotState } from '../../services/slotState';
import { countCallHistoryEvents, getLastCallHistoryEvent, recordDeliveryHistoryEvent } from './historyRepository';
import { resolveDeliveryScope } from './historyService';
import type { ArchiveDeliveryInput } from './types';

type DeliveryWithSlot = DeliveryRegistration & {
  assignedSlot: { id: string; code: string; name: string } | null;
};

function minutesBetween(start?: Date | null, end?: Date | null): number | null {
  if (!start || !end) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

function closeEventType(reason: ArchiveDeliveryInput['archiveReason']): DeliveryHistoryEventType {
  switch (reason) {
    case 'COMPLETED':
      return DeliveryHistoryEventType.COMPLETED;
    case 'CANCELLED':
      return DeliveryHistoryEventType.CANCELLED;
    case 'EXPIRED_NO_SHOW':
      return DeliveryHistoryEventType.EXPIRED_NO_SHOW;
    case 'EXPIRED_WAITING':
      return DeliveryHistoryEventType.EXPIRED_WAITING;
    case 'INCOMPLETED':
      return DeliveryHistoryEventType.INCOMPLETED;
  }
}

async function lockDelivery(tx: Prisma.TransactionClient, deliveryId: string): Promise<void> {
  await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "delivery_registrations" WHERE "id" = ${deliveryId} FOR UPDATE
  `);
}

async function ensureRegisteredEvent(
  tx: Prisma.TransactionClient,
  delivery: DeliveryWithSlot,
  scope: Awaited<ReturnType<typeof resolveDeliveryScope>>,
): Promise<void> {
  const existing = await tx.deliveryHistoryEvent.count({
    where: {
      originalDeliveryId: delivery.id,
      eventType: DeliveryHistoryEventType.REGISTERED,
    },
  });
  if (existing > 0) return;

  await recordDeliveryHistoryEvent({
    deliveryRegistrationId: delivery.id,
    originalDeliveryId: delivery.id,
    registrationCode: delivery.registrationCode,
    businessLocationId: scope.businessLocationId,
    unitConfigId: scope.unitConfigId,
    eventType: DeliveryHistoryEventType.REGISTERED,
    toStatus: DeliveryStatus.REGISTERED,
    occurredAt: delivery.createdAt,
    message: 'Đăng ký giao hàng',
  }, tx);
}

async function ensureCloseEvent(
  tx: Prisma.TransactionClient,
  delivery: DeliveryWithSlot,
  input: ArchiveDeliveryInput,
  scope: Awaited<ReturnType<typeof resolveDeliveryScope>>,
): Promise<void> {
  const eventType = closeEventType(input.archiveReason);
  const existing = await tx.deliveryHistoryEvent.count({
    where: {
      originalDeliveryId: delivery.id,
      eventType,
    },
  });
  if (existing > 0) return;

  await recordDeliveryHistoryEvent({
    deliveryRegistrationId: delivery.id,
    originalDeliveryId: delivery.id,
    registrationCode: delivery.registrationCode,
    businessLocationId: scope.businessLocationId,
    unitConfigId: scope.unitConfigId,
    eventType,
    toStatus: delivery.status,
    occurredAt: input.occurredAt ?? new Date(),
    actorType: input.actorType,
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    slotId: delivery.assignedSlot?.id ?? scope.slotId,
    slotCode: delivery.assignedSlot?.code ?? scope.slotCode,
    slotName: delivery.assignedSlot?.name ?? scope.slotName,
    reason: input.closeReason ?? delivery.cancelReason ?? delivery.note ?? null,
  }, tx);
}

function closeTimestamp(
  delivery: DeliveryWithSlot,
  finalStatus: DeliveryHistoryFinalStatus,
  occurredAt: Date,
): Date | null {
  if (finalStatus === DeliveryHistoryFinalStatus.COMPLETED) return delivery.completedTime ?? occurredAt;
  if (finalStatus === DeliveryHistoryFinalStatus.CANCELLED) return occurredAt;
  if (finalStatus === DeliveryHistoryFinalStatus.EXPIRED) return occurredAt;
  if (finalStatus === DeliveryHistoryFinalStatus.INCOMPLETED) return occurredAt;
  return null;
}

export async function archiveDelivery(input: ArchiveDeliveryInput) {
  return prisma.$transaction(async (tx) => {
    await lockDelivery(tx, input.deliveryId);

    const delivery = await tx.deliveryRegistration.findUnique({
      where: { id: input.deliveryId },
      include: { assignedSlot: { select: { id: true, code: true, name: true } } },
    });
    if (!delivery) {
      const existing = await tx.deliveryHistory.findUnique({
        where: { originalDeliveryId: input.deliveryId },
      });
      return { history: existing, archived: false, deleted: false };
    }

    const occurredAt = input.occurredAt ?? new Date();
    const scope = await resolveDeliveryScope(tx, delivery);
    await ensureRegisteredEvent(tx, delivery, scope);
    await ensureCloseEvent(tx, delivery, { ...input, occurredAt }, scope);

    const callCount = await countCallHistoryEvents(delivery.id, tx);
    const lastCall = await getLastCallHistoryEvent(delivery.id, tx);
    const closeAt = closeTimestamp(delivery, input.finalStatus, occurredAt);

    const history = await tx.deliveryHistory.upsert({
      where: { originalDeliveryId: delivery.id },
      create: {
        originalDeliveryId: delivery.id,
        registrationCode: delivery.registrationCode,
        businessLocationId: scope.businessLocationId,
        unitConfigId: scope.unitConfigId,
        receivingUnit: delivery.receivingUnit,
        vendorName: delivery.vendorName,
        vendorCode: delivery.vendorCode,
        poNumber: delivery.poNumber,
        driverName: delivery.driverName,
        driverPhone: delivery.driverPhone,
        vehiclePlate: delivery.vehiclePlate,
        goodsType: delivery.goodsType,
        unitGoodsTypeId: delivery.unitGoodsTypeId,
        vehicleType: delivery.vehicleType,
        autoWarehouse: delivery.autoWarehouse,
        requestedTime: delivery.requestedTime,
        registeredAt: delivery.createdAt,
        checkinTime: delivery.checkinTime,
        calledTime: delivery.calledTime,
        receivingStartTime: delivery.receivingStartTime,
        completedTime: delivery.completedTime,
        finalStatus: input.finalStatus,
        closeReason: input.closeReason ?? delivery.cancelReason ?? delivery.note ?? null,
        ticketNumber: delivery.ticketNumber,
        assignedSlotId: delivery.assignedSlot?.id ?? delivery.assignedSlotId,
        assignedSlotCode: delivery.assignedSlot?.code ?? scope.slotCode ?? null,
        assignedSlotName: delivery.assignedSlot?.name ?? scope.slotName ?? null,
        callCount,
        lastCalledAt: lastCall?.occurredAt ?? delivery.calledTime,
        cancelledAt: input.finalStatus === DeliveryHistoryFinalStatus.CANCELLED ? closeAt : null,
        expiredAt: input.finalStatus === DeliveryHistoryFinalStatus.EXPIRED ? closeAt : null,
        archivedAt: occurredAt,
        archivedByJobRunId: input.jobRunId ?? null,
        durationWaitingMinutes: minutesBetween(delivery.checkinTime, delivery.calledTime ?? delivery.receivingStartTime ?? closeAt),
        durationReceivingMinutes: minutesBetween(delivery.receivingStartTime, delivery.completedTime ?? closeAt),
        note: delivery.note,
        metadata: {
          archiveReason: input.archiveReason,
          deletedOperationalRow: Boolean(input.deleteOperationalRow),
        },
      },
      update: {
        businessLocationId: scope.businessLocationId,
        unitConfigId: scope.unitConfigId,
        finalStatus: input.finalStatus,
        closeReason: input.closeReason ?? delivery.cancelReason ?? delivery.note ?? null,
        callCount,
        lastCalledAt: lastCall?.occurredAt ?? delivery.calledTime,
        completedTime: delivery.completedTime,
        cancelledAt: input.finalStatus === DeliveryHistoryFinalStatus.CANCELLED ? closeAt : null,
        expiredAt: input.finalStatus === DeliveryHistoryFinalStatus.EXPIRED ? closeAt : null,
        archivedAt: occurredAt,
        archivedByJobRunId: input.jobRunId ?? null,
        durationWaitingMinutes: minutesBetween(delivery.checkinTime, delivery.calledTime ?? delivery.receivingStartTime ?? closeAt),
        durationReceivingMinutes: minutesBetween(delivery.receivingStartTime, delivery.completedTime ?? closeAt),
        note: delivery.note,
        metadata: {
          archiveReason: input.archiveReason,
          deletedOperationalRow: Boolean(input.deleteOperationalRow),
        },
      },
    });

    await tx.deliveryHistoryEvent.updateMany({
      where: { originalDeliveryId: delivery.id },
      data: { deliveryHistoryId: history.id },
    });

    let deleted = false;
    if (input.deleteOperationalRow) {
      await recordDeliveryHistoryEvent({
        deliveryHistoryId: history.id,
        deliveryRegistrationId: delivery.id,
        originalDeliveryId: delivery.id,
        registrationCode: delivery.registrationCode,
        businessLocationId: scope.businessLocationId,
        unitConfigId: scope.unitConfigId,
        eventType: DeliveryHistoryEventType.ARCHIVED,
        fromStatus: delivery.status,
        occurredAt,
        actorType: input.actorType,
        actorId: input.actorId,
        actorLabel: input.actorLabel,
        reason: input.closeReason ?? delivery.cancelReason ?? delivery.note ?? null,
        metadata: { jobRunId: input.jobRunId ?? null },
      }, tx);

      if (delivery.assignedSlotId) {
        await reconcileSlotState(tx, delivery.assignedSlotId, { preserveManualStatus: false });
      }
      await tx.deliveryRegistration.delete({ where: { id: delivery.id } });
      deleted = true;
    }

    return { history, archived: true, deleted };
  });
}
