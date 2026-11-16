// Bản sao quy tắc của backend/src/domain/driverPhone.ts; đổi quy tắc phải sửa cả hai nơi.
const DRIVER_PHONE_PATTERN = /^0\d{9}$/;

export const DRIVER_PHONE_HINT = 'Gồm 10 số, bắt đầu bằng 0. Có thể dán số dạng +84, hệ thống tự đổi +84 thành 0.';
const DRIVER_PHONE_ERROR = 'Số điện thoại phải gồm 10 số, bắt đầu bằng 0 hoặc +84. Ví dụ: 0857382937.';

/**
 * Chuẩn hóa ngay khi nhập/dán: bỏ khoảng trắng và dấu phân cách, đổi `+84`,
 * `0084` hoặc `84` (đủ 11 số) thành `0`. Giữ dấu `+` khi người dùng mới gõ
 * dở đầu số quốc tế (ví dụ `+8`).
 */
export function normalizeDriverPhoneInput(value = ''): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    if (digits.startsWith('84')) return `0${digits.slice(2).replace(/^0/, '')}`;
    return `+${digits}`;
  }
  if (digits.startsWith('0084')) return `0${digits.slice(4).replace(/^0/, '')}`;
  if (/^84\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  return digits;
}

/** Trả về thông báo lỗi, hoặc chuỗi rỗng nếu số điện thoại hợp lệ. */
export function driverPhoneError(value: string): string {
  const phone = normalizeDriverPhoneInput(value);
  if (!phone) return 'Vui lòng nhập số điện thoại';
  return DRIVER_PHONE_PATTERN.test(phone) ? '' : DRIVER_PHONE_ERROR;
}
