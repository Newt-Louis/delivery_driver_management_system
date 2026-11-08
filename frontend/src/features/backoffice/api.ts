import api from '../../lib/api';
import type { DeviceItem, DeviceType, StaffUser } from './types';

export interface StaffUserPayload {
  name?: string;
  email?: string | null;
  password?: string;
  role?: 'ADMIN_OPE' | 'RECEIVING' | 'CHECKIN';
  unit?: string | null;
  unitConfigIds?: string[];
  department?: string | null;
  isActive?: boolean;
}

export type StaffUserCreatePayload = StaffUserPayload & {
  name: string;
  password: string;
  role: 'ADMIN_OPE' | 'RECEIVING' | 'CHECKIN';
};

export interface DeviceCreatePayload {
  code: string;
  name: string;
  businessLocationId: string;
  deviceType: DeviceType;
  deviceSecret: string;
}

export interface DeviceUpdatePayload {
  name?: string;
  deviceType?: DeviceType;
  isActive?: boolean;
  deviceSecret?: string;
}

export async function fetchLocationStaffUsers() {
  return (await api.get<StaffUser[]>('/api/users/location-staff')).data;
}

export async function createLocationStaffUser(payload: StaffUserCreatePayload) {
  return (await api.post<StaffUser>('/api/users/location-staff', payload)).data;
}

export async function updateLocationStaffUser(id: string, payload: StaffUserPayload) {
  return (await api.patch<StaffUser>(`/api/users/location-staff/${id}`, payload)).data;
}

export async function resetLocationStaffPassword(id: string, password: string) {
  return (await api.patch(`/api/users/location-staff/${id}/reset-password`, { password })).data;
}

export async function deleteLocationStaffUser(id: string) {
  return (await api.delete(`/api/users/location-staff/${id}`)).data;
}

export async function fetchDevices() {
  return (await api.get<DeviceItem[]>('/api/devices')).data;
}

export async function createDevice(payload: DeviceCreatePayload) {
  return (await api.post<DeviceItem>('/api/devices', payload)).data;
}

export async function updateDevice(id: string, payload: DeviceUpdatePayload) {
  return (await api.patch<DeviceItem>(`/api/devices/${id}`, payload)).data;
}

export async function deactivateDevice(id: string) {
  return (await api.delete<{ deactivated: boolean; device: DeviceItem }>(`/api/devices/${id}`)).data;
}
