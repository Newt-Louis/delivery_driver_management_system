import { DeliveryStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getIO, trackRoomName, type SocketScope } from '../socket';

const TRACK_UNIT_CONFIG_SELECT = {
  id: true,
  unit: true,
  businessLocationId: true,
  displayName: true,
  shortName: true,
  icon: true,
  logoUrl: true,
  primaryColor: true,
} as const;

/**
 * Track payload (GET /api/track/:code and socket `track_updated`): only fields the track page
 * (and the queue estimate below) read. Opening it requires the registration code, so the driver's
 * own name/phone stay, but slot internals and unused delivery columns are not sent.
 */
const TRACK_SELECT = {
  id: true,
  registrationCode: true,
  status: true,
  vehiclePlate: true,
  vehicleType: true,
  goodsType: true,
  autoWarehouse: true,
  receivingUnit: true,
  unitConfigId: true,
  ticketNumber: true,
  vendorName: true,
  driverName: true,
  driverPhone: true,
  poNumber: true,
  note: true,
  requestedTime: true,
  checkinTime: true,
  calledTime: true,
  receivingStartTime: true,
  completedTime: true,
  createdAt: true,
  updatedAt: true,
  assignedSlotId: true,
  unitConfig: {
    select: {
      ...TRACK_UNIT_CONFIG_SELECT,
      truckSlotMinutes: true,
      motorbikeSlotMinutes: true,
      businessLocation: { select: { locationName: true } },
    },
  },
  assignedSlot: {
    select: {
      id: true,
      name: true,
      vehicleType: true,
      zone: { select: { id: true, code: true, name: true, unitConfig: { select: TRACK_UNIT_CONFIG_SELECT } } },
    },
  },
} as const;

export async function getTrackDelivery(registrationCode: string) {
  const code = registrationCode.trim().toUpperCase();
  const delivery = await prisma.deliveryRegistration.findFirst({
    where: { registrationCode: code },
    select: TRACK_SELECT,
  });
  if (!delivery) return null;

  // Recover the latest recall after a disconnected/hidden client returns.
  // calledTime remains the operational call time, not the recall timestamp.
  const latestCall = delivery.status === DeliveryStatus.CALLED
    ? await prisma.deliveryHistoryEvent.findFirst({
      where: { deliveryRegistrationId: delivery.id, eventType: { in: ['AUTO_ASSIGNED', 'MANUAL_CALLED', 'RECALLED', 'REASSIGNED_SLOT'] } },
      orderBy: { occurredAt: 'desc' }, select: { occurredAt: true },
    }) : null;

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
    notificationCalledAt: latestCall?.occurredAt ?? delivery.calledTime,
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

/**
 * Refresh track pages after a queue/slot change in `scope`. Only drivers who currently have their
 * track page open (a local `track:{code}` room) are considered: one query finds which of those codes
 * are active deliveries of the affected unit(s), then each gets `track_updated`. No listeners → no query.
 */
export async function emitTrackUpdatesForScope(scope: SocketScope): Promise<void> {
  let codes: string[];
  try {
    codes = [...getIO().sockets.adapter.rooms.keys()]
      .filter((room) => room.startsWith('track:'))
      .map((room) => room.slice('track:'.length));
  } catch {
    return;
  }
  if (codes.length === 0) return;

  const unitConfigIds = [...new Set([scope.unitConfigId, ...(scope.unitConfigIds ?? [])].filter((id): id is string => !!id))];
  const scopeWhere = unitConfigIds.length
    ? { OR: [{ unitConfigId: { in: unitConfigIds } }, { assignedSlot: { zone: { unitConfigId: { in: unitConfigIds } } } }] }
    : scope.businessLocationId
      ? { OR: [{ unitConfig: { businessLocationId: scope.businessLocationId } }, { assignedSlot: { zone: { unitConfig: { businessLocationId: scope.businessLocationId } } } }] }
      : null;
  if (!scopeWhere) return;

  const deliveries = await prisma.deliveryRegistration.findMany({
    where: {
      registrationCode: { in: codes },
      status: { in: [DeliveryStatus.WAITING, DeliveryStatus.CALLED, DeliveryStatus.RECEIVING, DeliveryStatus.AUTO_WAREHOUSE_RECEIVING] },
      ...scopeWhere,
    },
    select: { registrationCode: true },
  });
  await Promise.all(deliveries.map((delivery) => emitTrackUpdated(delivery.registrationCode)));
}
