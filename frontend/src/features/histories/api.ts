import api from '../../lib/api';
import type { DeliveryHistoryItem, DeliveryHistoryEventItem, AuditLogItem, PaginatedResponse } from './types';

export interface DeliveryHistoryParams {
  page?: number;
  limit?: number;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  from?: string;
  to?: string;
  finalStatus?: string;
  receivingUnit?: string;
  goodsType?: string;
  vehicleType?: string;
  search?: string;
}

export interface AuditLogParams {
  page?: number;
  limit?: number;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  from?: string;
  to?: string;
  actorType?: string;
  action?: string;
  targetType?: string;
  search?: string;
}

export async function getDeliveryHistory(params: DeliveryHistoryParams): Promise<PaginatedResponse<DeliveryHistoryItem>> {
  const cleaned: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) cleaned[k] = v;
  }
  return (await api.get('/api/histories/delivery', { params: cleaned })).data;
}

export async function getDeliveryHistoryEvents(id: string): Promise<DeliveryHistoryEventItem[]> {
  return (await api.get(`/api/histories/delivery/${id}/events`)).data;
}

export async function getAuditLogs(params: AuditLogParams): Promise<PaginatedResponse<AuditLogItem>> {
  const cleaned: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) cleaned[k] = v;
  }
  return (await api.get('/api/histories/audit', { params: cleaned })).data;
}
