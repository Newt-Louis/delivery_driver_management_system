import { DeliveryStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getIO, trackRoomName } from '../socket';
import { getUnitConfigForDefaultLocation } from '../lib/businessLocation';

const TRACK_INCLUDE = {
  assignedSlot: { include: { zone: { select: { id: true, code: true, name: true } } } },
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
    const [ahead, totalWaiting, timeConfig, unitCfg, slots] = await Promise.all([
      prisma.deliveryRegistration.count({
        where: {
          receivingUnit: delivery.receivingUnit,
          vehicleType: delivery.vehicleType,
          status: DeliveryStatus.WAITING,
          checkinTime: { lt: delivery.checkinTime },
        },
      }),
      prisma.deliveryRegistration.count({
        where: {
          receivingUnit: delivery.receivingUnit,
          vehicleType: delivery.vehicleType,
          status: DeliveryStatus.WAITING,
        },
      }),
      prisma.receivingTimeConfig.findUnique({
        where: {
          unit_vehicleType_goodsType: {
            unit: delivery.receivingUnit,
            vehicleType: delivery.vehicleType,
            goodsType: delivery.goodsType,
          },
        },
      }),
      getUnitConfigForDefaultLocation(delivery.receivingUnit),
      prisma.slot.findMany({
        where: {
          assignedUnit: delivery.receivingUnit,
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

  return { ...delivery, queueInfo };
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
