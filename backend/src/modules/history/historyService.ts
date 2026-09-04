import {
  DeliveryHistoryEventType,
  DeliveryRegistration,
  Prisma,
  Slot,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { recordDeliveryHistoryEvent, type HistoryClient } from './historyRepository';
import type { HistoryActor, HistoryScope, HistorySlotSnapshot } from './types';

type DeliveryForHistory = DeliveryRegistration & {
  assignedSlot?: Slot | null;
};

async function resolveDeliveryScope(
  client: HistoryClient,
  delivery: Pick<DeliveryRegistration, 'unitConfigId' | 'assignedSlotId'>,
): Promise<HistoryScope & HistorySlotSnapshot> {
  if (delivery.assignedSlotId) {
    const slot = await client.slot.findUnique({
      where: { id: delivery.assignedSlotId },
      select: {
        id: true,
        code: true,
        name: true,
        zone: {
          select: {
            unitConfigId: true,
            unitConfig: { select: { businessLocationId: true } },
          },
        },
      },
    });
    if (slot) {
      return {
        businessLocationId: slot.zone.unitConfig.businessLocationId,
        unitConfigId: slot.zone.unitConfigId,
        slotId: slot.id,
        slotCode: slot.code,
        slotName: slot.name,
      };
    }
  }

  const unitConfig = delivery.unitConfigId
    ? await client.unitConfig.findUnique({
        where: { id: delivery.unitConfigId },
        select: { id: true, businessLocationId: true },
      })
    : null;

  return {
    businessLocationId: unitConfig?.businessLocationId ?? null,
    unitConfigId: unitConfig?.id ?? null,
  };
}

export async function recordDeliveryEvent(
  delivery: DeliveryForHistory,
  args: HistoryActor & {
    eventType: DeliveryHistoryEventType;
    fromStatus?: DeliveryRegistration['status'] | null;
    toStatus?: DeliveryRegistration['status'] | null;
    occurredAt?: Date;
    message?: string | null;
    reason?: string | null;
    metadata?: Prisma.InputJsonValue | null;
    slot?: Slot | null;
  },
  client: HistoryClient = prisma,
) {
  const scope = await resolveDeliveryScope(client, {
    unitConfigId: delivery.unitConfigId,
    assignedSlotId: args.slot?.id ?? delivery.assignedSlotId,
  });
  const slotSnapshot = args.slot
    ? { slotId: args.slot.id, slotCode: args.slot.code, slotName: args.slot.name }
    : {
        slotId: scope.slotId,
        slotCode: scope.slotCode,
        slotName: scope.slotName,
      };

  return recordDeliveryHistoryEvent({
    deliveryRegistrationId: delivery.id,
    originalDeliveryId: delivery.id,
    registrationCode: delivery.registrationCode,
    businessLocationId: scope.businessLocationId,
    unitConfigId: scope.unitConfigId,
    eventType: args.eventType,
    fromStatus: args.fromStatus,
    toStatus: args.toStatus,
    occurredAt: args.occurredAt,
    actorType: args.actorType,
    actorId: args.actorId,
    actorLabel: args.actorLabel,
    ...slotSnapshot,
    message: args.message,
    reason: args.reason,
    metadata: args.metadata,
  }, client);
}

export { resolveDeliveryScope };
