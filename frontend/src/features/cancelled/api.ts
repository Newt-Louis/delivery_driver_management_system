import api from '../../lib/api';

export type CancelDeliveryPayload = {
  vehiclePlate: string;
  driverPhone: string;
  poNumber: string;
  registrationCode: string;
  requestedTime: string;
};

export async function cancelDelivery(payload: CancelDeliveryPayload): Promise<{ success: boolean; message: string }> {
  const res = await api.post('/api/deliveries/public-cancel', payload);
  return res.data;
}
