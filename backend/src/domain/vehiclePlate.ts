import { VehicleType } from '@prisma/client';

// Quy tắc nhập biển số cho lượt đăng ký public. Frontend giữ bản sao tại
// frontend/src/lib/vehiclePlate.ts; khi đổi quy tắc phải sửa cả hai nơi.
//
// Xe tải: 2 số mã tỉnh + 1 chữ + 4 hoặc 5 số. Ví dụ 51G55673, 51G4938.
// Xe máy: 2 số mã tỉnh + (1 chữ 1 số hoặc 2 chữ) + 4 hoặc 5 số.
//         Ví dụ 59D255488, 63AA24593.
const VEHICLE_PLATE_PATTERNS: Record<VehicleType, RegExp> = {
  [VehicleType.TRUCK]: /^\d{2}[A-Z]\d{4,5}$/,
  [VehicleType.MOTORBIKE]: /^\d{2}(?:[A-Z]\d|[A-Z]{2})\d{4,5}$/,
};

const VEHICLE_PLATE_FORMAT_MESSAGES: Record<VehicleType, string> = {
  [VehicleType.TRUCK]: 'Biển số xe tải gồm 2 số, 1 chữ và 4 hoặc 5 số cuối, không có dấu. Ví dụ: 51G55673 hoặc 51G4938.',
  [VehicleType.MOTORBIKE]: 'Biển số xe máy gồm 2 số, tiếp theo là 1 chữ 1 số hoặc 2 chữ, rồi 4 hoặc 5 số cuối, không có dấu. Ví dụ: 59D255488 hoặc 63AA24593.',
};

/** Chữ hoa, bỏ khoảng trắng và các dấu phân cách thường gặp (`-`, `.`). */
export function normalizeVehiclePlate(value: string): string {
  return value.trim().toUpperCase().replace(/[\s.\-]+/g, '');
}

export function isValidVehiclePlate(plate: string, vehicleType: VehicleType): boolean {
  const pattern = VEHICLE_PLATE_PATTERNS[vehicleType];
  return Boolean(pattern) && pattern.test(plate);
}

export function vehiclePlateFormatMessage(vehicleType: VehicleType): string {
  return VEHICLE_PLATE_FORMAT_MESSAGES[vehicleType] ?? 'Biển số xe không đúng định dạng.';
}
