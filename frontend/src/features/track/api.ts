import api from '../../lib/api';
import type { TrackDelivery } from './types';

export async function fetchDeliveryByCode(code: string): Promise<TrackDelivery> {
  return (await api.get<TrackDelivery>(`/api/track/${code}`)).data;
}

export async function searchByPlate(plate: string): Promise<{ registrationCode: string }> {
  return (await api.get<{ registrationCode: string }>('/api/track/search', { params: { plate } })).data;
}

export async function fetchVapidKey(): Promise<{ publicKey: string }> {
  return (await api.get<{ publicKey: string }>('/api/push/vapid-public-key')).data;
}

export async function postPushSubscription(subscription: object, deliveryCode: string): Promise<void> {
  await api.post('/api/push/subscribe', { subscription, deliveryCode });
}
