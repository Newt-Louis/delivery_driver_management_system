import type { GoodsType } from '../../lib/types';
import type { BackofficeTab } from './types';

export const UNIT_LABELS: Record<string, string> = {
  EMART: 'Emart',
  THISKYHALL: 'Thiskyhall',
  TENANT: 'Mall (Khách thuê)',
};

export const VEHICLE_LABEL: Record<string, string> = {
  TRUCK: '🚛 Xe Tải',
  MOTORBIKE: '🛵 Xe Máy',
  OTHER: '🚗 Khác',
};

export const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Trống',
  OCCUPIED: 'Đang dùng',
  RESERVED: 'Đặt trước',
  MAINTENANCE: 'Bảo trì',
};

export const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-800',
  OCCUPIED: 'bg-red-100 text-red-800',
  RESERVED: 'bg-yellow-100 text-yellow-800',
  MAINTENANCE: 'bg-gray-200 text-gray-600',
};

export const GOODS_LABELS: Record<GoodsType, string> = {
  FRESH_FOOD: '🥬 Tươi sống',
  AUTO_WAREHOUSE: '🤖 Auto WH',
  GENERAL_GOODS: '📦 Hàng thường',
  THI_CONG: '🔨 Thi công',
};

export const UNIT_ICONS: Record<string, string> = {
  EMART: '🏬',
  THISKYHALL: '🏢',
  TENANT: '🏪',
};

export const BACKOFFICE_TABS: readonly [BackofficeTab, string][] = [
  ['slots', '🚪 Quản lý Slot'],
  ['zones', '🗺 Quản lý Khu'],
  ['units', '⚙ Cấu hình Đơn vị'],
  ['brand', '🎨 Thương hiệu'],
  ['staff', '👷 Nhân viên'],
  ['users', '👤 Người dùng'],
  ['awvendors', '🏭 Kho tự động'],
];

export function allowedBackofficeTabs(role?: string): BackofficeTab[] {
  if (role === 'SUPERADMIN') return BACKOFFICE_TABS.map(([tab]) => tab).filter((tab) => tab !== 'staff');
  if (role === 'ADMIN_OPE') return ['units', 'awvendors'];
  if (role === 'ADMIN_LOC') return BACKOFFICE_TABS.map(([tab]) => tab).filter((tab) => tab !== 'users');
  return [];
}

export const ROLE_META: Record<string, { label: string; color: string; icon: string }> = {
  SUPERADMIN: { label: 'Superadmin', color: 'bg-purple-100 text-purple-700', icon: '🛡' },
  ADMIN_LOC: { label: 'Admin khu vực', color: 'bg-red-100 text-red-700', icon: '👑' },
  ADMIN_OPE: { label: 'Admin vận hành', color: 'bg-orange-100 text-orange-700', icon: '🛠' },
  RECEIVING: { label: 'Nhận hàng', color: 'bg-sky-100 text-sky-700', icon: '📦' },
  CHECKIN: { label: 'Check-in', color: 'bg-amber-100 text-amber-700', icon: '🔐' },
};

export const STAFF_ROLE_META: Record<string, { label: string; color: string; icon: string }> = {
  ADMIN_OPE: { label: 'Nhân viên điều phối', color: 'bg-orange-100 text-orange-700', icon: '🛠' },
  RECEIVING: { label: 'Nhân viên nhận hàng', color: 'bg-sky-100 text-sky-700', icon: '📦' },
  CHECKIN: { label: 'Nhân viên check-in', color: 'bg-amber-100 text-amber-700', icon: '🔐' },
};

export const UNIT_META_U: Record<string, string> = {
  EMART: 'Emart',
  THISKYHALL: 'Thiskyhall',
  TENANT: 'Mall (Khách thuê)',
};
