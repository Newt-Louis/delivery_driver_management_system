export type Tab = 'overview' | 'breakdown' | 'slots' | 'ai';
export type ReportTab = { id: Tab; label: string };

export interface Overview {
  total: number; completed: number; cancelled: number;
  completionRate: number; cancellationRate: number;
  avgWaitMinutes: number; avgReceivingMinutes: number;
  byStatus: Record<string, number>; checkinOnTime: number;
}

export interface BreakdownItem { key: string; count: number }
export interface Breakdown { byGoods: BreakdownItem[]; byVehicle: BreakdownItem[]; byUnit: BreakdownItem[] }
export interface DayTrend { day: string; total: number; completed: number }
export interface HeatCell { hour: number; dow: number; count: number }

export interface SlotPerf {
  slotId: string; slotCode: string; slotName: string;
  vehicleType: string; assignedUnit: string;
  totalDeliveries: number; completedDeliveries: number; completionRate: number;
  avgReceivingMinutes: number | null; maxReceivingMinutes: number | null;
  minReceivingMinutes: number | null; totalOccupiedMinutes: number;
  utilizationPct: number;
}

export interface AiRec {
  unit: string; vehicleType: string; currentSlots: number; avgUtilization: number;
  suggestion: 'ADD_SLOT' | 'REDUCE_SLOT' | 'CONVERT_TO_MOTORBIKE' | 'CONVERT_TO_TRUCK' | 'OPTIMAL';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string; action: string; backlogNow: number; peakHour: number | null;
}

export interface AiReport {
  recommendations: AiRec[]; healthScore: number; avgUtilization: number;
  periodDays: number; analyzedAt: string;
}
