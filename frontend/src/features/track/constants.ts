import type { StatusInfo } from './types';

export const STATUS_INFO: Record<string, StatusInfo> = {
  REGISTERED:               { label: 'Chờ check-in tại cổng' },
  WAITING:                  { label: 'Đã check-in — Đang chờ gọi' },
  CALLED:                   { label: 'Được gọi vào dock' },
  RECEIVING:                { label: 'Đang nhận hàng' },
  AUTO_WAREHOUSE_RECEIVING: { label: 'Đang nhận — Kho tự động' },
  COMPLETED:                { label: 'Giao hàng hoàn thành' },
  CANCELLED:                { label: 'Đã hủy' },
};

export const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD:    '🌿 Tươi sống',
  AUTO_WAREHOUSE:'🏭 Kho tự động',
  GENERAL_GOODS: '📦 Hàng thường',
  THI_CONG:      '🔨 Thi công',
};
