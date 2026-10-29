import type { GoodsType } from '../../lib/types';
import type { BackofficeTab } from './types';

export const VEHICLE_LABEL: Record<string, string> = {
  TRUCK: '🚛 Xe Tải',
  MOTORBIKE: '🛵 Xe Máy',
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

export const BACKOFFICE_TABS: readonly [BackofficeTab, string, string][] = [
  ['slots', 'Quản lý Slot', 'Quản lý slot và cấu hình đơn vị nhận hàng theo quyền tài khoản.'],
  ['zones', 'Quản lý Khu', 'Quản lý các khu nhận hàng vật lý. Mỗi khu có thể chứa nhiều slot và phục vụ nhiều đơn vị.'],
  ['units', 'Cấu hình Đơn vị', 'Cấu hình khung giờ nhận hàng, slot booking và tự động hủy cho từng đơn vị.'],
  ['brand', 'Thương hiệu', 'Cấu hình logo và tên hiển thị cho từng đơn vị vận hành. Logo xuất hiện trên màn hình chờ và phiếu in.'],
  ['staff', 'Nhân viên', 'Quản lý thông tin nhân viên.'],
  ['awvendors', 'Kho tự động', 'Danh sách NCC được phép vào khu kho tự động. Tài xế nhập mã NCC khi đăng ký để được xếp vào slot kho tự động.'],
];

export function allowedBackofficeTabs(role?: string): BackofficeTab[] {
  if (role === 'SUPERADMIN') return BACKOFFICE_TABS.map(([tab]) => tab);
  if (role === 'ADMIN_LOC') return BACKOFFICE_TABS.map(([tab]) => tab);
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
