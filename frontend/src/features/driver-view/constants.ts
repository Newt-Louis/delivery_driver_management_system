export const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  REGISTERED: { label: 'Đã đặt slot', color: 'text-thiso-600', bg: 'bg-thiso-100' },
  WAITING: { label: 'Đang chờ', color: 'text-amber-700', bg: 'bg-amber-100' },
  CALLED: { label: '📣 Vào dock!', color: 'text-sky-700', bg: 'bg-sky-100' },
  RECEIVING: { label: 'Đang nhận hàng', color: 'text-emart-700', bg: 'bg-emart-100' },
  AUTO_WAREHOUSE_RECEIVING: { label: 'Kho tự động', color: 'text-emart-700', bg: 'bg-emart-100' },
  COMPLETED: { label: '✓ Hoàn tất', color: 'text-sky-700', bg: 'bg-sky-100' },
  CANCELLED: { label: 'Đã hủy', color: 'text-red-600', bg: 'bg-red-100' },
};

export const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD: '🥬 Tươi sống',
  AUTO_WAREHOUSE: '🏭 Kho tự động',
  GENERAL_GOODS: '📦 Hàng thường',
};

export const GOODS_SHORT: Record<string, string> = {
  FRESH_FOOD: '🥬 Tươi sống',
  AUTO_WAREHOUSE: '🏭 Kho TĐ',
  GENERAL_GOODS: '📦 Thường',
};

export const VEHICLE_LABEL: Record<string, string> = {
  TRUCK: '🚛 Xe tải',
  MOTORBIKE: '🛵 Xe máy',
  OTHER: '🚗 Khác',
};

export const STORAGE_KEY = 'thiso_driver_plate';
export const NOTIF_KEY = 'thiso_driver_notif_granted';

export const DRIVER_GUIDE_STEPS = [
  ['1', 'Nhập biển số xe để xem vị trí hàng chờ'],
  ['2', 'Bật thông báo để nhận rung điện thoại khi được gọi'],
  ['3', 'Khi số thẻ được hiển thị màu nổi → chuẩn bị di chuyển vào dock'],
  ['4', 'Màn hình TV tại bãi đỗ cũng hiển thị số thẻ theo thứ tự'],
];
