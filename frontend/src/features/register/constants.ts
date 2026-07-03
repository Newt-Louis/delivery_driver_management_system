import type { GoodsType, Unit, VehicleType } from './types';

export const UNIT_STYLE: Record<Unit, {
  border: string;
  bg: string;
  activeBorder: string;
  activeBg: string;
  activeText: string;
}> = {
  EMART:      { border: 'border-thiso-200', bg: 'bg-white', activeBorder: 'border-emart-400', activeBg: 'bg-emart-50',   activeText: 'text-emart-700'  },
  THISKYHALL: { border: 'border-thiso-200', bg: 'bg-white', activeBorder: 'border-sky-500',   activeBg: 'bg-sky-50',    activeText: 'text-sky-700'    },
  TENANT:     { border: 'border-thiso-200', bg: 'bg-white', activeBorder: 'border-thiso-500', activeBg: 'bg-thiso-100', activeText: 'text-thiso-700'  },
};

export const VEHICLE_INFO: Record<VehicleType, {
  label: string;
  icon: string;
  activeBorder: string;
  activeBg: string;
  hint: string;
}> = {
  TRUCK:     { label: 'Xe Tải',  icon: '🚛', activeBorder: 'border-emart-400',  activeBg: 'bg-emart-50',  hint: 'Xe tải, xe container' },
  MOTORBIKE: { label: 'Xe Máy', icon: '🛵', activeBorder: 'border-sky-400',    activeBg: 'bg-sky-50',    hint: 'Xe máy, xe gắn máy' },
  OTHER:     { label: 'Khác',   icon: '🚐', activeBorder: 'border-thiso-400',  activeBg: 'bg-thiso-100', hint: 'Van, xe ô tô nhỏ...' },
};

export const GOODS_LABEL: Record<GoodsType | string, string> = {
  FRESH_FOOD:     '🥬 Hàng tươi sống',
  GENERAL_GOODS:  '📦 Hàng thường',
  AUTO_WAREHOUSE: '🏭 Kho tự động',
  THI_CONG:       '🔨 Thi công',
};

export const STEP_TITLES = ['Điểm giao & Loại hàng', 'Ngày giờ & Đơn hàng', 'Thông tin tài xế', 'Xác nhận'];

export const STEP_HINTS = [
  'Chọn nơi bạn sẽ giao hàng đến',
  'Chọn thời gian và nhập thông tin đơn hàng',
  'Thông tin xe và người liên hệ',
  'Kiểm tra lại trước khi xác nhận',
];

export const LS_KEY = 'qms_driver_info';
export const AUTO_TRACK_SECONDS = 10;
