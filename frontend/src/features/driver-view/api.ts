import api from '../../lib/api';
import type { DeliveryRegistration } from '../../lib/types';

export async function fetchDriverQueue(): Promise<DeliveryRegistration[]> {
  const response = await api.get('/api/deliveries/queue');
  return response.data;
}
