import type { ReportTab } from './types';

export const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD: 'Hàng tươi sống', AUTO_WAREHOUSE: 'Kho tự động',
  GENERAL_GOODS: 'Hàng thông thường', THI_CONG: 'Thi công',
};

export const VEHICLE_LABEL: Record<string, string> = {
  TRUCK: '🚛 Xe tải', MOTORBIKE: '🛵 Xe máy', OTHER: '🚗 Khác',
};

export const STATUS_LABEL: Record<string, string> = {
  REGISTERED: 'Đã đăng ký', WAITING: 'Đang chờ', CALLED: 'Đã gọi',
  RECEIVING: 'Đang nhận', AUTO_WAREHOUSE_RECEIVING: 'Kho tự động',
  COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn', INCOMPLETED: 'Chưa hoàn tất',
};

export const DOW_LABEL = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export const SUGGEST_META: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  ADD_SLOT:            { label: 'Thêm slot',      icon: '➕', bg: 'bg-red-50',    text: 'text-red-700' },
  REDUCE_SLOT:         { label: 'Giảm slot',      icon: '➖', bg: 'bg-amber-50',  text: 'text-amber-700' },
  CONVERT_TO_MOTORBIKE:{ label: 'Chuyển xe máy', icon: '🔄', bg: 'bg-purple-50', text: 'text-purple-700' },
  CONVERT_TO_TRUCK:    { label: 'Chuyển xe tải', icon: '🔄', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  OPTIMAL:             { label: 'Tối ưu',          icon: '✅', bg: 'bg-green-50',  text: 'text-green-700' },
};

export const PRIORITY_META: Record<string, { label: string; color: string }> = {
  HIGH:   { label: 'Ưu tiên cao', color: 'bg-red-100 text-red-700' },
  MEDIUM: { label: 'Trung bình',  color: 'bg-amber-100 text-amber-700' },
  LOW:    { label: 'Thấp',        color: 'bg-thiso-100 text-thiso-500' },
};

export const REPORT_TABS: ReportTab[] = [
  { id: 'overview',  label: '📊 Tổng quan' },
  { id: 'breakdown', label: '🗂 Phân tích' },
  { id: 'slots',     label: '🚪 Hiệu suất Slot' },
  { id: 'ai',        label: '🤖 AI Đề xuất' },
];
