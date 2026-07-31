import api from '../../lib/api';
import type { DeliveryHistoryItem, DeliveryHistoryEventItem, AuditLogItem, PaginatedResponse } from './types';
import { cleanQueryParams } from './utils/queryParams';

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
  return (await api.get('/api/histories/delivery', { params: cleanQueryParams(params) })).data;
}

export async function getDeliveryHistoryEvents(id: string): Promise<DeliveryHistoryEventItem[]> {
  return (await api.get(`/api/histories/delivery/${id}/events`)).data;
}

export async function getAuditLogs(params: AuditLogParams): Promise<PaginatedResponse<AuditLogItem>> {
  return (await api.get('/api/histories/audit', { params: cleanQueryParams(params) })).data;
}
