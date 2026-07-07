import {
  DeliveryHistoryEventType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { RecordHistoryEventInput } from './types';

export type HistoryClient = Prisma.TransactionClient | typeof prisma;

const CALL_EVENT_TYPES: DeliveryHistoryEventType[] = [
  DeliveryHistoryEventType.AUTO_ASSIGNED,
  DeliveryHistoryEventType.MANUAL_CALLED,
  DeliveryHistoryEventType.RECALLED,
  DeliveryHistoryEventType.REASSIGNED_SLOT,
];

export async function recordDeliveryHistoryEvent(
  input: RecordHistoryEventInput,
  client: HistoryClient = prisma,
) {
  return client.deliveryHistoryEvent.create({
    data: {
      deliveryHistoryId: input.deliveryHistoryId ?? null,
      deliveryRegistrationId: input.deliveryRegistrationId ?? null,
      originalDeliveryId: input.originalDeliveryId,
      registrationCode: input.registrationCode,
      businessLocationId: input.businessLocationId ?? null,
      unitConfigId: input.unitConfigId ?? null,
      eventType: input.eventType,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      actorType: input.actorType ?? null,
      actorId: input.actorId ?? null,
      actorLabel: input.actorLabel ?? null,
      slotId: input.slotId ?? null,
      slotCode: input.slotCode ?? null,
      slotName: input.slotName ?? null,
      message: input.message ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function countCallHistoryEvents(
  originalDeliveryId: string,
  client: HistoryClient = prisma,
): Promise<number> {
  return client.deliveryHistoryEvent.count({
    where: {
      originalDeliveryId,
      eventType: { in: CALL_EVENT_TYPES },
    },
  });
}

export async function getCallHistoryCounts(
  originalDeliveryIds: string[],
  client: HistoryClient = prisma,
): Promise<Map<string, number>> {
  if (originalDeliveryIds.length === 0) return new Map();

  const rows = await client.deliveryHistoryEvent.groupBy({
    by: ['originalDeliveryId'],
    where: {
      originalDeliveryId: { in: originalDeliveryIds },
      eventType: { in: CALL_EVENT_TYPES },
    },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.originalDeliveryId, row._count._all]));
}

export async function getLastCallHistoryEvent(
  originalDeliveryId: string,
  client: HistoryClient = prisma,
) {
  return client.deliveryHistoryEvent.findFirst({
    where: {
      originalDeliveryId,
      eventType: { in: CALL_EVENT_TYPES },
    },
    orderBy: { occurredAt: 'desc' },
  });
}

export async function listDeliveryHistoryEvents(args: {
  deliveryHistoryId?: string;
  deliveryRegistrationId?: string;
  originalDeliveryId?: string;
  registrationCode?: string;
}) {
  return prisma.deliveryHistoryEvent.findMany({
    where: {
      ...(args.deliveryHistoryId ? { deliveryHistoryId: args.deliveryHistoryId } : {}),
      ...(args.deliveryRegistrationId ? { deliveryRegistrationId: args.deliveryRegistrationId } : {}),
      ...(args.originalDeliveryId ? { originalDeliveryId: args.originalDeliveryId } : {}),
      ...(args.registrationCode ? { registrationCode: args.registrationCode } : {}),
    },
    orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
  });
}

export { CALL_EVENT_TYPES };
