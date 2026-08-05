import api from '../../lib/api';
import type { AnalyticsData } from './types';

export async function fetchReceivingTimes(): Promise<AnalyticsData> {
  const response = await api.get('/api/analytics/receiving-times');
  return response.data;
}

export async function analyzeReceivingTimes(): Promise<string> {
  const response = await api.post('/api/analytics/receiving-times/analyze');
  return response.data.message;
}

export async function acceptReceivingTime(id: string): Promise<void> {
  await api.patch(`/api/analytics/receiving-times/${id}/accept`);
}

export async function acceptAllReceivingTimes(): Promise<string> {
  const response = await api.patch('/api/analytics/receiving-times/accept-all');
  return response.data.message;
}
