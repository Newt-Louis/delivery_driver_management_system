import {
  DeliveryHistoryFinalStatus,
  DeliveryStatus,
  Prisma,
  SchedulerJobStatus,
  SchedulerJobTrigger,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getVNDateKey, getVNDateRangeUtc } from '../../lib/dateVN';
import { archiveDelivery } from '../history/archiveService';
import { systemActor } from '../../services/auditLog';
import { startSchedulerJobHistory, finishSchedulerJobHistory } from './jobHistory';

export type SchedulerJobResult = {
  jobRunId: string;
  processed: number;
  succeeded: number;
  failed: number;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function closeDailyDeliveries(args: {
  businessDate?: string;
  trigger?: SchedulerJobTrigger;
} = {}): Promise<SchedulerJobResult> {
  const businessDate = args.businessDate ?? getVNDateKey();
  const { start, end } = getVNDateRangeUtc(businessDate);
  const now = new Date();
  const job = await startSchedulerJobHistory({
    jobName: 'close-daily-deliveries',
    businessDate,
    trigger: args.trigger ?? SchedulerJobTrigger.SCHEDULED,
    metadata: { start: start.toISOString(), end: end.toISOString() },
  });

  const candidates = await prisma.deliveryRegistration.findMany({
    where: {
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
    select: { id: true, status: true },
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
      succeeded++;
    } catch (error) {
      failed++;
      errors.push({ deliveryId: candidate.id, error: errorMessage(error) });
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

export async function archiveCancelledDeliveries(args: {
  trigger?: SchedulerJobTrigger;
  olderThanMinutes?: number;
} = {}): Promise<SchedulerJobResult> {
  const olderThanMinutes = args.olderThanMinutes ?? 120;
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const job = await startSchedulerJobHistory({
    jobName: 'archive-cancelled-deliveries',
    businessDate: getVNDateKey(),
    trigger: args.trigger ?? SchedulerJobTrigger.SCHEDULED,
    metadata: { olderThanMinutes, cutoff: cutoff.toISOString() },
  });

  const candidates = await prisma.deliveryRegistration.findMany({
    where: {
      status: DeliveryStatus.CANCELLED,
      cancelReason: { not: null },
      updatedAt: { lte: cutoff },
    },
    select: { id: true, cancelReason: true },
  });

  let succeeded = 0;
  let failed = 0;
  const errors: Array<{ deliveryId: string; error: string }> = [];

  for (const candidate of candidates) {
    try {
      await archiveDelivery({
        deliveryId: candidate.id,
        finalStatus: DeliveryHistoryFinalStatus.CANCELLED,
        archiveReason: 'CANCELLED',
        closeReason: candidate.cancelReason,
        jobRunId: job.id,
        occurredAt: new Date(),
        deleteOperationalRow: true,
        ...systemActor('scheduler.archive-cancelled-deliveries'),
      });
      succeeded++;
    } catch (error) {
      failed++;
      errors.push({ deliveryId: candidate.id, error: errorMessage(error) });
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
