import type { ReportTab } from './types';

export const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD: 'Hàng tươi sống', AUTO_WAREHOUSE: 'Kho tự động',
  GENERAL_GOODS: 'Hàng thông thường', THI_CONG: 'Thi công',
};

export const VEHICLE_LABEL: Record<string, string> = {
  TRUCK: ' Xe tải', MOTORBIKE: ' Xe máy',
};

export const STATUS_LABEL: Record<string, string> = {
  REGISTERED: 'Đã đăng ký', WAITING: 'Đang chờ', CALLED: 'Đã gọi',
  RECEIVING: 'Đang nhận', AUTO_WAREHOUSE_RECEIVING: 'Kho tự động',
  COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn', INCOMPLETED: 'Chưa hoàn tất',
};

export const DOW_LABEL = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export const SUGGEST_META: Record<string, { label: string }> = {
  ADD_SLOT:            { label: 'Thêm slot' },
  REDUCE_SLOT:         { label: 'Giảm slot' },
  CONVERT_TO_MOTORBIKE:{ label: 'Chuyển xe máy' },
  CONVERT_TO_TRUCK:    { label: 'Chuyển xe tải' },
  OPTIMAL:             { label: 'Tối ưu' },
};

export const PRIORITY_META: Record<string, { label: string }> = {
  HIGH:   { label: 'Ưu tiên cao' },
  MEDIUM: { label: 'Trung bình' },
  LOW:    { label: 'Thấp' },
};

export const REPORT_TABS: ReportTab[] = [
  { id: 'overview',  label: ' Tổng quan' },
  { id: 'breakdown', label: ' Phân tích' },
  { id: 'slots',     label: ' Hiệu suất Slot' },
  { id: 'ai',        label: ' AI Đề xuất' },
];
