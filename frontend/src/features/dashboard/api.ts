import api from '../../lib/api';
import type { DashboardSummary, DeliveryRegistration, DispatchData } from '../../lib/types';
import type { DeliveryLifecycleAction } from './types';

export async function fetchDashboardSummary(realtimeScope: Record<string, unknown>): Promise<DashboardSummary> {
  const response = await api.get('/api/dashboard/summary', { params: realtimeScope });
  return response.data;
}

export async function fetchDashboardDispatch(realtimeScope: Record<string, unknown>): Promise<DispatchData> {
  const response = await api.get('/api/dashboard/dispatch', { params: realtimeScope });
  return response.data;
}

export async function fetchDeliveryDetail(id: string): Promise<DeliveryRegistration> {
  const response = await api.get(`/api/deliveries/${id}`);
  return response.data;
}

export async function callDelivery(deliveryId: string, slotId: string): Promise<void> {
  await api.patch(`/api/deliveries/${deliveryId}/call`, { slotId });
}

export async function runDeliveryAction(id: string, action: DeliveryLifecycleAction, reason?: string): Promise<void> {
  await api.patch(`/api/deliveries/${id}/${action}`, action === 'cancel' ? { reason } : undefined);
}

export async function expireStaleDeliveries(): Promise<string> {
  const response = await api.post('/api/dashboard/expire-stale');
  return response.data.message;
}
