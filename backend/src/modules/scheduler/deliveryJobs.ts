import {
  DeliveryHistoryEventType,
  DeliveryHistoryFinalStatus,
  DeliveryStatus,
  Prisma,
  SchedulerJobStatus,
  SchedulerJobTrigger,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getVNDateKey, getVNDateRangeUtc } from '../../lib/dateVN';
import { helperFunctions } from '../../helperFunction';
import { emitQueueUpdated, emitSlotUpdated } from '../../socket';
import { recordAuditLog, systemActor } from '../../services/auditLog';
import { triggerAutoAssign } from '../../services/autoAssign';
import { cancelDelivery } from '../../services/deliveryLifecycle';
import { getScopeForDelivery } from '../../services/realtimeScope';
import { emitTrackUpdated, emitTrackUpdatesForQueue } from '../../services/trackRealtime';
import { sendPushToDelivery } from '../../services/webPush';
import { archiveDelivery } from '../history/archiveService';
import { startSchedulerJobHistory, finishSchedulerJobHistory } from './jobHistory';
import * as deliveryRepository from '../deliveries/deliveryRepository';

export type SchedulerJobResult = {
  jobRunId: string;
  processed: number;
  succeeded: number;
  failed: number;
};

export async function closeDailyDeliveries(args: {
  businessDate?: string;
  trigger?: SchedulerJobTrigger;
  businessLocationId?: string;
  unitConfigIds?: string[];
} = {}): Promise<SchedulerJobResult> {
  const businessDate = args.businessDate ?? getVNDateKey();
  const { start, end } = getVNDateRangeUtc(businessDate);
  const now = new Date();
  const job = await startSchedulerJobHistory({
    jobName: 'close-daily-deliveries',
    businessDate,
    trigger: args.trigger ?? SchedulerJobTrigger.SCHEDULED,
    metadata: {
      start: start.toISOString(),
      end: end.toISOString(),
      businessLocationId: args.businessLocationId ?? null,
      unitConfigIds: args.unitConfigIds ?? null,
    },
  });

  const candidates = await prisma.deliveryRegistration.findMany({
    where: {
      AND: [
        {
          OR: [
            {
              status: DeliveryStatus.REGISTERED,
              OR: [
                { requestedTime: { gte: start, lt: end } },
                { requestedTime: null, createdAt: { gte: start, lt: end } },
              ],
            },
            {
              status: { in: [DeliveryStatus.RECEIVING, DeliveryStatus.AUTO_WAREHOUSE_RECEIVING] },
              OR: [
                { requestedTime: { gte: start, lt: end } },
                { requestedTime: null, checkinTime: { gte: start, lt: end } },
              ],
            },
          ],
        },
        ...(args.businessLocationId
          ? [{
              OR: [
                { unitConfig: { businessLocationId: args.businessLocationId } },
                { assignedSlot: { zone: { unitConfig: { businessLocationId: args.businessLocationId } } } },
              ],
            }]
          : []),
        ...(args.unitConfigIds
          ? [{ unitConfigId: args.unitConfigIds.length > 0 ? { in: args.unitConfigIds } : '__NO_UNIT_SCOPE__' }]
          : []),
      ],
    },
    select: { id: true, status: true, registrationCode: true, vehiclePlate: true },
  });

  let succeeded = 0;
  let failed = 0;
  const errors: Array<{ deliveryId: string; error: string }> = [];

  for (const candidate of candidates) {
    try {
      if (candidate.status === DeliveryStatus.REGISTERED) {
        await prisma.deliveryRegistration.update({
          where: { id: candidate.id },
          data: {
            status: DeliveryStatus.EXPIRED,
            note: 'Hết hạn: không tới check-in',
          },
        });
        await archiveDelivery({
          deliveryId: candidate.id,
          finalStatus: DeliveryHistoryFinalStatus.EXPIRED,
          archiveReason: 'EXPIRED_NO_SHOW',
          closeReason: 'Không tới check-in',
          jobRunId: job.id,
          occurredAt: now,
          deleteOperationalRow: true,
          ...systemActor('scheduler.close-daily-deliveries'),
        });
      } else {
        await prisma.deliveryRegistration.update({
          where: { id: candidate.id },
          data: {
            status: DeliveryStatus.INCOMPLETED,
            note: 'Chưa hoàn tất nhận hàng cuối ngày',
          },
        });
        await archiveDelivery({
          deliveryId: candidate.id,
          finalStatus: DeliveryHistoryFinalStatus.INCOMPLETED,
          archiveReason: 'INCOMPLETED',
          closeReason: 'Chưa hoàn tất nhận hàng cuối ngày',
          jobRunId: job.id,
          occurredAt: now,
          deleteOperationalRow: true,
          ...systemActor('scheduler.close-daily-deliveries'),
        });
      }
      sendPushToDelivery(candidate.registrationCode, {
        status: candidate.status === DeliveryStatus.REGISTERED ? 'EXPIRED' : 'INCOMPLETED',
        occurredAt: now.toISOString(), title: 'Lượt giao hàng đã kết thúc',
        body: `Xe ${candidate.vehiclePlate} — vui lòng liên hệ nhân viên nếu cần hỗ trợ.`,
        url: `/track/${candidate.registrationCode}`,
      }).catch(console.error);
      succeeded++;
    } catch (error) {
      failed++;
      errors.push({ deliveryId: candidate.id, error: helperFunctions.errorMessage(error) });
    }
  }

  await finishSchedulerJobHistory({
    id: job.id,
    status: failed > 0 ? SchedulerJobStatus.FAILED : SchedulerJobStatus.SUCCESS,
    processedCount: candidates.length,
    succeededCount: succeeded,
    failedCount: failed,
    errorMessage: errors[0]?.error ?? null,
    metadata: { errors: errors.slice(0, 20) as Prisma.InputJsonValue },
  });

  return { jobRunId: job.id, processed: candidates.length, succeeded, failed };
}

export async function archiveDeliveries(args: {
  trigger?: SchedulerJobTrigger;
  olderThanMinutes?: number;
} = {}): Promise<SchedulerJobResult> {
  const olderThanMinutes = args.olderThanMinutes ?? 120;
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const job = await startSchedulerJobHistory({
    jobName: 'archive-deliveries',
    businessDate: getVNDateKey(),
    trigger: args.trigger ?? SchedulerJobTrigger.SCHEDULED,
    metadata: { cancelledOlderThanMinutes: olderThanMinutes, cutoff: cutoff.toISOString() },
  });

  const candidates = await prisma.deliveryRegistration.findMany({
    where: {
      OR: [
        { status: DeliveryStatus.COMPLETED },
        { status: DeliveryStatus.CANCELLED, cancelReason: { not: null }, updatedAt: { lte: cutoff } },
      ],
    },
    select: { id: true, status: true, cancelReason: true },
  });
  let succeeded = 0;
  const errors: Array<{ deliveryId: string; error: string }> = [];
  const completed = candidates.filter((candidate) => candidate.status === DeliveryStatus.COMPLETED);
  const cancelled = candidates.filter((candidate) => candidate.status === DeliveryStatus.CANCELLED);

  // Bound each batch so SQL parameter limits and transaction size stay predictable.
  for (let offset = 0; offset < completed.length; offset += 500) {
    const batch = completed.slice(offset, offset + 500);
    try {
      const histories = await prisma.deliveryHistory.findMany({
        where: { originalDeliveryId: { in: batch.map((candidate) => candidate.id) } },
        select: { originalDeliveryId: true, finalStatus: true },
      });
      const historyByDelivery = new Map(histories.map((history) => [history.originalDeliveryId, history.finalStatus]));
      const ready = batch.filter((candidate) => historyByDelivery.get(candidate.id) === DeliveryHistoryFinalStatus.COMPLETED);
      for (const candidate of batch) {
        const status = historyByDelivery.get(candidate.id);
        if (status && status !== DeliveryHistoryFinalStatus.COMPLETED) {
          errors.push({ deliveryId: candidate.id, error: `History has unexpected status ${status}` });
        }
      }
      if (ready.length) {
        // Recheck both the operational status and matching history in the DELETE itself.
        const deleted = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw(Prisma.sql`
            SELECT h."id" FROM "delivery_history" AS h
            WHERE h."original_delivery_id" IN (${Prisma.join(ready.map((candidate) => candidate.id))})
              AND h."final_status" = 'COMPLETED'
            FOR SHARE
          `);
          return tx.$queryRaw<{ id: string }[]>(Prisma.sql`
            DELETE FROM "delivery_registrations" AS d
            WHERE d."id" IN (${Prisma.join(ready.map((candidate) => candidate.id))})
              AND d."status" = 'COMPLETED'
              AND EXISTS (
                SELECT 1 FROM "delivery_history" AS h
                WHERE h."original_delivery_id" = d."id" AND h."final_status" = 'COMPLETED'
              )
            RETURNING d."id"
          `);
        });
        const deletedIds = new Set(deleted.map((row) => row.id));
        succeeded += deleted.length;
        for (const candidate of ready) {
          if (!deletedIds.has(candidate.id)) errors.push({ deliveryId: candidate.id, error: 'Delivery or completed history changed before deletion' });
        }
      }
      for (const candidate of batch.filter((item) => !historyByDelivery.has(item.id))) {
        try {
          const result = await archiveDelivery({
            deliveryId: candidate.id, finalStatus: DeliveryHistoryFinalStatus.COMPLETED,
            archiveReason: 'COMPLETED', closeReason: 'Hoàn tất nhận hàng',
            jobRunId: job.id, deleteOperationalRow: true, expectedStatus: DeliveryStatus.COMPLETED,
            ...systemActor('scheduler.archive-deliveries'),
          });
          if (!result.deleted) throw new Error('Delivery was not deleted');
          succeeded++;
        } catch (error) {
          errors.push({ deliveryId: candidate.id, error: helperFunctions.errorMessage(error) });
        }
      }
    } catch (error) {
      for (const candidate of batch) errors.push({ deliveryId: candidate.id, error: helperFunctions.errorMessage(error) });
    }
  }
  for (const candidate of cancelled) {
    try {
      const result = await archiveDelivery({
        deliveryId: candidate.id, finalStatus: DeliveryHistoryFinalStatus.CANCELLED,
        archiveReason: 'CANCELLED', closeReason: candidate.cancelReason,
        jobRunId: job.id, occurredAt: new Date(), deleteOperationalRow: true,
        expectedStatus: DeliveryStatus.CANCELLED, updatedBefore: cutoff, ...systemActor('scheduler.archive-deliveries'),
      });
      if (!result.deleted) throw new Error('Delivery was not deleted');
      succeeded++;
    } catch (error) {
      errors.push({ deliveryId: candidate.id, error: helperFunctions.errorMessage(error) });
    }
  }
  const failed = errors.length;
  await finishSchedulerJobHistory({
    id: job.id, status: failed > 0 ? SchedulerJobStatus.FAILED : SchedulerJobStatus.SUCCESS,
    processedCount: candidates.length, succeededCount: succeeded, failedCount: failed,
    errorMessage: errors[0]?.error ?? null, metadata: { errors: errors.slice(0, 20) as Prisma.InputJsonValue },
  });
  return { jobRunId: job.id, processed: candidates.length, succeeded, failed };
}

const CALLED_NO_SHOW_REASON = 'Tài xế check-in rồi nhưng không vào';
const CALL_EVENT_TYPES: DeliveryHistoryEventType[] = [
  DeliveryHistoryEventType.AUTO_ASSIGNED,
  DeliveryHistoryEventType.MANUAL_CALLED,
  DeliveryHistoryEventType.RECALLED,
  DeliveryHistoryEventType.REASSIGNED_SLOT,
];

export async function autoCancelCalledNoShowDeliveries(args: {
  trigger?: SchedulerJobTrigger;
} = {}): Promise<SchedulerJobResult> {
  const job = await startSchedulerJobHistory({
    jobName: 'auto-cancel-called-no-show',
    businessDate: getVNDateKey(),
    trigger: args.trigger ?? SchedulerJobTrigger.SCHEDULED,
    metadata: { reason: CALLED_NO_SHOW_REASON },
  });

  const candidates = await prisma.deliveryRegistration.findMany({
    where: {
      status: DeliveryStatus.CALLED,
      calledTime: { not: null },
      unitConfig: {
        autoCancelCalledEnabled: true,
      },
    },
    include: {
      unitConfig: {
        select: {
          id: true,
          autoCancelCalledAfterMinutes: true,
        },
      },
    },
    orderBy: { calledTime: 'asc' },
  });

  let succeeded = 0;
  let failed = 0;
  const errors: Array<{ deliveryId: string; error: string }> = [];
  const affectedScopes = new Map<string, Awaited<ReturnType<typeof getScopeForDelivery>>>();

  for (const candidate of candidates) {
    try {
      const latestCallEvent = await prisma.deliveryHistoryEvent.findFirst({
        where: {
          originalDeliveryId: candidate.id,
          eventType: { in: CALL_EVENT_TYPES },
        },
        orderBy: { occurredAt: 'desc' },
        select: { occurredAt: true },
      });
      const lastCalledAt = latestCallEvent?.occurredAt ?? candidate.calledTime;
      if (!lastCalledAt) continue;

      const elapsedMinutes = Math.floor((Date.now() - lastCalledAt.getTime()) / 60_000);
      const thresholdMinutes = candidate.unitConfig?.autoCancelCalledAfterMinutes ?? 15;
      if (elapsedMinutes < thresholdMinutes) continue;

      const actor = systemActor('scheduler.auto-cancel-called-no-show');
      const result = await cancelDelivery(candidate.id, CALLED_NO_SHOW_REASON, actor, { message: CALLED_NO_SHOW_REASON });
      if (!result.delivery || !result.changed) continue;

      const scope = await getScopeForDelivery(result.delivery);
      const scopeKey = `${scope.businessLocationId ?? ''}:${scope.unitConfigId ?? ''}`;
      affectedScopes.set(scopeKey, scope);

      await recordAuditLog({
        ...actor,
        action: 'delivery.auto_cancel_called_no_show',
        targetType: 'DeliveryRegistration',
        targetId: result.delivery.id,
        businessLocationId: scope.businessLocationId,
        unitConfigId: scope.unitConfigId,
        after: {
          status: result.delivery.status,
          registrationCode: result.delivery.registrationCode,
          vehiclePlate: result.delivery.vehiclePlate,
          cancelReason: CALLED_NO_SHOW_REASON,
          thresholdMinutes,
          lastCalledAt: lastCalledAt.toISOString(),
        },
        metadata: { jobRunId: job.id, source: 'scheduler.auto-cancel-called-no-show' },
      });

      if (result.releasedSlotId) {
        triggerAutoAssign(result.delivery.receivingUnit, scope).catch(console.error);
      }
      emitTrackUpdated(result.delivery.registrationCode).catch(console.error);
      sendPushToDelivery(result.delivery.registrationCode, {
        status: 'CANCELLED', occurredAt: result.delivery.updatedAt.toISOString(),
        title: 'Chuyến giao hàng đã hủy', body: `Xe ${result.delivery.vehiclePlate} — ${CALLED_NO_SHOW_REASON}.`,
        url: `/track/${result.delivery.registrationCode}`,
      }).catch(console.error);
      succeeded++;
    } catch (error) {
      failed++;
      errors.push({ deliveryId: candidate.id, error: helperFunctions.errorMessage(error) });
    }
  }

  for (const scope of affectedScopes.values()) {
    const [queue, slots] = await Promise.all([
      deliveryRepository.getFullQueue(scope),
      deliveryRepository.getAllSlots(scope),
    ]);
    emitQueueUpdated(queue, scope);
    emitSlotUpdated(slots, scope);
    emitTrackUpdatesForQueue(queue).catch(console.error);
  }

  await finishSchedulerJobHistory({
    id: job.id,
    status: failed > 0 ? SchedulerJobStatus.FAILED : SchedulerJobStatus.SUCCESS,
    processedCount: candidates.length,
    succeededCount: succeeded,
    failedCount: failed,
    errorMessage: errors[0]?.error ?? null,
    metadata: { errors: errors.slice(0, 20) as Prisma.InputJsonValue },
  });

  return { jobRunId: job.id, processed: candidates.length, succeeded, failed };
}
