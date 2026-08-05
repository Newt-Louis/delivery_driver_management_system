import api from '../../lib/api';
import type { UnitConfig } from '../../lib/types';
import type { Overview, Breakdown, DayTrend, HeatCell, SlotPerf, AiReport } from './types';

type DateParams = { from: string; to: string; unit?: string };

function buildParams({ from, to, unit }: DateParams) {
  return { from, to, unit: unit || undefined };
}

export async function fetchUnitConfigs(): Promise<UnitConfig[]> {
  return (await api.get('/api/units/configs')).data;
}

export async function fetchOverview(params: DateParams): Promise<Overview> {
  return (await api.get('/api/reports/overview', { params: buildParams(params) })).data;
}

export async function fetchDailyTrend(params: DateParams): Promise<DayTrend[]> {
  return (await api.get('/api/reports/daily-trend', { params: buildParams(params) })).data;
}

export async function fetchHourlyHeatmap(params: DateParams): Promise<HeatCell[]> {
  return (await api.get('/api/reports/hourly-heatmap', { params: buildParams(params) })).data;
}

export async function fetchBreakdown(params: DateParams): Promise<Breakdown> {
  return (await api.get('/api/reports/breakdown', { params: buildParams(params) })).data;
}

export async function fetchSlotPerformance(params: DateParams): Promise<SlotPerf[]> {
  return (await api.get('/api/reports/slot-performance', { params: buildParams(params) })).data;
}

export async function fetchAiRecommendations(params: DateParams): Promise<AiReport> {
  return (await api.get('/api/reports/ai-slot-recommendations', { params: buildParams(params) })).data;
}
