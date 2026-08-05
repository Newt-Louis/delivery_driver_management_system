import api from '../../lib/api';
import type { DeliveryRegistration } from '../../lib/types';
import type { CheckInMode } from './types';

export async function fetchWaitingDeliveries(): Promise<DeliveryRegistration[]> {
  const response = await api.get('/api/deliveries', { params: { status: 'WAITING' } });
  return response.data;
}

export async function checkInByLookup(mode: CheckInMode, input: string): Promise<DeliveryRegistration> {
  const payload = mode === 'plate' ? { vehiclePlate: input } : { registrationCode: input };
  const response = await api.patch('/api/deliveries/check-in-lookup', payload);
  return response.data;
}
