import { DeliveryRegistration, DeliveryStatus, GoodsType, Prisma, ReceivingUnit, Slot, SlotStatus } from '@prisma/client';
import { formatTicketCode } from '../routes/track';
import { prisma } from '../lib/prisma';
import { emitDeliveryCalled, emitQueueUpdated, emitSlotUpdated } from '../socket';
import { sendPushToDelivery } from './webPush';
import { emitTrackUpdatesForQueue } from './trackRealtime';
import { ACTIVE_SLOT_DELIVERY_STATUSES, isManualSlotStatus, reconcileSlotState } from './slotState';

type AutoAssignScope = {
  businessLocationId?: string;
  unitConfigId?: string;
};

type AutoAssignSlot = Slot & {
  _count: {
    deliveries: number;
  };
};

type AssignResult = {
  delivery: DeliveryRegistration;
  slot: Slot;
  message: string;
  activeCount: number;
};

async function getFullQueue() {
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

async function getAllSlotsWithDeliveries() {
  return prisma.slot.findMany({
    where: { isActive: true },
    orderBy: [{ assignedUnit: 'asc' }, { vehicleType: 'asc' }, { code: 'asc' }],
    include: {
      zone: { select: { id: true, code: true, name: true } },
      deliveries: {
        where: { status: { in: ACTIVE_SLOT_DELIVERY_STATUSES } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
}

function goodsFilterForSlot(slot: Slot): Prisma.Sql | null {
  const acceptedGoods = slot.acceptedGoods as GoodsType[];

  if (slot.autoWarehouseOnly) {
    return Prisma.sql`AND "goods_type" = ${GoodsType.AUTO_WAREHOUSE}::"GoodsType"`;
  }

  const allowedGoods = acceptedGoods.length > 0
    ? acceptedGoods.filter((goodsType) => goodsType !== GoodsType.AUTO_WAREHOUSE)
    : [];

  if (acceptedGoods.length > 0 && allowedGoods.length === 0) {
    return null;
  }

  if (acceptedGoods.length === 0) {
    return Prisma.sql`AND "goods_type" <> ${GoodsType.AUTO_WAREHOUSE}::"GoodsType"`;
  }

  return Prisma.sql`
    AND "goods_type" IN (${Prisma.join(allowedGoods.map((goodsType) => Prisma.sql`${goodsType}::"GoodsType"`))})
  `;
}

function freshFoodPriorityForSlot(slot: Slot): Prisma.Sql {
  const acceptedGoods = slot.acceptedGoods as GoodsType[];
  const canAcceptFreshFood = !slot.autoWarehouseOnly
    && (acceptedGoods.length === 0 || acceptedGoods.includes(GoodsType.FRESH_FOOD));

  if (!canAcceptFreshFood) {
    return Prisma.sql``;
  }

  return Prisma.sql`
    CASE WHEN "goods_type" = ${GoodsType.FRESH_FOOD}::"GoodsType" THEN 0 ELSE 1 END,
  `;
}

async function findNextWaitingDeliveryForSlot(
  tx: Prisma.TransactionClient,
  slot: Slot,
): Promise<DeliveryRegistration | null> {
  const goodsFilter = goodsFilterForSlot(slot);
  if (!goodsFilter) return null;

  const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id"
    FROM "delivery_registrations"
    WHERE "receiving_unit" = ${slot.assignedUnit}::"ReceivingUnit"
      AND "vehicle_type" = ${slot.vehicleType}::"VehicleType"
      AND "status" = ${DeliveryStatus.WAITING}::"DeliveryStatus"
      ${goodsFilter}
    ORDER BY
      ${freshFoodPriorityForSlot(slot)}
      "checkin_time" ASC NULLS LAST,
      "created_at" ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `);

  if (rows.length === 0) return null;

  return tx.deliveryRegistration.findUnique({
    where: { id: rows[0].id },
  });
}

async function assignNextDeliveryToSlot(slotId: string, unit: ReceivingUnit): Promise<AssignResult | null> {
  return prisma.$transaction(async (tx) => {
    const lockedSlot = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "slots" WHERE "id" = ${slotId} FOR UPDATE
    `);
    if (lockedSlot.length === 0) return null;

    const slot = await tx.slot.findUnique({ where: { id: slotId } });
    if (!slot) return null;
    if (
      slot.assignedUnit !== unit
      || !slot.isActive
      || !slot.autoAssign
      || isManualSlotStatus(slot.status)
    ) {
      return null;
    }

    const activeCount = await tx.deliveryRegistration.count({
      where: {
        assignedSlotId: slot.id,
        status: { in: ACTIVE_SLOT_DELIVERY_STATUSES },
      },
    });
    if (activeCount >= slot.maxCapacity) return null;

    const next = await findNextWaitingDeliveryForSlot(tx, slot);
    if (!next) return null;

    if (next.status !== DeliveryStatus.WAITING) return null;

    if (next.assignedSlotId && next.assignedSlotId !== slot.id) {
      await reconcileSlotState(tx, next.assignedSlotId);
    }

    const calledTime = new Date();
    const message = `[Tự động] Mời xe ${next.vehiclePlate} vào ${slot.code}`;
    const newActiveCount = activeCount + 1;

    const delivery = await tx.deliveryRegistration.update({
      where: { id: next.id },
      data: { status: DeliveryStatus.CALLED, calledTime, assignedSlotId: slot.id },
    });

    await tx.callLog.create({
      data: {
        deliveryRegistrationId: next.id,
        slotId: slot.id,
        message,
      },
    });

    await tx.slot.update({
      where: { id: slot.id },
      data: { lastUsedAt: calledTime },
    });
    const reconciledSlot = await reconcileSlotState(tx, slot.id);

    return {
      delivery,
      slot: reconciledSlot?.slot ?? slot,
      message,
      activeCount: reconciledSlot?.activeCount ?? newActiveCount,
    };
  });
}

async function emitAutoAssignResult(result: AssignResult, unit: ReceivingUnit): Promise<void> {
  const callCount = await prisma.callLog.count({ where: { deliveryRegistrationId: result.delivery.id } });

  emitDeliveryCalled({
    id: result.delivery.id,
    vehiclePlate: result.delivery.vehiclePlate,
    slotCode: result.slot.code,
    slotName: result.slot.name,
    message: result.message,
    receivingUnit: unit,
    callCount,
    isAutoAssign: true,
    ticketCode: result.delivery.ticketNumber
      ? formatTicketCode(result.delivery.receivingUnit, result.delivery.vehicleType, result.delivery.ticketNumber)
      : undefined,
  });

  console.log(
    `[AutoAssign] ${unit}: ${result.delivery.vehiclePlate} -> ${result.slot.code} (${result.delivery.goodsType}) `
    + `[${result.activeCount}/${result.slot.maxCapacity}]`,
  );

  sendPushToDelivery(result.delivery.registrationCode, {
    title: `🚛 Mời vào ${result.slot.code}`,
    body: `Xe ${result.delivery.vehiclePlate} — ${result.slot.name}. Vui lòng vào ngay!`,
    tag: 'delivery-called',
    url: `/track/${result.delivery.registrationCode}`,
  }).catch(console.error);

  const [queue, slots] = await Promise.all([getFullQueue(), getAllSlotsWithDeliveries()]);
  emitQueueUpdated(queue);
  emitSlotUpdated(slots);
  emitTrackUpdatesForQueue(queue).catch(console.error);
}

// Called after check-in or after a delivery completes/cancels.
// For each slot with available capacity, calls the next best-matching WAITING delivery.
// FRESH_FOOD is always considered first within the slot's accepted goods.
// Motorbike slots support multi-vehicle capacity (maxCapacity field).
// Returns number of vehicles assigned in this round.
export async function triggerAutoAssign(unit: ReceivingUnit, scope: AutoAssignScope = {}): Promise<number> {
  const slots = await prisma.slot.findMany({
    where: {
      assignedUnit: unit,
      isActive: true,
      autoAssign: true,
      status: { notIn: [SlotStatus.MAINTENANCE, SlotStatus.RESERVED] },
      zone: {
        ...(scope.unitConfigId ? { unitConfigId: scope.unitConfigId } : {}),
        ...(scope.businessLocationId ? { unitConfig: { businessLocationId: scope.businessLocationId } } : {}),
      },
    },
    include: {
      _count: {
        select: {
          deliveries: {
            where: { status: { in: ACTIVE_SLOT_DELIVERY_STATUSES } },
          },
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  const candidateSlots = slots
    .filter((slot) => slot._count.deliveries < slot.maxCapacity)
    .sort((a, b) => b._count.deliveries - a._count.deliveries);

  if (candidateSlots.length === 0) {
    console.log(`[AutoAssign] ${unit}: no slots with available capacity`);
    return 0;
  }

  let called = 0;
  for (const slot of candidateSlots as AutoAssignSlot[]) {
    while (true) {
      const result = await assignNextDeliveryToSlot(slot.id, unit);
      if (!result) break;

      called++;
      await emitAutoAssignResult(result, unit);

      if (result.activeCount >= result.slot.maxCapacity) break;
    }
  }

  if (called === 0) {
    console.log(`[AutoAssign] ${unit}: no match (${candidateSlots.length} slots with capacity, no waiting vehicles)`);
  }
  return called;
}
