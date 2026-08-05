export const VT_LABEL: Record<string, string> = {
  TRUCK: '🚛 Xe Tải',
  MOTORBIKE: '🛵 Xe Máy',
  OTHER: '🚗 Khác',
};

export const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD: '🥦 Tươi sống',
  GENERAL_GOODS: '📦 Hàng thường',
  AUTO_WAREHOUSE: '🤖 Kho tự động',
  THI_CONG: '🔨 Thi công',
};

export const CONF_LABEL: Record<string, { text: string; color: string }> = {
  high: { text: 'Cao', color: 'bg-green-100 text-green-700' },
  medium: { text: 'Vừa', color: 'bg-amber-100 text-amber-700' },
  low: { text: 'Thấp', color: 'bg-thiso-100 text-thiso-400' },
};

export const RECEIVING_TIMES_CSV_HEADERS = [
  'Đơn vị',
  'Loại xe',
  'Loại hàng',
  'Cấu hình (phút)',
  'AI khuyến nghị (phút)',
  'TB thực tế (phút)',
  'Số mẫu',
  'Độ tin cậy',
  'Chênh lệch (phút)',
];
