import { DeliveryStatus, Prisma, Slot, SlotStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const ACTIVE_SLOT_DELIVERY_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.CALLED,
  DeliveryStatus.RECEIVING,
  DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
];

export const MANUAL_SLOT_STATUSES: SlotStatus[] = [
  SlotStatus.MAINTENANCE,
  SlotStatus.RESERVED,
];

export type SlotStateSnapshot = {
  slot: Slot;
  activeCount: number;
  activeDeliveryId: string | null;
  manualStatus: boolean;
};

export function isManualSlotStatus(status: SlotStatus): boolean {
  return MANUAL_SLOT_STATUSES.includes(status);
}

async function getActiveSlotSnapshot(
  tx: Prisma.TransactionClient,
  slot: Slot,
): Promise<Pick<SlotStateSnapshot, 'activeCount' | 'activeDeliveryId'>> {
  const activeDeliveries = await tx.deliveryRegistration.findMany({
    where: {
      assignedSlotId: slot.id,
      status: { in: ACTIVE_SLOT_DELIVERY_STATUSES },
    },
    orderBy: [{ updatedAt: 'desc' }, { calledTime: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  });

  return {
    activeCount: activeDeliveries.length,
    activeDeliveryId: activeDeliveries[0]?.id ?? null,
  };
}

export async function reconcileSlotState(
  tx: Prisma.TransactionClient,
  slotId: string,
  options: { preserveManualStatus?: boolean } = {},
): Promise<SlotStateSnapshot | null> {
  const preserveManualStatus = options.preserveManualStatus ?? true;

  const lockedSlot = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "slots" WHERE "id" = ${slotId} FOR UPDATE
  `);
  if (lockedSlot.length === 0) return null;

  const slot = await tx.slot.findUnique({ where: { id: slotId } });
  if (!slot) return null;

  const activeState = await getActiveSlotSnapshot(tx, slot);
  const manualStatus = isManualSlotStatus(slot.status);

  if (manualStatus && preserveManualStatus) {
    const updatedManualSlot = await tx.slot.update({
      where: { id: slot.id },
      data: { currentDeliveryId: activeState.activeDeliveryId },
    });
    return {
      slot: updatedManualSlot,
      activeCount: activeState.activeCount,
      activeDeliveryId: activeState.activeDeliveryId,
      manualStatus,
    };
  }

  const nextStatus = activeState.activeCount >= slot.maxCapacity
    ? SlotStatus.OCCUPIED
    : SlotStatus.AVAILABLE;

  const updatedSlot = await tx.slot.update({
    where: { id: slot.id },
    data: {
      status: nextStatus,
      currentDeliveryId: activeState.activeDeliveryId,
    },
  });

  return {
    slot: updatedSlot,
    activeCount: activeState.activeCount,
    activeDeliveryId: activeState.activeDeliveryId,
    manualStatus,
  };
}

export async function reconcileOneSlot(
  slotId: string,
  options: { preserveManualStatus?: boolean } = {},
): Promise<SlotStateSnapshot | null> {
  return prisma.$transaction((tx) => reconcileSlotState(tx, slotId, options));
}

export async function reconcileAllSlots(
  options: { activeOnly?: boolean; preserveManualStatus?: boolean } = {},
): Promise<SlotStateSnapshot[]> {
  const activeOnly = options.activeOnly ?? true;
  return prisma.$transaction(async (tx) => {
    const slots = await tx.slot.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ assignedUnit: 'asc' }, { vehicleType: 'asc' }, { code: 'asc' }],
      select: { id: true },
    });

    const snapshots: SlotStateSnapshot[] = [];
    for (const slot of slots) {
      const snapshot = await reconcileSlotState(tx, slot.id, {
        preserveManualStatus: options.preserveManualStatus,
      });
      if (snapshot) snapshots.push(snapshot);
    }
    return snapshots;
  });
}
