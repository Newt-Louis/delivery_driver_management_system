import { ReceivingUnit, type ReceivingUnit as ReceivingUnitCode } from '../domain/unitCodes';
import { DeliveryHistoryEventType, DeliveryRegistration, DeliveryStatus, GoodsType, Prisma, Slot, SlotStatus } from '@prisma/client';
import { formatTicketCode } from '../routes/track';
import { prisma } from '../lib/prisma';
import { emitDeliveryCalled, emitQueueUpdated, emitSlotUpdated, type SocketScope } from '../socket';
import { sendPushToDelivery } from './webPush';
import { emitTrackUpdatesForQueue } from './trackRealtime';
import { ACTIVE_SLOT_DELIVERY_STATUSES, isManualSlotStatus, reconcileSlotState } from './slotState';
import { getScopeForSlot } from './realtimeScope';
import { recordAuditLog, systemActor } from './auditLog';
import { countCallHistoryEvents } from '../modules/history/historyRepository';
import { recordDeliveryEvent } from '../modules/history/historyService';

type AutoAssignScope = {
  businessLocationId?: string;
  unitConfigId?: string;
};

type AssignResult = {
  delivery: DeliveryRegistration;
  slot: Slot;
  message: string;
  activeCount: number;
};

const DEFAULT_NORMAL_GOODS_PRIORITY: GoodsType[] = [
  GoodsType.FRESH_FOOD,
  GoodsType.GENERAL_GOODS,
  GoodsType.THI_CONG,
];

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
    select: { unit: true },
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

async function getFullQueue(scope?: SocketScope) {
  return prisma.deliveryRegistration.findMany({
    where: await queueWhereForScope(scope),
    include: {
      assignedSlot: { include: { zone: { include: { unitConfig: { select: { id: true, unit: true, businessLocationId: true } } } } } },
    },
    orderBy: [{ checkinTime: 'asc' }],
  });
}

async function getAllSlotsWithDeliveries(scope?: SocketScope) {
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
        where: { status: { in: ACTIVE_SLOT_DELIVERY_STATUSES } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
}

function goodsFilterForSlot(slot: Slot, goodsType?: GoodsType): Prisma.Sql | null {
  const acceptedGoods = slot.acceptedGoods as GoodsType[];

  if (slot.autoWarehouseOnly) {
    return goodsType
      ? Prisma.sql`AND "goods_type" = ${goodsType}::"GoodsType"`
      : Prisma.sql`AND "goods_type" = ${GoodsType.AUTO_WAREHOUSE}::"GoodsType"`;
  }

  const allowedGoods = acceptedGoods.length > 0
    ? acceptedGoods.filter((goodsType) => goodsType !== GoodsType.AUTO_WAREHOUSE)
    : [];

  if (acceptedGoods.length > 0 && allowedGoods.length === 0) {
    return null;
  }

  if (goodsType) {
    return Prisma.sql`AND "goods_type" = ${goodsType}::"GoodsType"`;
  }

  if (acceptedGoods.length === 0) {
    return Prisma.sql`AND "goods_type" <> ${GoodsType.AUTO_WAREHOUSE}::"GoodsType"`;
  }

  return Prisma.sql`
    AND "goods_type" IN (${Prisma.join(allowedGoods.map((goodsType) => Prisma.sql`${goodsType}::"GoodsType"`))})
  `;
}

function candidateGoodsForSlot(slot: Slot): GoodsType[] {
  const acceptedGoods = slot.acceptedGoods as GoodsType[];
  const priority = slot.goodsPriority as GoodsType[];

  if (slot.autoWarehouseOnly) return [GoodsType.AUTO_WAREHOUSE];

  const allowedGoods = acceptedGoods.length > 0
    ? acceptedGoods.filter((goodsType) => goodsType !== GoodsType.AUTO_WAREHOUSE)
    : DEFAULT_NORMAL_GOODS_PRIORITY;

  if (allowedGoods.length === 0) return [];

  const ordered = [
    ...priority.filter((goodsType) => allowedGoods.includes(goodsType)),
    ...allowedGoods.filter((goodsType) => !priority.includes(goodsType)),
  ];

  return [...new Set(ordered)];
}

async function findNextWaitingDeliveryForSlot(
  tx: Prisma.TransactionClient,
  slot: Slot,
): Promise<DeliveryRegistration | null> {
  const goodsCandidates = candidateGoodsForSlot(slot);
  if (goodsCandidates.length === 0) return null;

  for (const goodsType of goodsCandidates) {
    const goodsFilter = goodsFilterForSlot(slot, goodsType);
    if (!goodsFilter) continue;

    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "delivery_registrations"
      WHERE "receiving_unit" = ${slot.assignedUnit}
        AND "vehicle_type" = ${slot.vehicleType}::"VehicleType"
        AND "status" = ${DeliveryStatus.WAITING}::"DeliveryStatus"
        ${goodsFilter}
      ORDER BY
        "checkin_time" ASC NULLS LAST,
        "created_at" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (rows.length === 0) continue;

    return tx.deliveryRegistration.findUnique({
      where: { id: rows[0].id },
    });
  }

  return null;
}

async function assignNextDeliveryToSlot(slotId: string, unit: ReceivingUnitCode): Promise<AssignResult | null> {
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

    await recordDeliveryEvent(delivery, {
      ...systemActor('auto-assign'),
      eventType: DeliveryHistoryEventType.AUTO_ASSIGNED,
      fromStatus: next.status,
      toStatus: delivery.status,
      occurredAt: calledTime,
      message,
      slot,
    }, tx);

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

async function emitAutoAssignResult(result: AssignResult, unit: ReceivingUnitCode): Promise<void> {
  const callCount = await countCallHistoryEvents(result.delivery.id);
  const scope = await getScopeForSlot(result.slot.id);

  await recordAuditLog({
    ...systemActor('auto-assign'),
    action: 'delivery.auto_assign',
    targetType: 'DeliveryRegistration',
    targetId: result.delivery.id,
    businessLocationId: scope.businessLocationId,
    unitConfigId: scope.unitConfigId,
    after: {
      status: result.delivery.status,
      registrationCode: result.delivery.registrationCode,
      vehiclePlate: result.delivery.vehiclePlate,
      assignedSlotId: result.slot.id,
      calledTime: result.delivery.calledTime?.toISOString() ?? null,
    },
    metadata: {
      slotId: result.slot.id,
      slotCode: result.slot.code,
      activeCount: result.activeCount,
      maxCapacity: result.slot.maxCapacity,
      receivingUnit: unit,
    },
  });

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
  }, scope);

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

  const [queue, slots] = await Promise.all([getFullQueue(scope), getAllSlotsWithDeliveries(scope)]);
  emitQueueUpdated(queue, scope);
  emitSlotUpdated(slots, scope);
  emitTrackUpdatesForQueue(queue).catch(console.error);
}

// Called after check-in or after a delivery completes/cancels.
// For each slot with available capacity, calls the next best-matching WAITING delivery.
// Goods are considered by the slot's configured priority, then FIFO within each goods type.
// Motorbike slots support multi-vehicle capacity (maxCapacity field).
// Returns number of vehicles assigned in this round.
export async function triggerAutoAssign(unit: ReceivingUnitCode, scope: AutoAssignScope = {}): Promise<number> {
  let called = 0;
  let candidateSeen = 0;

  while (true) {
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
      .sort((a, b) => {
        const remainingA = a.maxCapacity - a._count.deliveries;
        const remainingB = b.maxCapacity - b._count.deliveries;
        return remainingB - remainingA || a.code.localeCompare(b.code);
      });

    candidateSeen = Math.max(candidateSeen, candidateSlots.length);
    if (candidateSlots.length === 0) {
      if (called === 0) console.log(`[AutoAssign] ${unit}: no slots with available capacity`);
      return called;
    }

    let assignedThisRound = false;
    for (const slot of candidateSlots) {
      const result = await assignNextDeliveryToSlot(slot.id, unit);
      if (!result) continue;

      called++;
      await emitAutoAssignResult(result, unit);
      assignedThisRound = true;
      break;
    }

    if (!assignedThisRound) {
      if (called === 0) {
        console.log(`[AutoAssign] ${unit}: no match (${candidateSeen} slots with capacity, no waiting vehicles)`);
      }
      return called;
    }
  }
}
