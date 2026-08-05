import api from '../../lib/api';
import type { Slot } from '../../lib/types';
import type { SlotStatusValue } from './types';

export async function fetchSlots(realtimeScope: Record<string, unknown>): Promise<Slot[]> {
  const response = await api.get('/api/slots', { params: realtimeScope });
  return response.data;
}

export async function updateSlotStatus(slotId: string, status: SlotStatusValue): Promise<void> {
  await api.patch(`/api/slots/${slotId}/status`, { status });
}
