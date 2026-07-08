import { SchedulerJobTrigger } from '@prisma/client';
import { archiveCancelledDeliveries, closeDailyDeliveries, type SchedulerJobResult } from './deliveryJobs';

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAILY_CLOSE_HOUR = 23;
const DAILY_CLOSE_MINUTE = 59;
const CANCELLED_ARCHIVE_INTERVAL_MS = 120 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000;

interface JobState {
  isRunning: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  lastRunAt: Date | null;
  lastResult: SchedulerJobResult | null;
  nextRunAt: Date | null;
}

const dailyCloseJob: JobState = { isRunning: false, timer: null, lastRunAt: null, lastResult: null, nextRunAt: null };
const cancelledArchiveJob: JobState = { isRunning: false, timer: null, lastRunAt: null, lastResult: null, nextRunAt: null };
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function nextVietnamDailyRunUtc(hour: number, minute: number, from = new Date()): Date {
  const vnNow = new Date(from.getTime() + VN_OFFSET_MS);
  let target = new Date(Date.UTC(
    vnNow.getUTCFullYear(),
    vnNow.getUTCMonth(),
    vnNow.getUTCDate(),
    hour,
    minute,
    0,
    0,
  ) - VN_OFFSET_MS);

  if (target <= from) {
    target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
  }
  return target;
}

function scheduleNextDailyClose(): void {
  const nextRun = nextVietnamDailyRunUtc(DAILY_CLOSE_HOUR, DAILY_CLOSE_MINUTE);
  const delay = Math.max(1_000, nextRun.getTime() - Date.now());
  dailyCloseJob.nextRunAt = nextRun;

  if (dailyCloseJob.timer) clearTimeout(dailyCloseJob.timer);
  dailyCloseJob.timer = setTimeout(async () => {
    if (dailyCloseJob.isRunning) {
      console.warn('[scheduler] close-daily-deliveries skipped: previous run still in progress');
      scheduleNextDailyClose();
      return;
    }
    dailyCloseJob.isRunning = true;
    dailyCloseJob.lastRunAt = new Date();
    try {
      const result = await closeDailyDeliveries({ trigger: SchedulerJobTrigger.SCHEDULED });
      dailyCloseJob.lastResult = result;
      console.log(`[scheduler] close-daily-deliveries done: ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed`);
    } catch (error) {
      console.error('[scheduler] close-daily-deliveries failed', error);
    } finally {
      dailyCloseJob.isRunning = false;
      scheduleNextDailyClose();
    }
  }, delay);
  console.log(`[scheduler] close-daily-deliveries scheduled at ${nextRun.toISOString()} (${TIMEZONE})`);
}

function scheduleCancelledArchive(): void {
  const nextRun = new Date(Date.now() + CANCELLED_ARCHIVE_INTERVAL_MS);
  cancelledArchiveJob.nextRunAt = nextRun;

  if (cancelledArchiveJob.timer) clearTimeout(cancelledArchiveJob.timer);
  cancelledArchiveJob.timer = setTimeout(async () => {
    if (cancelledArchiveJob.isRunning) {
      console.warn('[scheduler] archive-cancelled-deliveries skipped: previous run still in progress');
      scheduleCancelledArchive();
      return;
    }
    cancelledArchiveJob.isRunning = true;
    cancelledArchiveJob.lastRunAt = new Date();
    try {
      const result = await archiveCancelledDeliveries({ trigger: SchedulerJobTrigger.SCHEDULED });
      cancelledArchiveJob.lastResult = result;
      console.log(`[scheduler] archive-cancelled-deliveries done: ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed`);
    } catch (error) {
      console.error('[scheduler] archive-cancelled-deliveries failed', error);
    } finally {
      cancelledArchiveJob.isRunning = false;
      scheduleCancelledArchive();
    }
  }, CANCELLED_ARCHIVE_INTERVAL_MS);
  console.log(`[scheduler] archive-cancelled-deliveries scheduled at ${nextRun.toISOString()} (${TIMEZONE})`);
}

export function getSchedulerStatus() {
  return {
    dailyClose: {
      nextRunAt: dailyCloseJob.nextRunAt?.toISOString() ?? null,
      isRunning: dailyCloseJob.isRunning,
      lastRunAt: dailyCloseJob.lastRunAt?.toISOString() ?? null,
      lastProcessed: dailyCloseJob.lastResult?.processed ?? null,
      lastSucceeded: dailyCloseJob.lastResult?.succeeded ?? null,
      lastFailed: dailyCloseJob.lastResult?.failed ?? null,
    },
    cancelledArchive: {
      nextRunAt: cancelledArchiveJob.nextRunAt?.toISOString() ?? null,
      isRunning: cancelledArchiveJob.isRunning,
      lastRunAt: cancelledArchiveJob.lastRunAt?.toISOString() ?? null,
      lastProcessed: cancelledArchiveJob.lastResult?.processed ?? null,
      lastSucceeded: cancelledArchiveJob.lastResult?.succeeded ?? null,
      lastFailed: cancelledArchiveJob.lastResult?.failed ?? null,
    },
  };
}

export function startOperationalScheduler() {
  console.log(`[scheduler] Starting operational scheduler (${TIMEZONE})`);
  scheduleNextDailyClose();
  scheduleCancelledArchive();

  // Heartbeat every 30 minutes
  heartbeatTimer = setInterval(() => {
    const now = new Date().toLocaleString('vi-VN', { timeZone: TIMEZONE });
    console.log(`[scheduler] heartbeat at ${now}`);
  }, HEARTBEAT_INTERVAL_MS);

  return {
    stop() {
      if (dailyCloseJob.timer) { clearTimeout(dailyCloseJob.timer); dailyCloseJob.timer = null; }
      if (cancelledArchiveJob.timer) { clearTimeout(cancelledArchiveJob.timer); cancelledArchiveJob.timer = null; }
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
      console.log('[scheduler] Scheduler stopped');
    },
  };
}
