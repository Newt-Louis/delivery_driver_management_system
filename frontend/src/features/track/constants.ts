import type { StatusInfo } from './types';

export const STATUS_INFO: Record<string, StatusInfo> = {
  REGISTERED:               { icon: '🕐', label: 'Chờ check-in tại cổng',      color: 'text-thisodominant-800', bg: 'bg-thisodominant-50', border: 'border-thisodominant-200' },
  WAITING:                  { icon: '⏳', label: 'Đã check-in — Đang chờ gọi', color: 'text-yellow-700', bg: 'bg-yellow-50',   border: 'border-yellow-200' },
  CALLED:                   { icon: '📢', label: 'Được gọi vào dock',           color: 'text-thisodominant-800', bg: 'bg-thisodominant-50', border: 'border-thisodominant-200' },
  RECEIVING:                { icon: '📦', label: 'Đang nhận hàng',              color: 'text-thiso-800',  bg: 'bg-thiso-100',    border: 'border-thiso-200' },
  AUTO_WAREHOUSE_RECEIVING: { icon: '🏭', label: 'Đang nhận — Kho tự động',    color: 'text-thiso-800',  bg: 'bg-thiso-100',    border: 'border-thiso-200' },
  COMPLETED:                { icon: '✅', label: 'Giao hàng hoàn thành',        color: 'text-green-700',  bg: 'bg-green-50',    border: 'border-green-200'  },
  CANCELLED:                { icon: '❌', label: 'Đã hủy',                      color: 'text-red-700',    bg: 'bg-red-50',      border: 'border-red-200'    },
};

export const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD:    '🌿 Tươi sống',
  AUTO_WAREHOUSE:'🏭 Kho tự động',
  GENERAL_GOODS: '📦 Hàng thường',
  THI_CONG:      '🔨 Thi công',
};
