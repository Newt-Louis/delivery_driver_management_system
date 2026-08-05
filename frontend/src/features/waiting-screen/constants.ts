export const GOODS_ICON: Record<string, string> = {
  FRESH_FOOD: '🥬', AUTO_WAREHOUSE: '🏭', GENERAL_GOODS: '📦', THI_CONG: '🔨',
};

export const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD: 'Hàng tươi', AUTO_WAREHOUSE: 'Kho tự động', GENERAL_GOODS: 'Hàng thường', THI_CONG: 'Thi công',
};

export const VTYPE: Record<string, { icon: string; label: string }> = {
  TRUCK:     { icon: '🚛', label: 'XE TẢI' },
  MOTORBIKE: { icon: '🛵', label: 'XE MÁY' },
  OTHER:     { icon: '🚗', label: 'XE KHÁC' },
};
