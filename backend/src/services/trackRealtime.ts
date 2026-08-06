import { DeliveryStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getIO, trackRoomName } from '../socket';

const TRACK_INCLUDE = {
  unitConfig: {
    select: {
      id: true,
      unit: true,
      businessLocationId: true,
      displayName: true,
      shortName: true,
      icon: true,
      logoUrl: true,
      primaryColor: true,
      truckSlotMinutes: true,
      motorbikeSlotMinutes: true,
      businessLocation: {
        select: { locationName: true },
      },
    },
  },
  assignedSlot: {
    include: {
      zone: {
        select: {
          id: true,
          code: true,
          name: true,
          unitConfig: {
            select: {
              id: true,
              unit: true,
              businessLocationId: true,
              displayName: true,
              shortName: true,
              icon: true,
              logoUrl: true,
              primaryColor: true,
            },
          },
        },
      },
    },
  },
} as const;

export async function getTrackDelivery(registrationCode: string) {
  const code = registrationCode.trim().toUpperCase();
  const delivery = await prisma.deliveryRegistration.findFirst({
    where: { registrationCode: code },
    include: TRACK_INCLUDE,
  });
  if (!delivery) return null;

  let queueInfo = null;
  if (delivery.status === DeliveryStatus.WAITING && delivery.checkinTime) {
    const queueUnitWhere = delivery.unitConfigId
      ? { unitConfigId: delivery.unitConfigId }
      : { receivingUnit: delivery.receivingUnit };
    const slotUnitWhere = delivery.unitConfigId
      ? { zone: { unitConfigId: delivery.unitConfigId } }
      : { assignedUnit: delivery.receivingUnit };
    const [ahead, totalWaiting, timeConfig, unitCfg, slots] = await Promise.all([
      prisma.deliveryRegistration.count({
        where: {
          ...queueUnitWhere,
          vehicleType: delivery.vehicleType,
          status: DeliveryStatus.WAITING,
          checkinTime: { lt: delivery.checkinTime },
        },
      }),
      prisma.deliveryRegistration.count({
        where: {
          ...queueUnitWhere,
          vehicleType: delivery.vehicleType,
          status: DeliveryStatus.WAITING,
        },
      }),
      prisma.receivingTimeConfig.findFirst({
        where: {
          ...(delivery.unitConfigId ? { unitConfigId: delivery.unitConfigId } : { unit: delivery.receivingUnit }),
          vehicleType: delivery.vehicleType,
          goodsType: delivery.goodsType,
        },
      }),
      delivery.unitConfigId
        ? Promise.resolve(delivery.unitConfig)
        : prisma.unitConfig.findFirst({ where: { unit: delivery.receivingUnit, isActive: true }, orderBy: { createdAt: 'asc' } }),
      prisma.slot.findMany({
        where: {
          ...slotUnitWhere,
          vehicleType: delivery.vehicleType,
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
      }),
    ]);

    const position = ahead + 1;
    const availableSlots = slots.filter(s => s._count.deliveries < s.maxCapacity).length;
    const fallbackMinutes = delivery.vehicleType === 'MOTORBIKE'
      ? (unitCfg?.motorbikeSlotMinutes ?? 15)
      : (unitCfg?.truckSlotMinutes ?? 30);
    const avgReceivingMinutes = timeConfig?.configuredMinutes ?? fallbackMinutes;
    const estimatedWaitMinutes = availableSlots > 0
      ? Math.max(0, Math.round(Math.ceil((position - availableSlots) / availableSlots) * avgReceivingMinutes))
      : Math.round(position * avgReceivingMinutes);
    const sampleCount = timeConfig?.sampleCount ?? 0;
    const confidence: 'high' | 'medium' | 'low' =
      sampleCount >= 20 ? 'high' : sampleCount >= 5 ? 'medium' : 'low';

    queueInfo = {
      position,
      totalWaiting,
      estimatedWaitMinutes,
      availableSlots,
      avgReceivingMinutes,
      sampleCount,
      confidence,
      estimatedCallTime: new Date(Date.now() + estimatedWaitMinutes * 60_000).toISOString(),
    };
  }

  return {
    ...delivery,
    locationName: delivery.unitConfig?.businessLocation?.locationName ?? null,
    queueInfo,
  };
}

function hasTrackSubscribers(registrationCode: string): boolean {
  try {
    return (getIO().sockets.adapter.rooms.get(trackRoomName(registrationCode))?.size ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function emitTrackUpdated(registrationCode: string): Promise<void> {
  const code = registrationCode.trim().toUpperCase();
  if (!code || !hasTrackSubscribers(code)) return;
  const payload = await getTrackDelivery(code);
  if (!payload) return;
  getIO().to(trackRoomName(code)).emit('track_updated', payload);
}

export async function emitTrackUpdatesForQueue(queue: Array<{ registrationCode?: string | null }>): Promise<void> {
  const codes = new Set<string>();
  for (const item of queue) {
    if (item.registrationCode) codes.add(item.registrationCode);
  }

  await Promise.all([...codes].map((code) => emitTrackUpdated(code)));
}
