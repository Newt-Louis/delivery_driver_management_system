import api from '../../lib/api';
import type {
  AppConfigItem,
  BusinessLocation,
  DeviceItem,
  SuperadminOverview,
} from './types';
import type { AutoWarehouseVendor, ReceivingTimeConfig, UnitConfig, User } from '../../lib/types';

function scopeParams(scope?: { businessLocationId?: string; unitConfigId?: string; unit?: string }) {
  const params = new URLSearchParams();
  if (scope?.businessLocationId) params.set('businessLocationId', scope.businessLocationId);
  if (scope?.unitConfigId) params.set('unitConfigId', scope.unitConfigId);
  if (scope?.unit) params.set('unit', scope.unit);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const superadminApi = {
  overview: async () => (await api.get<SuperadminOverview>('/api/superadmin/overview')).data,
  locations: async () => (await api.get<BusinessLocation[]>('/api/superadmin/business-locations')).data,
  units: async (scope?: { businessLocationId?: string }) => (
    await api.get<UnitConfig[]>(`/api/superadmin/unit-configs${scopeParams(scope)}`)
  ).data,
  zones: async (scope?: { businessLocationId?: string; unitConfigId?: string }) => (
    await api.get(`/api/superadmin/zones${scopeParams(scope)}`)
  ).data,
  slots: async (scope?: { businessLocationId?: string; unitConfigId?: string }) => (
    await api.get(`/api/superadmin/slots${scopeParams(scope)}`)
  ).data,
  users: async () => (await api.get<User[]>('/api/users')).data,
  createUser: (payload: Record<string, unknown>) => api.post('/api/users', payload),
  updateUser: (id: string, payload: Record<string, unknown>) => api.patch(`/api/users/${id}`, payload),
  resetUserPassword: (id: string, password: string) => api.patch(`/api/users/${id}/reset-password`, { password }),
  deleteUser: (id: string) => api.delete(`/api/users/${id}`),
  regenerateUser: (id: string) => api.patch(`/api/users/${id}/regenerate`),
  goodsTypes: async (scope?: { businessLocationId?: string; unitConfigId?: string }) => (
    await api.get(`/api/superadmin/goods-types${scopeParams(scope)}`)
  ).data,
  timeWindows: async (scope?: { businessLocationId?: string; unitConfigId?: string }) => (
    await api.get(`/api/superadmin/time-windows${scopeParams(scope)}`)
  ).data,
  autoWarehouseVendors: async (scope?: { businessLocationId?: string; unitConfigId?: string }) => (
    await api.get<AutoWarehouseVendor[]>(`/api/superadmin/auto-warehouse-vendors${scopeParams(scope)}`)
  ).data,
  devices: async (scope?: { businessLocationId?: string }) => (
    await api.get<DeviceItem[]>(`/api/superadmin/devices${scopeParams(scope)}`)
  ).data,
  appConfigs: async () => (await api.get<AppConfigItem[]>('/api/superadmin/app-configs')).data,
  receivingTimeConfigs: async (scope?: { businessLocationId?: string; unitConfigId?: string }) => (
    await api.get<ReceivingTimeConfig[]>(`/api/superadmin/receiving-time-configs${scopeParams(scope)}`)
  ).data,

  createLocation: (payload: Partial<BusinessLocation>) => api.post('/api/superadmin/business-locations', payload),
  updateLocation: (id: string, payload: Partial<BusinessLocation>) => api.patch(`/api/superadmin/business-locations/${id}`, payload),
  deleteLocation: (id: string) => api.delete(`/api/superadmin/business-locations/${id}`),

  createUnit: (payload: Partial<UnitConfig>) => api.post('/api/superadmin/unit-configs', payload),
  updateUnit: (id: string, payload: Partial<UnitConfig>) => api.patch(`/api/superadmin/unit-configs/${id}`, payload),
  deleteUnit: (id: string) => api.delete(`/api/superadmin/unit-configs/${id}`),

  createVendor: (payload: Record<string, unknown>) => api.post('/api/superadmin/auto-warehouse-vendors', payload),
  updateVendor: (id: string, payload: Record<string, unknown>) => api.patch(`/api/superadmin/auto-warehouse-vendors/${id}`, payload),
  deleteVendor: (id: string) => api.delete(`/api/superadmin/auto-warehouse-vendors/${id}`),

  createDevice: (payload: Record<string, unknown>) => api.post('/api/superadmin/devices', payload),
  updateDevice: (id: string, payload: Record<string, unknown>) => api.patch(`/api/superadmin/devices/${id}`, payload),
  deleteDevice: (id: string) => api.delete(`/api/superadmin/devices/${id}`),

  updateAppConfig: (key: string, payload: Record<string, unknown>) => api.patch(`/api/superadmin/app-configs/${key}`, payload),

  createReceivingTime: (payload: Record<string, unknown>) => api.post('/api/superadmin/receiving-time-configs', payload),
  updateReceivingTime: (id: string, payload: Record<string, unknown>) => api.patch(`/api/superadmin/receiving-time-configs/${id}`, payload),
  deleteReceivingTime: (id: string) => api.delete(`/api/superadmin/receiving-time-configs/${id}`),
};
