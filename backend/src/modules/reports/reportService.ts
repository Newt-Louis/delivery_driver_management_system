import { helperFunctions } from '../../helperFunction';
import type { ReportScope } from './reportTypes';
import type { ReportQuery, SlotRecommendation } from './reportTypes';
import * as reportRepository from './reportRepository';

export async function getOverviewReport(query: ReportQuery, scope: ReportScope) {
  const [total, byStatus, avgWait, avgReceiving, checkinOnTime] = await Promise.all([
    reportRepository.countActiveDeliveries(query.range, scope),
    reportRepository.groupActiveDeliveriesByStatus(query.range, scope),
    reportRepository.averageActiveWaitMinutes(query.range, scope),
    reportRepository.averageActiveReceivingMinutes(query.range, scope),
    reportRepository.countActiveCheckinsWithRequestedTime(query.range, scope),
  ]);

  const completed = byStatus.find((status) => status.status === 'COMPLETED')?._count.id ?? 0;
  const cancelled = byStatus.find((status) => status.status === 'CANCELLED')?._count.id ?? 0;

  return {
    total,
    completed,
    cancelled,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    avgWaitMinutes: helperFunctions.roundOne(avgWait[0]?.avg),
    avgReceivingMinutes: helperFunctions.roundOne(avgReceiving[0]?.avg),
    byStatus: Object.fromEntries(byStatus.map((status) => [status.status, status._count.id])),
    checkinOnTime,
  };
}

export async function getBreakdownReport(query: ReportQuery, scope: ReportScope) {
  const [byGoods, byVehicle, byUnit] = await reportRepository.groupActiveBreakdown(query.range, scope);
  return {
    byGoods: byGoods.map((row) => ({ key: row.goodsType, count: row._count.id })),
    byVehicle: byVehicle.map((row) => ({ key: row.vehicleType, count: row._count.id })),
    byUnit: byUnit.map((row) => ({ key: row.receivingUnit, count: row._count.id })),
  };
}

export async function getDailyTrendReport(query: ReportQuery, scope: ReportScope) {
  const rows = await reportRepository.listDailyTrendRows(query.range, scope);
  return rows.map((row) => ({
    day: row.day.toISOString().slice(0, 10),
    total: Number(row.total),
    completed: Number(row.completed),
  }));
}

export async function getHourlyHeatmapReport(query: ReportQuery, scope: ReportScope) {
  const rows = await reportRepository.listHourlyHeatmapRows(query.range, scope);
  return rows.map((row) => ({ hour: row.hour, dow: row.dow, count: Number(row.cnt) }));
}

export async function getSlotPerformanceReport(query: ReportQuery, scope: ReportScope) {
  const rows = await reportRepository.listSlotPerformanceRows(query.range, scope);
  const { availableMinutes } = helperFunctions.operatingWindowMinutes(query.range);

  return rows.map((row) => {
    const total = Number(row.totalDeliveries);
    const completed = Number(row.completedDeliveries);
    const occupied = row.totalOccupiedMinutes ?? 0;
    const utilizationPct = availableMinutes > 0
      ? Math.min(100, Math.round((occupied / availableMinutes) * 100))
      : 0;

    return {
      slotId: row.slotId,
      slotCode: row.slotCode,
      slotName: row.slotName,
      vehicleType: row.vehicleType,
      assignedUnit: row.assignedUnit,
      totalDeliveries: total,
      completedDeliveries: completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgReceivingMinutes: row.avgReceivingMinutes ? helperFunctions.roundOne(row.avgReceivingMinutes) : null,
      maxReceivingMinutes: row.maxReceivingMinutes ? Math.round(row.maxReceivingMinutes) : null,
      minReceivingMinutes: row.minReceivingMinutes ? Math.round(row.minReceivingMinutes) : null,
      totalOccupiedMinutes: Math.round(occupied),
      utilizationPct,
    };
  });
}

type SlotGroup = {
  unit: string;
  vehicleType: string;
  count: number;
  totalUtil: number;
  avgUtil: number;
  avgDeliveries: number;
};

export async function getAiSlotRecommendationsReport(query: ReportQuery, scope: ReportScope) {
  const [slots, queueBacklog, peakRows] = await Promise.all([
    reportRepository.listSlotRecommendationRows(query.range, scope),
    reportRepository.listQueueBacklogRows(scope),
    reportRepository.listPeakHourRows(query.range, scope),
  ]);

  const { periodDays, availableMinutes } = helperFunctions.operatingWindowMinutes(query.range);
  const byGroup = new Map<string, SlotGroup>();

  for (const slot of slots) {
    const key = `${slot.assignedUnit}|${slot.vehicleType}`;
    const util = availableMinutes > 0 ? Math.min(100, ((slot.totalOccupiedMinutes ?? 0) / availableMinutes) * 100) : 0;
    const group = byGroup.get(key) ?? {
      unit: slot.assignedUnit,
      vehicleType: slot.vehicleType,
      count: 0,
      totalUtil: 0,
      avgUtil: 0,
      avgDeliveries: 0,
    };
    group.count += 1;
    group.totalUtil += util;
    group.avgDeliveries += Number(slot.totalDeliveries);
    byGroup.set(key, group);
  }

  for (const group of byGroup.values()) {
    group.avgUtil = group.count > 0 ? group.totalUtil / group.count : 0;
    group.avgDeliveries = group.count > 0 ? group.avgDeliveries / group.count : 0;
  }

  const recommendations: SlotRecommendation[] = [];
  for (const group of byGroup.values()) {
    const backlog = Number(queueBacklog.find((row) => row.unit === group.unit && row.vehicleType === group.vehicleType)?.cnt ?? 0);
    const relevantPeak = peakRows.find((row) => row.unit === group.unit && row.vehicleType === group.vehicleType);
    const peakHour = relevantPeak ? Number(relevantPeak.peakHour) : null;
    const util = Math.round(group.avgUtil);
    const vehicleLabel = group.vehicleType === 'TRUCK'
      ? 'xe tải'
      : group.vehicleType === 'MOTORBIKE'
        ? 'xe máy'
        : 'xe khác';
    const unitLabel = scope.unitMeta?.[group.unit]?.displayName ?? group.unit;

    if (util >= 85 || backlog >= 5) {
      recommendations.push({
        unit: group.unit,
        vehicleType: group.vehicleType,
        currentSlots: group.count,
        avgUtilization: util,
        suggestion: 'ADD_SLOT',
        priority: util >= 92 || backlog >= 10 ? 'HIGH' : 'MEDIUM',
        reason: `Mức sử dụng trung bình ${util}%${backlog > 0 ? ` và tồn đọng ${backlog} xe đang chờ` : ''}. Ngưỡng khuyến nghị thêm slot là 85%.`,
        action: `Thêm ít nhất 1 slot ${vehicleLabel} cho khu ${unitLabel}. Ưu tiên giờ cao điểm${peakHour != null ? ` ${peakHour}:00–${peakHour + 1}:00` : ' buổi sáng'}.`,
        backlogNow: backlog,
        peakHour,
      });
    } else if (util <= 25 && group.count > 1 && backlog === 0) {
      recommendations.push({
        unit: group.unit,
        vehicleType: group.vehicleType,
        currentSlots: group.count,
        avgUtilization: util,
        suggestion: 'REDUCE_SLOT',
        priority: util <= 15 ? 'MEDIUM' : 'LOW',
        reason: `Mức sử dụng trung bình chỉ ${util}%, thấp hơn ngưỡng hiệu quả (25%). Không có xe tồn đọng.`,
        action: `Xem xét giảm 1 slot ${vehicleLabel} cho khu ${unitLabel} hoặc chuyển sang loại xe có nhu cầu cao hơn.`,
        backlogNow: 0,
        peakHour,
      });
    } else {
      recommendations.push({
        unit: group.unit,
        vehicleType: group.vehicleType,
        currentSlots: group.count,
        avgUtilization: util,
        suggestion: 'OPTIMAL',
        priority: 'LOW',
        reason: `Mức sử dụng ${util}% trong vùng tối ưu (25–85%).`,
        action: 'Duy trì cấu hình hiện tại. Tiếp tục theo dõi xu hướng hàng tuần.',
        backlogNow: backlog,
        peakHour,
      });
    }
  }

  const priorityOrder: Record<SlotRecommendation['priority'], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const groups = [...byGroup.values()];
  const avgOverall = groups.length > 0
    ? groups.reduce((sum, group) => sum + group.avgUtil, 0) / groups.length
    : 0;
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - Math.abs(avgOverall - 65))));

  return {
    recommendations,
    healthScore,
    avgUtilization: Math.round(avgOverall),
    periodDays: Math.round(periodDays),
    analyzedAt: new Date().toISOString(),
  };
}
