import type { ColumnConfig } from './types';

export const DELIVERY_COLUMNS: ColumnConfig[] = [
  { key: 'registrationCode',   label: 'Mã chuyến',      sortable: true,  defaultVisible: true },
  { key: 'vendorName',         label: 'Nhà cung cấp',   sortable: false, defaultVisible: true },
  { key: 'driverName',         label: 'Tài xế',          sortable: false, defaultVisible: true },
  { key: 'vehiclePlate',       label: 'Biển số',         sortable: false, defaultVisible: true },
  { key: 'receivingUnit',      label: 'Đơn vị nhận',     sortable: true,  defaultVisible: true },
  { key: 'goodsType',          label: 'Loại hàng',       sortable: true,  defaultVisible: true },
  { key: 'vehicleType',        label: 'Loại xe',         sortable: true,  defaultVisible: true },
  { key: 'finalStatus',        label: 'Trạng thái',      sortable: true,  defaultVisible: true },
  { key: 'ticketNumber',       label: 'Số phiếu',        sortable: true,  defaultVisible: true },
  { key: 'assignedSlotCode',   label: 'Slot',            sortable: false, defaultVisible: true },
  { key: 'callCount',          label: 'Số lần gọi',      sortable: true,  defaultVisible: true },
  { key: 'registeredAt',       label: 'Giờ đăng ký',     sortable: true,  defaultVisible: true },
  { key: 'checkinTime',        label: 'Giờ check-in',    sortable: true,  defaultVisible: true },
  { key: 'calledTime',         label: 'Giờ gọi',         sortable: true,  defaultVisible: true },
  { key: 'receivingStartTime', label: 'Giờ bắt đầu nhận', sortable: true, defaultVisible: true },
  { key: 'completedTime',      label: 'Giờ hoàn tất',    sortable: true,  defaultVisible: true },
  { key: 'closeReason',        label: 'Lý do đóng',      sortable: false, defaultVisible: true },
  { key: 'archivedAt',         label: 'Thời gian lưu trữ', sortable: true, defaultVisible: true },
];

export const AUDIT_COLUMNS: ColumnConfig[] = [
  { key: 'createdAt',   label: 'Thời gian',    sortable: true,  defaultVisible: true },
  { key: 'actorLabel',  label: 'Actor',         sortable: false, defaultVisible: true },
  { key: 'actorType',   label: 'Loại actor',    sortable: true,  defaultVisible: true },
  { key: 'action',      label: 'Hành động',     sortable: true,  defaultVisible: true },
  { key: 'targetType',  label: 'Đối tượng',     sortable: true,  defaultVisible: true },
  { key: 'targetId',    label: 'ID đối tượng',  sortable: false, defaultVisible: true },
  { key: 'before',      label: 'Trước',          sortable: false, defaultVisible: true },
  { key: 'after',       label: 'Sau',            sortable: false, defaultVisible: true },
];

export const STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
  INCOMPLETED: 'Chưa hoàn tất',
};


export const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD: 'Hàng tươi sống',
  AUTO_WAREHOUSE: 'Kho tự động',
  GENERAL_GOODS: 'Hàng thông thường',
  THI_CONG: 'Thi công',
};

export const VEHICLE_LABEL: Record<string, string> = {
  TRUCK: 'Xe tải',
  MOTORBIKE: 'Xe máy',
};

export const ACTOR_TYPE_LABEL: Record<string, string> = {
  USER: 'Người dùng',
  STAFF: 'Nhân viên',
  DEVICE: 'Thiết bị',
  SYSTEM: 'Hệ thống',
};

export const EVENT_LABEL: Record<string, { label: string; icon: string; accent?: string }> = {
  REGISTERED: { label: 'Đăng ký giao hàng', icon: '' },
  CHECKED_IN: { label: 'Check-in tại cổng', icon: '' },
  AUTO_ASSIGNED: { label: 'Tự động gọi vào vị trí', icon: '' },
  MANUAL_CALLED: { label: 'Gọi vào vị trí', icon: '' },
  RECALLED: { label: 'Gọi lại', icon: '' },
  REASSIGNED_SLOT: { label: 'Đổi vị trí nhận hàng', icon: '' },
  RECEIVING_STARTED: { label: 'Bắt đầu nhận hàng', icon: '' },
  AUTO_WAREHOUSE_RECEIVING_STARTED: { label: 'Bắt đầu nhận kho tự động', icon: '' },
  COMPLETED: { label: 'Hoàn tất nhận hàng', icon: '' },
  CANCELLED: { label: 'Đã hủy', icon: '' },
  EXPIRED_NO_SHOW: { label: 'Hết hạn: không tới check-in', icon: '' },
  EXPIRED_WAITING: { label: 'Hết hạn: không nhận hàng', icon: '' },
  INCOMPLETED: { label: 'Chưa hoàn tất cuối ngày', icon: '' },
  ARCHIVED: { label: 'Đã lưu lịch sử', icon: '' },
};

export const DEFAULT_PAGE_SIZE = 50;

export const DELIVERY_STORAGE_KEY = 'histories-delivery-columns';
export const AUDIT_STORAGE_KEY = 'histories-audit-columns';
