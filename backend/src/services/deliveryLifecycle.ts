import { DeliveryRegistration, DeliveryStatus, Prisma, SlotStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

const ACTIVE_SLOT_DELIVERY_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.CALLED,
  DeliveryStatus.RECEIVING,
  DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
];

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

  await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "slots" WHERE "id" = ${delivery.assignedSlotId} FOR UPDATE
  `);

  const remaining = await tx.deliveryRegistration.count({
    where: {
      assignedSlotId: delivery.assignedSlotId,
      id: { not: delivery.id },
      status: { in: ACTIVE_SLOT_DELIVERY_STATUSES },
    },
  });
  const slot = await tx.slot.findUnique({
    where: { id: delivery.assignedSlotId },
    select: { maxCapacity: true },
  });

  await tx.slot.update({
    where: { id: delivery.assignedSlotId },
    data: {
      status: remaining < (slot?.maxCapacity ?? 1) ? SlotStatus.AVAILABLE : SlotStatus.OCCUPIED,
      currentDeliveryId: remaining === 0 ? null : undefined,
    },
  });

  return delivery.assignedSlotId;
}

export async function completeDelivery(deliveryId: string): Promise<CompleteDeliveryResult> {
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
    const releasedSlotId = await releaseSlotForDelivery(tx, delivery);

    return {
      outcome: 'completed',
      delivery: completed,
      changed: true,
      releasedSlotId,
    };
  });
}

export async function cancelDelivery(deliveryId: string): Promise<CancelDeliveryResult> {
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
      data: { status: DeliveryStatus.CANCELLED },
    });
    const releasedSlotId = await releaseSlotForDelivery(tx, delivery);

    return {
      outcome: 'cancelled',
      delivery: cancelled,
      changed: true,
      releasedSlotId,
    };
  });
}
