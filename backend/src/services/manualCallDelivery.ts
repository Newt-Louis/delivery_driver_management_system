import {
  DeliveryRegistration,
  DeliveryHistoryEventType,
  DeliveryStatus,
  Prisma,
  Slot,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ACTIVE_SLOT_DELIVERY_STATUSES, isManualSlotStatus, reconcileSlotState } from './slotState';
import { recordDeliveryEvent } from '../modules/history/historyService';
import type { HistoryActor } from '../modules/history/types';

const CALLABLE_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.WAITING,
  DeliveryStatus.CALLED,
];

type ManualCallDelivery = DeliveryRegistration & {
  assignedSlot: Slot | null;
};

type ManualCallSuccess = {
  outcome: 'called' | 'recalled' | 'already_called';
  delivery: ManualCallDelivery;
  slot: Slot;
  message: string;
  historyEventCreated: boolean;
  activeCount: number;
};

type ManualCallFailure = {
  outcome: 'delivery_not_found' | 'slot_not_found' | 'invalid_status' | 'slot_unavailable' | 'slot_mismatch' | 'slot_full';
  delivery?: ManualCallDelivery;
  slot?: Slot;
  message: string;
};

export type ManualCallResult = ManualCallSuccess | ManualCallFailure;

function isManualCallSuccess(result: ManualCallResult): result is ManualCallSuccess {
  return result.outcome === 'called' || result.outcome === 'already_called';
}

function getSlotMismatchMessage(delivery: DeliveryRegistration, slot: Slot): string | null {
  if (slot.assignedUnit !== delivery.receivingUnit) {
    return `Slot ${slot.code} thuộc ${slot.assignedUnit}, không nhận xe của ${delivery.receivingUnit}.`;
  }
  if (slot.vehicleType !== delivery.vehicleType) {
    return `Slot ${slot.code} nhận ${slot.vehicleType}, không nhận xe ${delivery.vehicleType}.`;
  }
  return null;
}

async function refreshDelivery(tx: Prisma.TransactionClient, deliveryId: string): Promise<ManualCallDelivery | null> {
  return tx.deliveryRegistration.findUnique({
    where: { id: deliveryId },
    include: { assignedSlot: true },
  });
}

async function releaseOldSlot(tx: Prisma.TransactionClient, delivery: DeliveryRegistration, targetSlotId: string): Promise<void> {
  if (!delivery.assignedSlotId || delivery.assignedSlotId === targetSlotId) return;
  await reconcileSlotState(tx, delivery.assignedSlotId);
}

export async function manualCallDelivery(args: {
  deliveryId: string;
  slotId: string;
  calledByUserId: string;
  actor?: HistoryActor;
}): Promise<ManualCallResult> {
  return prisma.$transaction(async (tx) => {
    const lockedDelivery = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "delivery_registrations" WHERE "id" = ${args.deliveryId} FOR UPDATE
    `);
    if (lockedDelivery.length === 0) {
      return { outcome: 'delivery_not_found', message: 'Not found' };
    }

    const delivery = await refreshDelivery(tx, args.deliveryId);
    if (!delivery) {
      return { outcome: 'delivery_not_found', message: 'Not found' };
    }

    if (!CALLABLE_STATUSES.includes(delivery.status)) {
      return {
        outcome: 'invalid_status',
        delivery,
        message: `Cannot call delivery in current status (${delivery.status})`,
      };
    }

    const lockedSlot = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "slots" WHERE "id" = ${args.slotId} FOR UPDATE
    `);
    if (lockedSlot.length === 0) {
      return { outcome: 'slot_not_found', delivery, message: 'Slot not found' };
    }

    const slot = await tx.slot.findUnique({ where: { id: args.slotId } });
    if (!slot) {
      return { outcome: 'slot_not_found', delivery, message: 'Slot not found' };
    }

    if (!slot.isActive || isManualSlotStatus(slot.status)) {
      return {
        outcome: 'slot_unavailable',
        delivery,
        slot,
        message: `Slot ${slot.code} không sẵn sàng để gọi xe.`,
      };
    }

    const mismatch = getSlotMismatchMessage(delivery, slot);
    if (mismatch) {
      return {
        outcome: 'slot_mismatch',
        delivery,
        slot,
        message: mismatch,
      };
    }

    if (delivery.status === DeliveryStatus.CALLED && delivery.assignedSlotId === slot.id) {
      const recalledAt = new Date();
      const message = `Mời xe ${delivery.vehiclePlate} vào ${slot.name}`;
      await recordDeliveryEvent(delivery, {
        ...(args.actor ?? {}),
        eventType: DeliveryHistoryEventType.RECALLED,
        fromStatus: delivery.status,
        toStatus: delivery.status,
        occurredAt: recalledAt,
        message,
        slot,
      }, tx);
      await tx.slot.update({
        where: { id: slot.id },
        data: { lastUsedAt: recalledAt },
      });
      const activeCount = await tx.deliveryRegistration.count({
        where: {
          assignedSlotId: slot.id,
          status: { in: ACTIVE_SLOT_DELIVERY_STATUSES },
        },
      });
      return {
        outcome: 'recalled',
        delivery,
        slot,
        message,
        historyEventCreated: true,
        activeCount,
      };
    }

    const activeInTarget = await tx.deliveryRegistration.count({
      where: {
        assignedSlotId: slot.id,
        id: { not: delivery.id },
        status: { in: ACTIVE_SLOT_DELIVERY_STATUSES },
      },
    });
    if (activeInTarget >= slot.maxCapacity) {
      return {
        outcome: 'slot_full',
        delivery,
        slot,
        message: `Slot ${slot.code} đã đủ sức chứa.`,
      };
    }

    await releaseOldSlot(tx, delivery, slot.id);

    const calledTime = new Date();
    const message = `Mời xe ${delivery.vehiclePlate} vào ${slot.name}`;
    const eventType = delivery.status === DeliveryStatus.CALLED
      ? DeliveryHistoryEventType.REASSIGNED_SLOT
      : DeliveryHistoryEventType.MANUAL_CALLED;
    const updated = await tx.deliveryRegistration.update({
      where: { id: delivery.id },
      data: { status: DeliveryStatus.CALLED, calledTime, assignedSlotId: slot.id },
      include: { assignedSlot: true },
    });

    const activeCount = activeInTarget + 1;
    await recordDeliveryEvent(updated, {
      ...(args.actor ?? {}),
      eventType,
      fromStatus: delivery.status,
      toStatus: updated.status,
      occurredAt: calledTime,
      message,
      slot,
    }, tx);

    await tx.slot.update({
      where: { id: slot.id },
      data: { lastUsedAt: calledTime },
    });
    await reconcileSlotState(tx, slot.id);

    return {
      outcome: 'called',
      delivery: updated,
      slot,
      message,
      historyEventCreated: true,
      activeCount,
    };
  });
}

export function manualCallResultIsSuccess(result: ManualCallResult): result is ManualCallSuccess {
  return isManualCallSuccess(result);
}
