import { getVNDateKey } from '../../lib/dateVN';
import { domainError } from '../shared/domainError';

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
