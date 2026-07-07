import { SchedulerJobTrigger } from '@prisma/client';
import { archiveCancelledDeliveries, closeDailyDeliveries } from './deliveryJobs';

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAILY_CLOSE_HOUR = 23;
const DAILY_CLOSE_MINUTE = 59;
const CANCELLED_ARCHIVE_INTERVAL_MS = 120 * 60 * 1000;

type ManagedTimer = ReturnType<typeof setTimeout>;

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

function scheduleNextDailyClose(timers: ManagedTimer[]): void {
  const nextRun = nextVietnamDailyRunUtc(DAILY_CLOSE_HOUR, DAILY_CLOSE_MINUTE);
  const delay = Math.max(1_000, nextRun.getTime() - Date.now());
  const timer = setTimeout(() => {
    closeDailyDeliveries({ trigger: SchedulerJobTrigger.SCHEDULED })
      .catch((error) => console.error('[scheduler] close-daily-deliveries failed', error))
      .finally(() => scheduleNextDailyClose(timers));
  }, delay);
  timers.push(timer);
  console.log(`[scheduler] close-daily-deliveries scheduled at ${nextRun.toISOString()} (${TIMEZONE})`);
}

function scheduleCancelledArchive(timers: ManagedTimer[]): void {
  const timer = setTimeout(() => {
    archiveCancelledDeliveries({ trigger: SchedulerJobTrigger.SCHEDULED })
      .catch((error) => console.error('[scheduler] archive-cancelled-deliveries failed', error))
      .finally(() => scheduleCancelledArchive(timers));
  }, CANCELLED_ARCHIVE_INTERVAL_MS);
  timers.push(timer);
}

export function startOperationalScheduler() {
  const timers: ManagedTimer[] = [];
  scheduleNextDailyClose(timers);
  scheduleCancelledArchive(timers);

  return {
    stop() {
      for (const timer of timers) clearTimeout(timer);
      timers.length = 0;
    },
  };
}
