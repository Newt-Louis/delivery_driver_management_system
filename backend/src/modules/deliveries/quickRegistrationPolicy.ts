import { getVNDateKey } from '../../lib/dateVN';
import { domainError } from '../shared/domainError';

export function assertConstructionDateRange(start: unknown, end: unknown, now = new Date()): void {
  const isDate = (value: unknown): value is string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!isDate(start) || !isDate(end) || start > end) {
    throw domainError.badRequest('Không thể kiểm tra thời hạn mã Thi Công. Vui lòng liên hệ bộ phận liên quan.', 'ConstructionDateRangeInvalid');
  }
  const today = getVNDateKey(now);
  if (today < start || today > end) {
    throw domainError.badRequest('Mã Thi Công không có hiệu lực trong ngày hôm nay.', 'ConstructionDateNotToday');
  }
}

export function assertPoDateIsToday(deliveryDate: string, now = new Date()): void {
  if (deliveryDate !== getVNDateKey(now)) {
    throw domainError.badRequest('Mã PO chỉ được đăng ký giao hàng đúng ngày giao hôm nay.', 'PoDeliveryDateNotToday');
  }
}

export function assertQuickRegistrationDate(deliveryDate: string | undefined, requestedTime: Date | null, verifiedDate: string | undefined, now = new Date()): void {
  const today = getVNDateKey(now);
  if (!deliveryDate || deliveryDate !== today || verifiedDate !== today || (requestedTime && getVNDateKey(requestedTime) !== today)) {
    throw domainError.badRequest('Ngày giao hàng phải là ngày hôm nay. Vui lòng kiểm tra lại mã.', 'QuickDeliveryDateNotToday');
  }
}

export function assertRegistrationDateIsToday(deliveryDate: string, requestedTime: Date | null, now = new Date()): void {
  const today = getVNDateKey(now);
  if (deliveryDate !== today || (requestedTime && getVNDateKey(requestedTime) !== today)) {
    throw domainError.badRequest('Ngày giao hàng phải là ngày hôm nay. Vui lòng đăng ký lại.', 'DeliveryDateNotToday');
  }
}

export function requiresQuickVerification(code: string): boolean {
  const trimmed = code.replace(/[^A-Za-z0-9]/g, '');
  return /^450\d{7}$/.test(trimmed) || (/^[A-Za-z0-9]{5}$/.test(trimmed) && /[A-Za-z]/.test(trimmed));
}
