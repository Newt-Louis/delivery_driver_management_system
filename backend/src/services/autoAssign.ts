import { DeliveryStatus, GoodsType, ReceivingUnit, VehicleType } from '@prisma/client';
import { formatTicketCode } from '../routes/track';
import { prisma } from '../lib/prisma';
import { emitDeliveryCalled, emitQueueUpdated, emitSlotUpdated } from '../socket';
import { sendPushToDelivery } from './webPush';
import { emitTrackUpdatesForQueue } from './trackRealtime';

async function getFullQueue() {
  return prisma.deliveryRegistration.findMany({
    where: {
      status: {
        in: [DeliveryStatus.WAITING, DeliveryStatus.CALLED, DeliveryStatus.RECEIVING, DeliveryStatus.AUTO_WAREHOUSE_RECEIVING],
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
        where: { status: { in: ['WAITING', 'CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'] } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
}

// Two-way enforcement: AW-only slots match only AUTO_WAREHOUSE deliveries;
// regular slots never match AUTO_WAREHOUSE deliveries.
async function findNextDelivery(
  unit: ReceivingUnit,
  vehicleType: VehicleType,
  acceptedGoods: GoodsType[],
  autoWarehouseOnly: boolean,
) {
  // AW-only slot: only match AUTO_WAREHOUSE deliveries, skip fresh-food priority
  if (autoWarehouseOnly) {
    return prisma.deliveryRegistration.findFirst({
      where: {
        receivingUnit: unit,
        vehicleType,
        status: DeliveryStatus.WAITING,
        goodsType: GoodsType.AUTO_WAREHOUSE,
      },
      orderBy: [{ checkinTime: 'asc' }],
    });
  }

  // Regular slot: always exclude AUTO_WAREHOUSE deliveries
  const canAcceptFreshFood =
    acceptedGoods.length === 0 || acceptedGoods.includes(GoodsType.FRESH_FOOD);

  if (canAcceptFreshFood) {
    const freshFood = await prisma.deliveryRegistration.findFirst({
      where: {
        receivingUnit: unit,
        vehicleType,
        status: DeliveryStatus.WAITING,
        goodsType: GoodsType.FRESH_FOOD,
      },
      orderBy: [{ checkinTime: 'asc' }],
    });
    if (freshFood) return freshFood;
  }

  // Exclude AUTO_WAREHOUSE from regular slots
  const goodsFilter =
    acceptedGoods.length > 0
      ? { goodsType: { in: acceptedGoods.filter(g => g !== GoodsType.AUTO_WAREHOUSE) as GoodsType[] } }
      : { goodsType: { not: GoodsType.AUTO_WAREHOUSE } };

  return prisma.deliveryRegistration.findFirst({
    where: {
      receivingUnit: unit,
      vehicleType,
      status: DeliveryStatus.WAITING,
      ...goodsFilter,
    },
    orderBy: [{ checkinTime: 'asc' }],
  });
}

// Called after check-in or after a delivery completes/cancels.
// For each slot with available capacity, calls the next best-matching WAITING delivery.
// FRESH_FOOD is always considered first within the slot's accepted goods.
// Motorbike slots support multi-vehicle capacity (maxCapacity field).
// Returns number of vehicles assigned in this round.
export async function triggerAutoAssign(unit: ReceivingUnit): Promise<number> {
  // Fetch all active, autoAssign slots — including their current active delivery count
  const allSlots = await prisma.slot.findMany({
    where: {
      assignedUnit: unit,
      isActive: true,
      autoAssign: true,
      status: { notIn: ['MAINTENANCE', 'RESERVED'] },
    },
    include: {
      _count: {
        select: {
          deliveries: {
            where: { status: { in: ['CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'] } },
          },
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  // Filter slots that still have capacity, sorted: fill partially-used slots first
  const availableSlots = allSlots
    .filter((s) => s._count.deliveries < s.maxCapacity)
    .sort((a, b) => b._count.deliveries - a._count.deliveries);

  if (availableSlots.length === 0) {
    console.log(`[AutoAssign] ${unit}: no slots with available capacity`);
    return 0;
  }

  let called = 0;
  for (const slot of availableSlots) {
    const next = await findNextDelivery(unit, slot.vehicleType, slot.acceptedGoods as GoodsType[], slot.autoWarehouseOnly);

    if (!next) continue;
    called++;

    const calledTime = new Date();
    const message = `[Tự động] Mời xe ${next.vehiclePlate} vào ${slot.code}`;
    const newActiveCount = slot._count.deliveries + 1;
    const newStatus = newActiveCount >= slot.maxCapacity ? 'OCCUPIED' : 'AVAILABLE';

    await prisma.$transaction(async (tx) => {
      if (next.assignedSlotId && next.assignedSlotId !== slot.id) {
        // Free the old slot — check if other deliveries remain there
        const remainingInOld = await tx.deliveryRegistration.count({
          where: {
            assignedSlotId: next.assignedSlotId,
            id: { not: next.id },
            status: { in: ['CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'] },
          },
        });
        const oldSlot = await tx.slot.findUnique({
          where: { id: next.assignedSlotId },
          select: { maxCapacity: true },
        });
        await tx.slot.update({
          where: { id: next.assignedSlotId },
          data: {
            status: remainingInOld < (oldSlot?.maxCapacity ?? 1) ? 'AVAILABLE' : 'OCCUPIED',
            currentDeliveryId: remainingInOld === 0 ? null : undefined,
          },
        });
      }

      await tx.deliveryRegistration.update({
        where: { id: next.id },
        data: { status: DeliveryStatus.CALLED, calledTime, assignedSlotId: slot.id },
      });

      await tx.slot.update({
        where: { id: slot.id },
        data: { status: newStatus, currentDeliveryId: next.id, lastUsedAt: calledTime },
      });

      await tx.callLog.create({
        data: {
          deliveryRegistrationId: next.id,
          slotId: slot.id,
          message,
        },
      });
    });

    const callCount = await prisma.callLog.count({ where: { deliveryRegistrationId: next.id } });

    emitDeliveryCalled({
      id: next.id,
      vehiclePlate: next.vehiclePlate,
      slotCode: slot.code,
      slotName: slot.name,
      message,
      receivingUnit: unit,
      callCount,
      isAutoAssign: true,
      ticketCode: next.ticketNumber
        ? formatTicketCode(next.receivingUnit, next.vehicleType, next.ticketNumber)
        : undefined,
    });
    console.log(`[AutoAssign] ${unit}: ${next.vehiclePlate} → ${slot.code} (${next.goodsType}) [${newActiveCount}/${slot.maxCapacity}]`);

    // Push notification to driver
    sendPushToDelivery(next.registrationCode, {
      title: `🚛 Mời vào ${slot.code}`,
      body:  `Xe ${next.vehiclePlate} — ${slot.name}. Vui lòng vào ngay!`,
      tag:   'delivery-called',
      url:   `/track/${next.registrationCode}`,
    }).catch(console.error);

    const [queue, slots] = await Promise.all([getFullQueue(), getAllSlotsWithDeliveries()]);
    emitQueueUpdated(queue);
    emitSlotUpdated(slots);
    emitTrackUpdatesForQueue(queue).catch(console.error);
  }

  if (called === 0) {
    console.log(`[AutoAssign] ${unit}: no match (${availableSlots.length} slots with capacity, no waiting vehicles)`);
  }
  return called;
}
