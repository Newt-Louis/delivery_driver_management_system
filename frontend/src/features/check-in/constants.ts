import type { GoodsType, VehicleType } from '../../lib/types';
import type { CheckInMode } from './types';

export const CHECK_IN_MODES: { value: CheckInMode; label: string; placeholder: string }[] = [
  { value: 'plate', label: '🚗 Biển số xe', placeholder: '51C-123.45' },
  { value: 'code', label: '🔖 Mã đăng ký', placeholder: 'REG-20240606-0001' },
];

export const VEHICLE_LABEL: Record<VehicleType, string> = {
  TRUCK: '🚛 Xe Tải',
  MOTORBIKE: '🛵 Xe Máy',
  OTHER: '🚗 Khác',
};

export const GOODS_LABEL: Record<GoodsType, string> = {
  FRESH_FOOD: 'Tươi sống',
  GENERAL_GOODS: 'Hàng thường',
  AUTO_WAREHOUSE: 'Kho tự động',
  THI_CONG: 'Thi công',
};

export const WAITING_CSV_HEADERS = [
  'Số thẻ',
  'Mã ĐK',
  'Biển số',
  'Tài xế',
  'Nhà CC',
  'Đơn vị',
  'Loại hàng',
  'Loại xe',
  'Chờ (phút)',
];
