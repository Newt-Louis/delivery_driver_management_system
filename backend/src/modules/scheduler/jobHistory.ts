import { Prisma, SchedulerJobStatus, SchedulerJobTrigger } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export async function startSchedulerJobHistory(args: {
  jobName: string;
  businessDate?: string | null;
  trigger?: SchedulerJobTrigger;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.schedulerJobHistory.create({
    data: {
      jobName: args.jobName,
      businessDate: args.businessDate ?? null,
      trigger: args.trigger ?? SchedulerJobTrigger.SCHEDULED,
      status: SchedulerJobStatus.RUNNING,
      metadata: args.metadata,
    },
  });
}

export async function finishSchedulerJobHistory(args: {
  id: string;
  status: SchedulerJobStatus;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  errorMessage?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.schedulerJobHistory.update({
    where: { id: args.id },
    data: {
      status: args.status,
      finishedAt: new Date(),
      processedCount: args.processedCount,
      succeededCount: args.succeededCount,
      failedCount: args.failedCount,
      errorMessage: args.errorMessage ?? null,
      metadata: args.metadata,
    },
  });
}
