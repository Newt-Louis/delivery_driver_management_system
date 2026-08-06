export interface TrackSlot {
  id: string;
  code: string;
  name: string;
  zone: { id: string; code: string; name: string; unitConfig?: TrackUnitConfig | null } | null;
}

export interface TrackUnitConfig {
  id: string;
  unit: string;
  businessLocationId?: string;
  displayName: string;
  shortName: string;
  icon?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

export interface QueueInfo {
  position: number;
  totalWaiting: number;
  estimatedWaitMinutes: number;
  availableSlots: number;
  avgReceivingMinutes: number;
  sampleCount: number;
  confidence: 'high' | 'medium' | 'low';
  estimatedCallTime: string | null;
}

export interface TrackDelivery {
  id: string;
  registrationCode: string;
  vendorName: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  receivingUnit: string;
  unitConfigId?: string | null;
  unitConfig?: TrackUnitConfig | null;
  locationName: string | null;
  goodsType: string;
  vehicleType: string;
  poNumber: string | null;
  requestedTime: string | null;
  checkinTime: string | null;
  calledTime: string | null;
  receivingStartTime: string | null;
  completedTime: string | null;
  status: string;
  assignedSlot: TrackSlot | null;
  autoWarehouse: boolean;
  ticketNumber: number | null;
  note: string | null;
  createdAt: string;
  queueInfo: QueueInfo | null;
}

export interface StatusInfo {
  icon: string;
  label: string;
  color: string;
  bg: string;
  border: string;
}

export interface TimelineEvent {
  icon: string;
  label: string;
  time: string | null;
  done: boolean;
  detail: string | null;
}

export interface StatusAlert {
  title: string;
  body: string;
  level: 'urgent' | 'info';
}

export interface QueueBannerState {
  pos: number;
  diff: number;
  isUrgent: boolean;
}
