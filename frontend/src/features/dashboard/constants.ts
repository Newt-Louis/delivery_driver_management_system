import type { GoodsType, VehicleType } from '../../lib/types';
import type { StatusFilter, VehicleTypeFilter } from './types';

export const VEHICLE_LABEL: Record<VehicleType, string> = {
  TRUCK: 'Tải',
  MOTORBIKE: 'Xe máy',
};

export const VEHICLE_FULL: Record<VehicleType, string> = {
  TRUCK: 'Xe Tải',
  MOTORBIKE: 'Xe Máy',
};

export const GOODS_LABEL: Record<GoodsType, string> = {
  FRESH_FOOD: 'Hàng tươi sống',
  AUTO_WAREHOUSE: 'Kho tự động',
  GENERAL_GOODS: 'Hàng thông thường',
  THI_CONG: 'Thi công',
};

export const GOODS_CSV_LABEL: Record<GoodsType, string> = {
  FRESH_FOOD: 'Tươi sống',
  AUTO_WAREHOUSE: 'Kho tự động',
  GENERAL_GOODS: 'Hàng thường',
  THI_CONG: 'Thi công',
};

export const STATUS_CSV_LABEL: Record<string, string> = {
  WAITING: 'Đang chờ',
  CALLED: 'Đã gọi',
  RECEIVING: 'Đang nhận',
  AUTO_WAREHOUSE_RECEIVING: 'Kho tự động',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

export const STATUS_ORDER: Record<string, number> = {
  WAITING: 0,
  CALLED: 1,
  RECEIVING: 2,
  AUTO_WAREHOUSE_RECEIVING: 3,
};

export const STATUS_FILTER_OPTIONS: { k: StatusFilter; label: string; color: string }[] = [
  { k: 'ALL', label: 'Tất cả', color: 'bg-thiso-200 text-thiso-900' },
  { k: 'WAITING', label: 'Chờ gọi', color: 'bg-thiso-200 text-thiso-900' },
  { k: 'CALLED', label: 'Đã gọi', color: 'bg-thiso-200 text-thiso-900' },
  { k: 'RECEIVING', label: 'Nhận hàng', color: 'bg-thiso-200 text-thiso-900' },
];

export const VEHICLE_FILTER_OPTIONS: { k: VehicleTypeFilter; label: string }[] = [
  { k: 'ALL', label: 'Tất cả xe' },
  { k: 'TRUCK', label: 'Xe Tải' },
  { k: 'MOTORBIKE', label: 'Xe Máy' },
];

export const DISPATCH_CSV_HEADERS = [
  'Số thẻ',
  'Mã ĐK',
  'Biển số',
  'Tài xế',
  'Nhà CC',
  'Đơn vị',
  'Loại hàng',
  'Loại xe',
  'Slot',
  'Trạng thái',
  'Check-in',
  'Chờ (phút)',
];
