import { DeliveryHistoryEventType, DeliveryHistoryFinalStatus } from '@prisma/client';

export const helperFunctions = {
  minutesBetween(start?: Date | null, end?: Date | null): number | null {
    if (!start || !end) return null;
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
  },

  nonEmptyTrimmed(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  },

  stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  },

  enumValue<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
    const input = this.stringValue(value);
    if (!input) return undefined;
    return allowed.includes(input as T) ? input as T : undefined;
  },

  parseDate(value: string, endOfDay = false): Date | null {
    const raw = endOfDay ? `${value}T23:59:59.999Z` : value;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  },

  parsePositiveInt(value: unknown, fallback: number, max: number): number | null {
    const input = this.stringValue(value);
    if (!input) return fallback;
    const parsed = Number(input);
    if (!Number.isInteger(parsed) || parsed < 1) return null;
    return Math.min(parsed, max);
  },

  optionalDateValue(value: unknown, endOfDay = false): Date | null | undefined {
    const input = this.stringValue(value);
    if (!input) return undefined;
    return this.parseDate(input, endOfDay);
  },

  sortField(value: unknown, allowed: Set<string>, fallback: string): string {
    const input = this.stringValue(value);
    return input && allowed.has(input) ? input : fallback;
  },

  sortDir(value: unknown): 'asc' | 'desc' {
    return this.stringValue(value) === 'asc' ? 'asc' : 'desc';
  },

  roundOne(value: number | null | undefined): number {
    return Math.round((value ?? 0) * 10) / 10;
  },

  operatingWindowMinutes(range: { gte: Date; lte: Date }, hoursPerDay = 15) {
    const periodMs = range.lte.getTime() - range.gte.getTime();
    const periodDays = periodMs / 86400_000;
    return {
      periodDays,
      availableMinutes: periodDays * hoursPerDay * 60,
    };
  },

  errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  },

  deliveryCloseEventType(reason: string): DeliveryHistoryEventType {
    switch (reason) {
      case 'COMPLETED':
        return DeliveryHistoryEventType.COMPLETED;
      case 'CANCELLED':
        return DeliveryHistoryEventType.CANCELLED;
      case 'EXPIRED_NO_SHOW':
        return DeliveryHistoryEventType.EXPIRED_NO_SHOW;
      case 'EXPIRED_WAITING':
        return DeliveryHistoryEventType.EXPIRED_WAITING;
      case 'INCOMPLETED':
        return DeliveryHistoryEventType.INCOMPLETED;
      default:
        throw new Error(`Unsupported archive reason: ${reason}`);
    }
  },

  deliveryCloseTimestamp(
    finalStatus: DeliveryHistoryFinalStatus,
    completedTime: Date | null | undefined,
    occurredAt: Date,
  ): Date | null {
    if (finalStatus === DeliveryHistoryFinalStatus.COMPLETED) return completedTime ?? occurredAt;
    if (finalStatus === DeliveryHistoryFinalStatus.CANCELLED) return occurredAt;
    if (finalStatus === DeliveryHistoryFinalStatus.EXPIRED) return occurredAt;
    if (finalStatus === DeliveryHistoryFinalStatus.INCOMPLETED) return occurredAt;
    return null;
  },

  nextVietnamDailyRunUtc(hour: number, minute: number, from = new Date()): Date {
    const vnOffsetMs = 7 * 60 * 60 * 1000;
    const vnNow = new Date(from.getTime() + vnOffsetMs);
    let target = new Date(Date.UTC(
      vnNow.getUTCFullYear(),
      vnNow.getUTCMonth(),
      vnNow.getUTCDate(),
      hour,
      minute,
      0,
      0,
    ) - vnOffsetMs);

    if (target <= from) {
      target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
    }
    return target;
  },
};

declare global {
  // Keep this small and pure. Domain behavior belongs in modules, not globals.
  // eslint-disable-next-line no-var
  var helperFunction: typeof helperFunctions | undefined;
}

globalThis.helperFunction = helperFunctions;
