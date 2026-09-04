import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import type { Slot } from '../../../lib/types';
import { fetchSlots, updateSlotStatus } from '../api';
import type { SlotStatusValue } from '../types';
import { buildDockStats, groupSlotsByUnit } from '../utils';

export function useDockManagement() {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const { hasRole, user } = useAuth();
  const canEdit = hasRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING');

  const { data: slots = [] } = useQuery<Slot[]>({
    queryKey: ['slots', user?.businessLocationId],
    queryFn: fetchSlots,
    enabled: !!user?.businessLocationId,
  });

  const refreshSlots = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['slots'] });
  }, [queryClient]);

  useEffect(() => {
    socket.on('slot_updated', refreshSlots);
    socket.on('queue_updated', refreshSlots);
    socket.on('delivery_called', refreshSlots);
    socket.on('delivery_completed', refreshSlots);
    return () => {
      socket.off('slot_updated', refreshSlots);
      socket.off('queue_updated', refreshSlots);
      socket.off('delivery_called', refreshSlots);
      socket.off('delivery_completed', refreshSlots);
    };
  }, [socket, refreshSlots]);

  async function handleStatusChange(slotId: string, status: string) {
    await updateSlotStatus(slotId, status as SlotStatusValue);
    refreshSlots();
  }

  const stats = useMemo(() => buildDockStats(slots), [slots]);
  const slotGroups = useMemo(() => groupSlotsByUnit(slots), [slots]);

  return {
    canEdit,
    stats,
    slotGroups,
    handleStatusChange,
  };
}
