import { ReceivingUnit, type ReceivingUnit as ReceivingUnitCode } from '../../domain/unitCodes';
import { DeliveryStatus } from '@prisma/client';

export type ReportRange = {
  gte: Date;
  lte: Date;
};

export type ReportScope = {
  businessLocationId?: string;
  allowedUnits?: ReceivingUnitCode[];
  unitFilter?: ReceivingUnitCode;
};

export type ReportQuery = {
  range: ReportRange;
  unit?: ReceivingUnitCode;
};

export type OverviewResult = {
  total: number;
  completed: number;
  cancelled: number;
  completionRate: number;
  cancellationRate: number;
  avgWaitMinutes: number;
  avgReceivingMinutes: number;
  byStatus: Record<string, number>;
  checkinOnTime: number;
};

export type BreakdownItem = {
  key: string;
  count: number;
};

export type BreakdownResult = {
  byGoods: BreakdownItem[];
  byVehicle: BreakdownItem[];
  byUnit: BreakdownItem[];
};

export type DailyTrendItem = {
  day: string;
  total: number;
  completed: number;
};

export type HourlyHeatmapItem = {
  hour: number;
  dow: number;
  count: number;
};

export type StatusCountRow = {
  status: DeliveryStatus;
  _count: { id: number };
};

export type DailyTrendRow = {
  day: Date;
  total: bigint;
  completed: bigint;
};

export type HourlyHeatmapRow = {
  hour: number;
  dow: number;
  cnt: bigint;
};

export type SlotPerformanceRow = {
  slotId: string;
  slotCode: string;
  slotName: string;
  vehicleType: string;
  assignedUnit: string;
  totalDeliveries: bigint;
  completedDeliveries: bigint;
  avgReceivingMinutes: number | null;
  maxReceivingMinutes: number | null;
  minReceivingMinutes: number | null;
  totalOccupiedMinutes: number | null;
};

export type SlotPerformanceItem = {
  slotId: string;
  slotCode: string;
  slotName: string;
  vehicleType: string;
  assignedUnit: string;
  totalDeliveries: number;
  completedDeliveries: number;
  completionRate: number;
  avgReceivingMinutes: number | null;
  maxReceivingMinutes: number | null;
  minReceivingMinutes: number | null;
  totalOccupiedMinutes: number;
  utilizationPct: number;
};

export type SlotRecommendationRow = {
  slotId: string;
  slotCode: string;
  vehicleType: string;
  assignedUnit: string;
  totalDeliveries: bigint;
  totalOccupiedMinutes: number | null;
};

export type QueueBacklogRow = {
  unit: string;
  vehicleType: string;
  cnt: bigint;
};

export type PeakHourRow = {
  unit: string;
  vehicleType: string;
  peakHour: number;
  peakCount: bigint;
};

export type SlotRecommendation = {
  unit: string;
  vehicleType: string;
  currentSlots: number;
  avgUtilization: number;
  suggestion: 'ADD_SLOT' | 'REDUCE_SLOT' | 'OPTIMAL';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  action: string;
  backlogNow: number;
  peakHour: number | null;
};

export type SlotRecommendationResult = {
  recommendations: SlotRecommendation[];
  healthScore: number;
  avgUtilization: number;
  periodDays: number;
  analyzedAt: string;
};
