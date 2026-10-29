export const VT_LABEL: Record<string, string> = {
  TRUCK: 'Xe Tải',
  MOTORBIKE: 'Xe Máy',
};

export const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD: 'Tươi sống',
  GENERAL_GOODS: 'Hàng thường',
  AUTO_WAREHOUSE: 'Kho tự động',
  THI_CONG: 'Thi công',
};

export const CONF_LABEL: Record<string, { text: string }> = {
  high: { text: 'Cao' },
  medium: { text: 'Vừa' },
  low: { text: 'Thấp' },
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
