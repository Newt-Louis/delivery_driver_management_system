import {
  AuditActorType,
  DeliveryHistoryEventType,
  DeliveryHistoryFinalStatus,
  DeliveryStatus,
  Prisma,
} from '@prisma/client';

export type HistoryActor = {
  actorType?: AuditActorType;
  actorId?: string | null;
  actorLabel?: string | null;
};

export type HistorySlotSnapshot = {
  slotId?: string | null;
  slotCode?: string | null;
  slotName?: string | null;
};

export type HistoryScope = {
  businessLocationId?: string | null;
  unitConfigId?: string | null;
};

export type RecordHistoryEventInput = HistoryActor & HistorySlotSnapshot & HistoryScope & {
  deliveryHistoryId?: string | null;
  deliveryRegistrationId?: string | null;
  originalDeliveryId: string;
  registrationCode: string;
  eventType: DeliveryHistoryEventType;
  fromStatus?: DeliveryStatus | null;
  toStatus?: DeliveryStatus | null;
  occurredAt?: Date;
  message?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

export type ArchiveDeliveryReason =
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED_NO_SHOW'
  | 'EXPIRED_WAITING'
  | 'INCOMPLETED';

export type ArchiveDeliveryInput = HistoryActor & {
  deliveryId: string;
  finalStatus: DeliveryHistoryFinalStatus;
  archiveReason: ArchiveDeliveryReason;
  closeReason?: string | null;
  jobRunId?: string | null;
  occurredAt?: Date;
  deleteOperationalRow?: boolean;
};
