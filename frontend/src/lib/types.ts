export type Role = 'SUPERADMIN' | 'ADMIN_LOC' | 'ADMIN_OPE' | 'RECEIVING' | 'CHECKIN';
export type SlotStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
export type ReceivingUnit = 'EMART' | 'THISKYHALL' | 'TENANT';
export type GoodsType = 'FRESH_FOOD' | 'AUTO_WAREHOUSE' | 'GENERAL_GOODS' | 'THI_CONG';
export type VehicleType = 'TRUCK' | 'MOTORBIKE' | 'OTHER';
export type DeliveryStatus =
  | 'REGISTERED'
  | 'WAITING'
  | 'CALLED'
  | 'RECEIVING'
  | 'AUTO_WAREHOUSE_RECEIVING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'INCOMPLETED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  unit: ReceivingUnit | null;
  unitPermissions?: Array<Pick<UnitConfig, 'id' | 'unit' | 'displayName' | 'businessLocationId'>>;
  department?: string | null;
  businessLocationId: string | null;
}

export interface Zone {
  id: string;
  code: string;
  name: string;
  unitConfigId: string;
  unitConfig?: Pick<UnitConfig, 'id' | 'unit' | 'displayName' | 'businessLocationId'>;
  slots?: Slot[];
  _count?: { slots: number };
}

export interface Slot {
  id: string;
  code: string;
  name: string;
  assignedUnit: ReceivingUnit;
  vehicleType: VehicleType;
  acceptedGoods: GoodsType[];
  autoAssign: boolean;
  autoWarehouseOnly: boolean;
  maxCapacity: number;
  status: SlotStatus;
  isActive: boolean;
  currentDeliveryId: string | null;
  lastUsedAt: string | null;
  zoneId: string;
  zone: { id: string; code: string; name: string; unitConfig?: Pick<UnitConfig, 'id' | 'unit' | 'businessLocationId'> } | null;
  deliveries?: DeliveryRegistration[];
}

export interface DeliveryHistoryEvent {
  id: string;
  eventType: string;
  occurredAt: string;
  fromStatus: DeliveryStatus | null;
  toStatus: DeliveryStatus | null;
  message: string | null;
  reason: string | null;
  slotCode: string | null;
  slotName: string | null;
  actorLabel: string | null;
}

export interface DeliveryRegistration {
  id: string;
  registrationCode: string;
  vendorName: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  receivingUnit: ReceivingUnit;
  goodsType: GoodsType;
  poNumber: string | null;
  vendorCode: string | null;
  requestedTime: string | null;
  checkinTime: string | null;
  calledTime: string | null;
  receivingStartTime: string | null;
  completedTime: string | null;
  status: DeliveryStatus;
  assignedSlotId: string | null;
  assignedSlot: Slot | null;
  vehicleType: VehicleType;
  autoWarehouse: boolean;
  ticketNumber: number | null;
  note: string | null;
  cancelReason?: string | null;
  unitGoodsTypeId: string | null;
  unitGoodsType?: { id: string; name: string; emoji: string; baseType: GoodsType } | null;
  createdAt: string;
  updatedAt: string;
  callCount?: number;
  historyEvents?: DeliveryHistoryEvent[];
}

export interface UnitBranding {
  displayName: string;
  shortName: string;
  description: string;
  logoUrl: string | null;
  primaryColor: string;
}

export interface ReceivingTimeConfig {
  id: string;
  unit: ReceivingUnit;
  vehicleType: VehicleType;
  goodsType: GoodsType;
  configuredMinutes: number;
  recommendedMinutes: number | null;
  sampleCount: number;
  lastAnalyzedAt: string | null;
  updatedAt: string;
  // enriched by API
  liveAvgMinutes: number | null;
  liveSampleCount: number;
  diffMinutes: number | null;
  confidence: 'high' | 'medium' | 'low';
  shouldUpdate: boolean;
}

export interface MallBranding {
  id?: string;
  code?: string;
  locationName?: string;
  mallName: string;
  address?: string;
  avatarUrl?: string | null;
  logoUrl: string | null;
  tagline: string | null;
}

export interface UnitConfig {
  id: string;
  unit: ReceivingUnit;
  businessLocationId: string;
  freshFoodEnabled: boolean;
  generalGoodsEnabled: boolean;
  thiCongEnabled: boolean;
  sundayFreshFoodOnly: boolean;
  truckSlotMinutes: number;
  motorbikeSlotMinutes: number;
  truckMaxPerSlot: number;
  motorbikeMaxPerSlot: number;
  vendorApiUrl: string | null;
  poApiUrl: string | null;
  displayName: string;
  shortName: string;
  description: string;
  logoUrl: string | null;
  primaryColor: string;
}

export interface UnitGoodsType {
  id: string;
  unit: ReceivingUnit;
  name: string;
  emoji: string;
  baseType: GoodsType;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryTimeWindow {
  id: string;
  unit: ReceivingUnit;
  goodsType: GoodsType;
  unitGoodsTypeId: string | null;
  label: string | null;
  startTime: string;
  endTime: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SlotInfo {
  time: string;
  booked: number;
  maxPerSlot: number;
  available: boolean;
  isPast: boolean;
  windowLabel?: string | null;
}

export interface DashboardSummary {
  waiting: number;
  freshFoodWaiting: number;
  receiving: number;
  slotsOccupied: number;
  slotsAvailable: number;
  // backward-compat aliases (kept until all displays updated)
  docksOccupied: number;
  docksAvailable: number;
  totalToday: number;
  completedToday: number;
  cancelledToday: number;
  noShowRisk: number;
  urgentFreshFood: number;
  registeredToday: number;
  expiredToday: number;
}

export interface UnitStats {
  registered: number;
  waiting: number;
  called: number;
  receiving: number;
  trucksWaiting: number;
  motorbikesWaiting: number;
  slotsTotal: number;
  slotsAvailable: number;
  truckSlotsAvailable: number;
  mbSlotsAvailable: number;
  // backward-compat aliases
  docksTotal: number;
  docksAvailable: number;
  truckDocksAvailable: number;
  mbDocksAvailable: number;
  avgWaitMinutes: number | null;
}

export interface UnitInsight {
  alerts: { level: 'critical' | 'warning'; message: string; deliveryId?: string }[];
  recommendations: { message: string; deliveryId?: string; slotId?: string }[];
  stats: UnitStats;
  nextHour: { count: number; firstSlot: string | null };
}

export interface UnitDispatch {
  active: DeliveryRegistration[];
  upcoming: DeliveryRegistration[];
  slots: Slot[];
  insights: UnitInsight;
}

export type DispatchData = Record<string, UnitDispatch>;

export interface AutoWarehouseVendor {
  id: string;
  unit: ReceivingUnit;
  vendorCode: string;
  vendorName: string;
  active: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
