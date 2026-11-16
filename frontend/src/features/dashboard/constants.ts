import type { DeliveryHistoryEvent, GoodsType, VehicleType } from '../../lib/types';
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

export const EVENT_LABEL: Record<string, { label: string; icon?: string; accent?: string }> = {
  REGISTERED: { label: 'Đăng ký giao hàng' },
  CHECKED_IN: { label: 'Check-in tại cổng' },
  AUTO_ASSIGNED: { label: 'Tự động gọi vào vị trí', accent: 'text-thiso-700' },
  MANUAL_CALLED: { label: 'Gọi vào vị trí', accent: 'text-thiso-700' },
  RECALLED: { label: 'Gọi lại', accent: 'text-thiso-700' },
  REASSIGNED_SLOT: { label: 'Đổi vị trí nhận hàng', accent: 'text-thiso-700' },
  RECEIVING_STARTED: { label: 'Bắt đầu nhận hàng', accent: 'text-green-700' },
  AUTO_WAREHOUSE_RECEIVING_STARTED: { label: 'Bắt đầu nhận kho tự động', accent: 'text-green-700' },
  COMPLETED: { label: 'Hoàn tất nhận hàng', accent: 'text-green-700' },
  CANCELLED: { label: 'Đã hủy', accent: 'text-red-600' },
  EXPIRED_NO_SHOW: { label: 'Hết hạn: không tới check-in', accent: 'text-red-600' },
  EXPIRED_WAITING: { label: 'Hết hạn: không nhận hàng', accent: 'text-red-600' },
  INCOMPLETED: { label: 'Chưa hoàn tất cuối ngày', accent: 'text-amber-700' },
  ARCHIVED: { label: 'Đã lưu lịch sử', accent: 'text-thiso-500' },
};

export function formatEventLabel(event: DeliveryHistoryEvent): string {
  const base = EVENT_LABEL[event.eventType]?.label ?? event.eventType;
  const slot = event.slotName ? ` → ${event.slotName}` : '';
  const actor = event.actorLabel ? ` (${event.actorLabel})` : '';
  const reason = event.reason ? `: ${event.reason}` : '';
  return `${base}${slot}${actor}${reason}`;
}
