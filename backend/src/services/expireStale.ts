import { prisma } from '../lib/prisma';

// Vietnam is UTC+7.  All "today" calculations are relative to VN local time.
const CLOSE_HOUR_VN = 19; // 19:00 — end of receiving window

/** 00:00 today Vietnam time, expressed as UTC. */
function startOfTodayVN(): Date {
  const vnNow = new Date(Date.now() + 7 * 3600_000);
  return new Date(
    Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate(), 0, 0, 0, 0)
    - 7 * 3600_000,
  );
}

/** 19:00 today Vietnam time, expressed as UTC. */
function endOfBusinessTodayVN(): Date {
  const vnNow = new Date(Date.now() + 7 * 3600_000);
  return new Date(
    Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate(), CLOSE_HOUR_VN, 0, 0, 0)
    - 7 * 3600_000,
  );
}

export interface ExpireResult {
  expiredRegistered: number;
  expiredWaiting:    number;
  total:             number;
  ranAt:             string;
  trigger:           'after-hours' | 'next-day';
  cutoff:            string;
}

/**
 * Expire stale REGISTERED (no check-in) and WAITING (no delivery) records.
 *
 * Cutoff logic (two trigger points, whichever is earlier in the day):
 *  • After 19:00 VN  → cutoff = 19:00 today VN  (expire TODAY's records too)
 *  • Before 19:00 VN → cutoff = 00:00 today VN  (only expire YESTERDAY and earlier)
 *
 * REGISTERED expires when:
 *   - requestedTime < cutoff  (scheduled slot is before cutoff)
 *   - OR requestedTime IS NULL and createdAt < cutoff
 *
 * WAITING expires when:
 *   - checkinTime < cutoff
 *
 * Records scheduled for TOMORROW are never touched regardless of current time.
 */
export async function expireStaleDeliveries(): Promise<ExpireResult> {
  const now          = new Date();
  const startOfToday = startOfTodayVN();
  const endOfBiz     = endOfBusinessTodayVN();
  const isAfterHours = now >= endOfBiz;

  // The effective cutoff timestamp
  const cutoff = isAfterHours ? endOfBiz : startOfToday;
  const trigger: ExpireResult['trigger'] = isAfterHours ? 'after-hours' : 'next-day';

  const noteRegistered = isAfterHours
    ? 'Hết hạn: hết giờ nhận hàng (19:00), chưa check-in'
    : 'Hết hạn: quá ngày, chưa check-in';

  const noteWaiting = isAfterHours
    ? 'Hết hạn: hết giờ nhận hàng (19:00), chưa nhận hàng'
    : 'Hết hạn: quá ngày, chưa nhận hàng';

  const [registered, waiting] = await Promise.all([
    prisma.deliveryRegistration.updateMany({
      where: {
        status: 'REGISTERED',
        OR: [
          // Has a scheduled time slot that is before the cutoff
          { requestedTime: { lt: cutoff } },
          // No scheduled time — use registration date
          { requestedTime: null, createdAt: { lt: cutoff } },
        ],
      },
      data: { status: 'EXPIRED', note: noteRegistered },
    }),

    prisma.deliveryRegistration.updateMany({
      where: {
        status: 'WAITING',
        checkinTime: { lt: cutoff },
      },
      data: { status: 'EXPIRED', note: noteWaiting },
    }),
  ]);

  return {
    expiredRegistered: registered.count,
    expiredWaiting:    waiting.count,
    total:             registered.count + waiting.count,
    ranAt:             now.toISOString(),
    trigger,
    cutoff:            cutoff.toISOString(),
  };
}
