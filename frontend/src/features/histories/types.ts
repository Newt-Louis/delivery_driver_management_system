import type { ReceivingUnit, GoodsType, VehicleType, DeliveryStatus } from '../../lib/types';

export type HistoryTab = 'delivery' | 'audit' | 'access';

export interface DeliveryHistoryItem {
  id: string;
  registrationCode: string;
  vendorName: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  receivingUnit: ReceivingUnit;
  goodsType: GoodsType;
  vehicleType: VehicleType;
  autoWarehouse: boolean;
  finalStatus: string;
  closeReason: string | null;
  ticketNumber: number | null;
  assignedSlotCode: string | null;
  assignedSlotName: string | null;
  callCount: number;
  lastCalledAt: string | null;
  registeredAt: string;
  checkinTime: string | null;
  calledTime: string | null;
  receivingStartTime: string | null;
  completedTime: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  archivedAt: string;
  durationWaitingMinutes: number | null;
  durationReceivingMinutes: number | null;
  note: string | null;
}

export interface DeliveryHistoryEventItem {
  id: string;
  eventType: string;
  fromStatus: DeliveryStatus | null;
  toStatus: DeliveryStatus | null;
  occurredAt: string;
  actorType: string | null;
  actorLabel: string | null;
  slotCode: string | null;
  slotName: string | null;
  message: string | null;
  reason: string | null;
}

export interface AuditLogItem {
  id: string;
  actorType: string;
  actorId: string | null;
  actorLabel: string | null;
  businessLocationId: string | null;
  unitConfigId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export type DeliverySortField =
  | 'registrationCode'
  | 'registeredAt' | 'checkinTime' | 'calledTime' | 'receivingStartTime'
  | 'completedTime' | 'archivedAt' | 'finalStatus' | 'receivingUnit'
  | 'goodsType' | 'vehicleType' | 'ticketNumber' | 'callCount';

export type AuditSortField = 'createdAt' | 'actorType' | 'action' | 'targetType';

export interface ColumnConfig {
  key: string;
  label: string;
  sortable: boolean;
  defaultVisible: boolean;
}

export type SortDir = 'asc' | 'desc';
