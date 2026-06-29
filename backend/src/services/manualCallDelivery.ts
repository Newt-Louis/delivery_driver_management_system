import {
  DeliveryRegistration,
  DeliveryStatus,
  Prisma,
  Slot,
  SlotStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';

const ACTIVE_SLOT_DELIVERY_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.CALLED,
  DeliveryStatus.RECEIVING,
  DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
];

const CALLABLE_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.WAITING,
  DeliveryStatus.CALLED,
];

type ManualCallDelivery = DeliveryRegistration & {
  assignedSlot: Slot | null;
  _count: { callLogs: number };
};

type ManualCallSuccess = {
  outcome: 'called' | 'already_called';
  delivery: ManualCallDelivery;
  slot: Slot;
  message: string;
  callLogCreated: boolean;
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
    include: { assignedSlot: true, _count: { select: { callLogs: true } } },
  });
}

async function releaseOldSlot(tx: Prisma.TransactionClient, delivery: DeliveryRegistration, targetSlotId: string): Promise<void> {
  if (!delivery.assignedSlotId || delivery.assignedSlotId === targetSlotId) return;

  await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "slots" WHERE "id" = ${delivery.assignedSlotId} FOR UPDATE
  `);

  const remainingInOld = await tx.deliveryRegistration.count({
    where: {
      assignedSlotId: delivery.assignedSlotId,
      id: { not: delivery.id },
      status: { in: ACTIVE_SLOT_DELIVERY_STATUSES },
    },
  });
  const oldSlot = await tx.slot.findUnique({
    where: { id: delivery.assignedSlotId },
    select: { maxCapacity: true },
  });
  await tx.slot.update({
    where: { id: delivery.assignedSlotId },
    data: {
      status: remainingInOld < (oldSlot?.maxCapacity ?? 1) ? SlotStatus.AVAILABLE : SlotStatus.OCCUPIED,
      currentDeliveryId: remainingInOld === 0 ? null : undefined,
    },
  });
}

export async function manualCallDelivery(args: {
  deliveryId: string;
  slotId: string;
  calledByUserId: string;
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

    if (!slot.isActive || slot.status === SlotStatus.MAINTENANCE || slot.status === SlotStatus.RESERVED) {
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
      const activeCount = await tx.deliveryRegistration.count({
        where: {
          assignedSlotId: slot.id,
          status: { in: ACTIVE_SLOT_DELIVERY_STATUSES },
        },
      });
      return {
        outcome: 'already_called',
        delivery,
        slot,
        message: `Mời xe ${delivery.vehiclePlate} vào ${slot.name}`,
        callLogCreated: false,
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
    const updated = await tx.deliveryRegistration.update({
      where: { id: delivery.id },
      data: { status: DeliveryStatus.CALLED, calledTime, assignedSlotId: slot.id },
      include: { assignedSlot: true, _count: { select: { callLogs: true } } },
    });

    const activeCount = activeInTarget + 1;
    await tx.slot.update({
      where: { id: slot.id },
      data: {
        status: activeCount >= slot.maxCapacity ? SlotStatus.OCCUPIED : SlotStatus.AVAILABLE,
        currentDeliveryId: delivery.id,
        lastUsedAt: calledTime,
      },
    });

    await tx.callLog.create({
      data: {
        deliveryRegistrationId: delivery.id,
        slotId: slot.id,
        calledByUserId: args.calledByUserId,
        message,
      },
    });

    return {
      outcome: 'called',
      delivery: updated,
      slot,
      message,
      callLogCreated: true,
      activeCount,
    };
  });
}

export function manualCallResultIsSuccess(result: ManualCallResult): result is ManualCallSuccess {
  return isManualCallSuccess(result);
}
