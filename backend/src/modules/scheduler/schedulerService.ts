import cron, { type ScheduledTask } from 'node-cron';
import { SchedulerJobTrigger } from '@prisma/client';
import {
  archiveCancelledDeliveries,
  autoCancelCalledNoShowDeliveries,
  closeDailyDeliveries,
  type SchedulerJobResult,
} from './deliveryJobs';

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const DAILY_CLOSE_CRON = '59 23 * * *';
const CANCELLED_ARCHIVE_CRON = '0 */2 * * *';
const CALLED_NO_SHOW_CRON = '* * * * *';

interface JobState {
  isRunning: boolean;
  task: ScheduledTask | null;
  lastRunAt: Date | null;
  lastResult: SchedulerJobResult | null;
  nextRunAt: Date | null;
}

const dailyCloseJob: JobState = { isRunning: false, task: null, lastRunAt: null, lastResult: null, nextRunAt: null };
const cancelledArchiveJob: JobState = { isRunning: false, task: null, lastRunAt: null, lastResult: null, nextRunAt: null };
const calledNoShowJob: JobState = { isRunning: false, task: null, lastRunAt: null, lastResult: null, nextRunAt: null };

function nextVietnamDailyRunUtc(hour: number, minute: number): Date {
  const nowInVietnam = new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
  const nextInVietnam = new Date(nowInVietnam);
  nextInVietnam.setHours(hour, minute, 0, 0);
  if (nextInVietnam.getTime() <= nowInVietnam.getTime()) {
    nextInVietnam.setDate(nextInVietnam.getDate() + 1);
  }
  return new Date(nextInVietnam.getTime() - 7 * 60 * 60 * 1000);
}

function nextIntervalRun(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

async function runJob(
  name: string,
  state: JobState,
  fn: () => Promise<SchedulerJobResult>,
  resolveNextRun: () => Date,
) {
  if (state.isRunning) {
    console.warn(`[scheduler] ${name} skipped: previous run still in progress`);
    return;
  }

  state.isRunning = true;
  state.lastRunAt = new Date();
  try {
    const result = await fn();
    state.lastResult = result;
    console.log(`[scheduler] ${name} done: ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed`);
  } catch (error) {
    console.error(`[scheduler] ${name} failed`, error);
  } finally {
    state.isRunning = false;
    state.nextRunAt = resolveNextRun();
  }
}

function scheduleJob(
  name: string,
  expression: string,
  state: JobState,
  fn: () => Promise<SchedulerJobResult>,
  resolveNextRun: () => Date,
) {
  state.nextRunAt = resolveNextRun();
  state.task = cron.schedule(
    expression,
    () => {
      void runJob(name, state, fn, resolveNextRun);
    },
    { timezone: TIMEZONE },
  );
  console.log(`[scheduler] ${name} scheduled with cron "${expression}" (${TIMEZONE})`);
}

function jobStatus(state: JobState) {
  return {
    nextRunAt: state.nextRunAt?.toISOString() ?? null,
    isRunning: state.isRunning,
    lastRunAt: state.lastRunAt?.toISOString() ?? null,
    lastProcessed: state.lastResult?.processed ?? null,
    lastSucceeded: state.lastResult?.succeeded ?? null,
    lastFailed: state.lastResult?.failed ?? null,
  };
}

export function getSchedulerStatus() {
  return {
    dailyClose: jobStatus(dailyCloseJob),
    cancelledArchive: jobStatus(cancelledArchiveJob),
    calledNoShowAutoCancel: jobStatus(calledNoShowJob),
  };
}

export function startOperationalScheduler() {
  console.log(`[scheduler] Starting operational scheduler (${TIMEZONE})`);

  scheduleJob(
    'close-daily-deliveries',
    DAILY_CLOSE_CRON,
    dailyCloseJob,
    () => closeDailyDeliveries({ trigger: SchedulerJobTrigger.SCHEDULED }),
    () => nextVietnamDailyRunUtc(23, 59),
  );
  scheduleJob(
    'archive-cancelled-deliveries',
    CANCELLED_ARCHIVE_CRON,
    cancelledArchiveJob,
    () => archiveCancelledDeliveries({ trigger: SchedulerJobTrigger.SCHEDULED }),
    () => nextIntervalRun(120),
  );
  scheduleJob(
    'auto-cancel-called-no-show',
    CALLED_NO_SHOW_CRON,
    calledNoShowJob,
    () => autoCancelCalledNoShowDeliveries({ trigger: SchedulerJobTrigger.SCHEDULED }),
    () => nextIntervalRun(1),
  );

  return {
    stop() {
      dailyCloseJob.task?.stop();
      cancelledArchiveJob.task?.stop();
      calledNoShowJob.task?.stop();
      dailyCloseJob.task = null;
      cancelledArchiveJob.task = null;
      calledNoShowJob.task = null;
      console.log('[scheduler] Scheduler stopped');
    },
  };
}
