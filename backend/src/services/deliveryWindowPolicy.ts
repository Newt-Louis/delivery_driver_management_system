import type { GoodsType, Prisma } from '@prisma/client';
import type { AppRole } from '../domain/permissions';

// Khung giờ giao hàng (DeliveryTimeWindow) chỉ dùng để chặn check-in. Đăng ký,
// gọi xe, mượn slot và nhận hàng không phụ thuộc khung giờ.

type DeliveryWindowClient = Pick<Prisma.TransactionClient, 'deliveryTimeWindow'>;

export type DeliveryWindowRange = { startTime: string; endTime: string; label: string | null };

/** Role được xác nhận cho check-in ngoài khung giờ; CHECKIN luôn bị chặn. */
export const DELIVERY_WINDOW_OVERRIDE_ROLES: readonly AppRole[] = ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'];

export function canOverrideDeliveryWindow(role?: string | null): boolean {
  return Boolean(role && (DELIVERY_WINDOW_OVERRIDE_ROLES as readonly string[]).includes(role));
}

function toMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function isValidRange(window: DeliveryWindowRange): boolean {
  const start = toMinutes(window.startTime);
  const end = toMinutes(window.endTime);
  return start !== null && end !== null && start < end;
}

/** Phút trong ngày theo giờ Việt Nam. */
export function vnMinutesOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const hours = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minutes = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hours * 60 + minutes;
}

/**
 * Khung giờ đang bật của loại hàng tài xế đăng ký tại đơn vị. Loại hàng tùy
 * biến (đang tạm khóa) dùng khung riêng, thiếu thì fallback về loại gốc.
 * Khung lỗi dữ liệu (giờ bắt đầu >= giờ kết thúc) bị bỏ qua.
 */
export async function listEnabledDeliveryWindows(
  client: DeliveryWindowClient,
  args: { unitConfigId: string; goodsType: GoodsType; unitGoodsTypeId?: string | null },
): Promise<DeliveryWindowRange[]> {
  const select = { startTime: true, endTime: true, label: true } as const;
  const orderBy = [{ sortOrder: 'asc' as const }, { startTime: 'asc' as const }];
  let windows = args.unitGoodsTypeId
    ? await client.deliveryTimeWindow.findMany({ where: { unitGoodsTypeId: args.unitGoodsTypeId, enabled: true }, select, orderBy })
    : [];
  if (windows.length === 0) {
    windows = await client.deliveryTimeWindow.findMany({
      where: { unitConfigId: args.unitConfigId, goodsType: args.goodsType, unitGoodsTypeId: null, enabled: true },
      select,
      orderBy,
    });
  }
  return windows.filter(isValidRange);
}

/** Không có khung nào bật nghĩa là nhận cả ngày. Hai đầu khung đều tính là trong khung. */
export function isWithinDeliveryWindows(windows: DeliveryWindowRange[], now: Date): boolean {
  if (windows.length === 0) return true;
  const current = vnMinutesOfDay(now);
  return windows.some((window) => {
    const start = toMinutes(window.startTime)!;
    const end = toMinutes(window.endTime)!;
    return current >= start && current <= end;
  });
}

export function formatDeliveryWindows(windows: DeliveryWindowRange[]): string {
  return windows.map((window) => `${window.startTime}–${window.endTime}`).join(', ');
}
