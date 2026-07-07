import { DeliveryHistoryEventType, DeliveryRegistration, DeliveryStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { reconcileSlotState } from './slotState';
import { recordDeliveryEvent } from '../modules/history/historyService';
import type { HistoryActor } from '../modules/history/types';

const COMPLETABLE_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.CALLED,
  DeliveryStatus.RECEIVING,
  DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
];

const NON_CANCELLABLE_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.COMPLETED,
  DeliveryStatus.CANCELLED,
  DeliveryStatus.EXPIRED,
];

type DeliveryResult<TOutcome extends string> = {
  outcome: TOutcome;
  delivery: DeliveryRegistration | null;
  changed: boolean;
  releasedSlotId: string | null;
};

export type CompleteDeliveryResult = DeliveryResult<'completed' | 'already_completed' | 'not_found' | 'invalid_status'>;
export type CancelDeliveryResult = DeliveryResult<'cancelled' | 'already_cancelled' | 'not_found' | 'invalid_status'>;

async function lockDelivery(tx: Prisma.TransactionClient, deliveryId: string): Promise<void> {
  await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "delivery_registrations" WHERE "id" = ${deliveryId} FOR UPDATE
  `);
}

async function releaseSlotForDelivery(tx: Prisma.TransactionClient, delivery: DeliveryRegistration): Promise<string | null> {
  if (!delivery.assignedSlotId) return null;

  await reconcileSlotState(tx, delivery.assignedSlotId);
  return delivery.assignedSlotId;
}

export async function completeDelivery(deliveryId: string, actor: HistoryActor = {}): Promise<CompleteDeliveryResult> {
  return prisma.$transaction(async (tx) => {
    await lockDelivery(tx, deliveryId);

    const delivery = await tx.deliveryRegistration.findUnique({ where: { id: deliveryId } });
    if (!delivery) {
      return { outcome: 'not_found', delivery: null, changed: false, releasedSlotId: null };
    }
    if (delivery.status === DeliveryStatus.COMPLETED) {
      return { outcome: 'already_completed', delivery, changed: false, releasedSlotId: null };
    }
    if (!COMPLETABLE_STATUSES.includes(delivery.status)) {
      return { outcome: 'invalid_status', delivery, changed: false, releasedSlotId: null };
    }

    const completed = await tx.deliveryRegistration.update({
      where: { id: delivery.id },
      data: { status: DeliveryStatus.COMPLETED, completedTime: new Date() },
    });
    await recordDeliveryEvent(completed, {
      ...actor,
      eventType: DeliveryHistoryEventType.COMPLETED,
      fromStatus: delivery.status,
      toStatus: completed.status,
      occurredAt: completed.completedTime ?? new Date(),
      message: 'Hoàn tất nhận hàng',
    }, tx);
    const releasedSlotId = await releaseSlotForDelivery(tx, delivery);

    return {
      outcome: 'completed',
      delivery: completed,
      changed: true,
      releasedSlotId,
    };
  });
}

export async function cancelDelivery(deliveryId: string, reason: string, actor: HistoryActor = {}): Promise<CancelDeliveryResult> {
  return prisma.$transaction(async (tx) => {
    await lockDelivery(tx, deliveryId);

    const delivery = await tx.deliveryRegistration.findUnique({ where: { id: deliveryId } });
    if (!delivery) {
      return { outcome: 'not_found', delivery: null, changed: false, releasedSlotId: null };
    }
    if (delivery.status === DeliveryStatus.CANCELLED) {
      return { outcome: 'already_cancelled', delivery, changed: false, releasedSlotId: null };
    }
    if (NON_CANCELLABLE_STATUSES.includes(delivery.status)) {
      return { outcome: 'invalid_status', delivery, changed: false, releasedSlotId: null };
    }

    const cancelled = await tx.deliveryRegistration.update({
      where: { id: delivery.id },
      data: { status: DeliveryStatus.CANCELLED, cancelReason: reason },
    });
    await recordDeliveryEvent(cancelled, {
      ...actor,
      eventType: DeliveryHistoryEventType.CANCELLED,
      fromStatus: delivery.status,
      toStatus: cancelled.status,
      occurredAt: new Date(),
      message: 'Hủy lượt giao hàng',
      reason,
    }, tx);
    const releasedSlotId = await releaseSlotForDelivery(tx, delivery);

    return {
      outcome: 'cancelled',
      delivery: cancelled,
      changed: true,
      releasedSlotId,
    };
  });
}
