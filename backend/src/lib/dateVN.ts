/** Returns { y, m, day } for a Date in Vietnam timezone (UTC+7). */
function getVNDate(d: Date): { y: number; m: number; day: number } {
  const s = d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
  const [datePart] = s.split(', ');
  const [month, day, year] = datePart.split('/').map(Number);
  return { y: year, m: month, day };
}

/** Returns a stable YYYY-MM-DD key for the Vietnam business day. */
export function getVNDateKey(d: Date = new Date()): string {
  const { y, m, day } = getVNDate(d);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Returns the UTC range covering a Vietnam business date key. */
export function getVNDateRangeUtc(dateKey: string): { start: Date; end: Date } {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Returns true if requestedTime falls on today (Vietnam timezone).
 * If requestedTime is null the delivery has no fixed date — always allowed.
 */
export function isScheduledForToday(requestedTime: Date | null): boolean {
  if (!requestedTime) return true;
  const today = getVNDate(new Date());
  const req   = getVNDate(requestedTime);
  return today.y === req.y && today.m === req.m && today.day === req.day;
}

/** Format a Date as a Vietnamese date string for error messages. */
export function formatVNDate(d: Date): string {
  return d.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
