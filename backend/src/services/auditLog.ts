import { AuditActorType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

type AuditJson = Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined;

export type AuditLogInput = {
  actorType: AuditActorType;
  actorId?: string | null;
  actorLabel?: string | null;
  businessLocationId?: string | null;
  unitConfigId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: AuditJson;
  after?: AuditJson;
  metadata?: AuditJson;
  requestId?: string | null;
};

export function userActor(user?: { id: string; name?: string | null; email?: string | null } | null) {
  return {
    actorType: AuditActorType.USER,
    actorId: user?.id ?? null,
    actorLabel: user?.name ?? user?.email ?? null,
  };
}

export function staffActor(staff?: { id: string; name?: string | null } | null) {
  return {
    actorType: AuditActorType.STAFF,
    actorId: staff?.id ?? null,
    actorLabel: staff?.name ?? null,
  };
}

export function deviceStaffActor(payload?: {
  deviceId?: string | null;
  deviceCode?: string | null;
  staffPinId?: string | null;
  staffName?: string | null;
} | null) {
  return {
    actorType: AuditActorType.DEVICE,
    actorId: payload?.deviceId ?? null,
    actorLabel: [
      payload?.deviceCode,
      payload?.staffName ? `staff:${payload.staffName}` : null,
      payload?.staffPinId ? `pin:${payload.staffPinId}` : null,
    ].filter(Boolean).join(' / ') || null,
  };
}

export function systemActor(label = 'system') {
  return {
    actorType: AuditActorType.SYSTEM,
    actorId: null,
    actorLabel: label,
  };
}

export async function recordAuditLog(input: AuditLogInput, client: AuditClient = prisma): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        actorType: input.actorType,
        actorId: input.actorId ?? undefined,
        actorLabel: input.actorLabel ?? undefined,
        businessLocationId: input.businessLocationId ?? undefined,
        unitConfigId: input.unitConfigId ?? undefined,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? undefined,
        before: input.before,
        after: input.after,
        metadata: input.metadata,
        requestId: input.requestId ?? undefined,
      },
    });
  } catch (error) {
    console.error('[AuditLog] failed to write audit log', {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      error,
    });
  }
}
