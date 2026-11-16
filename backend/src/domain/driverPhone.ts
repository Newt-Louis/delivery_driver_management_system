// Số điện thoại tài xế lưu dạng 10 số bắt đầu bằng 0. Frontend giữ bản sao tại
// frontend/src/lib/driverPhone.ts; khi đổi quy tắc phải sửa cả hai nơi.
const DRIVER_PHONE_PATTERN = /^0\d{9}$/;

export const DRIVER_PHONE_FORMAT_MESSAGE = 'Số điện thoại phải gồm 10 số, bắt đầu bằng 0 hoặc +84. Ví dụ: 0857382937.';

/**
 * Bỏ khoảng trắng và ký tự phân cách; đầu số quốc tế `+84`, `0084` hoặc `84`
 * (khi đủ 11 số) được đổi thành `0`. Ví dụ `+84 857 382 937` -> `0857382937`.
 */
export function normalizeDriverPhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+84')) return `0${digits.slice(2).replace(/^0/, '')}`;
  if (digits.startsWith('0084')) return `0${digits.slice(4).replace(/^0/, '')}`;
  if (/^84\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return digits;
}

export function isValidDriverPhone(phone: string): boolean {
  return DRIVER_PHONE_PATTERN.test(phone);
}
