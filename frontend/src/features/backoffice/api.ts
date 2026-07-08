import api from '../../lib/api';
import type { StaffUser } from './types';

export interface StaffUserPayload {
  name: string;
  email?: string | null;
  password?: string;
  role: 'ADMIN_OPE' | 'RECEIVING' | 'CHECKIN';
  unit?: string | null;
  unitConfigIds?: string[];
  department?: string | null;
  isActive?: boolean;
}

export async function fetchLocationStaffUsers() {
  return (await api.get<StaffUser[]>('/api/users/location-staff')).data;
}

export async function createLocationStaffUser(payload: StaffUserPayload & { password: string }) {
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
