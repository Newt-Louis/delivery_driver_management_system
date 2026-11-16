import type { VehicleType } from './types';

// Bản sao quy tắc của backend/src/domain/vehiclePlate.ts; đổi quy tắc phải sửa cả hai nơi.
// Xe tải: 2 số + 1 chữ + 4 hoặc 5 số. Xe máy: 2 số + (1 chữ 1 số hoặc 2 chữ) + 4 hoặc 5 số.
const VEHICLE_PLATE_PATTERNS: Record<VehicleType, RegExp> = {
  TRUCK: /^\d{2}[A-Z]\d{4,5}$/,
  MOTORBIKE: /^\d{2}(?:[A-Z]\d|[A-Z]{2})\d{4,5}$/,
};

export const VEHICLE_PLATE_EXAMPLE: Record<VehicleType, string> = {
  TRUCK: '51G55673',
  MOTORBIKE: '59D255488',
};

export const VEHICLE_PLATE_HINT: Record<VehicleType, string> = {
  TRUCK: 'Xe tải: 2 số, 1 chữ và 4 hoặc 5 số cuối, viết liền không dấu. Ví dụ: 51G55673 hoặc 51G4938.',
  MOTORBIKE: 'Xe máy: 2 số, 1 chữ 1 số hoặc 2 chữ, rồi 4 hoặc 5 số cuối, viết liền không dấu. Ví dụ: 59D255488 hoặc 63AA24593.',
};

const VEHICLE_PLATE_ERROR: Record<VehicleType, string> = {
  TRUCK: 'Biển số xe tải không đúng định dạng. Ví dụ: 51G55673 hoặc 51G4938.',
  MOTORBIKE: 'Biển số xe máy không đúng định dạng. Ví dụ: 59D255488 hoặc 63AA24593.',
};

/** Chữ hoa, chỉ giữ chữ và số; người dùng gõ dấu `-`, `.` hay khoảng trắng đều được bỏ. */
export function normalizeVehiclePlateInput(value = ''): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Trả về thông báo lỗi, hoặc chuỗi rỗng nếu biển số hợp lệ. */
export function vehiclePlateError(value: string, vehicleType: VehicleType | ''): string {
  const plate = normalizeVehiclePlateInput(value);
  if (!plate) return 'Vui lòng nhập biển số xe';
  if (!vehicleType) return '';
  return VEHICLE_PLATE_PATTERNS[vehicleType].test(plate) ? '' : VEHICLE_PLATE_ERROR[vehicleType];
}
