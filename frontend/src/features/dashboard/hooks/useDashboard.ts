import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtimeScope, useSocket } from '../../../context/SocketContext';
import type { DashboardSummary, DeliveryRegistration, DispatchData, UnitDispatch } from '../../../lib/types';
import {
  callDelivery,
  fetchDashboardDispatch,
  fetchDashboardSummary,
  runDeliveryAction,
} from '../api';
import type { DeliveryLifecycleAction, TabKey } from '../types';
import { getDashboardTabs, getDispatchSlots, getTotalWaiting } from '../utils';

export function useDashboard() {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const realtimeScope = useRealtimeScope();
  const [activeTab, setActiveTab] = useState<TabKey>('ALL');
  const [callTarget, setCallTarget] = useState<DeliveryRegistration | null>(null);
  const [callPreSlot, setCallPreSlot] = useState<string | undefined>(undefined);
  const [callLoading, setCallLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['slots'] });
  }, [queryClient]);

  const { data: summary } = useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary', realtimeScope],
    queryFn: () => fetchDashboardSummary(realtimeScope),
    refetchInterval: 30_000,
  });

  const { data: dispatch, isLoading } = useQuery<DispatchData>({
    queryKey: ['dashboard', 'dispatch', realtimeScope],
    queryFn: () => fetchDashboardDispatch(realtimeScope),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    socket.on('queue_updated', invalidateAll);
    socket.on('slot_updated', invalidateAll);
    socket.on('delivery_completed', invalidateAll);
    socket.on('delivery_called', invalidateAll);
    return () => {
      socket.off('queue_updated', invalidateAll);
      socket.off('slot_updated', invalidateAll);
      socket.off('delivery_completed', invalidateAll);
      socket.off('delivery_called', invalidateAll);
    };
  }, [socket, invalidateAll]);

  async function doCall(slotId: string) {
    if (!callTarget) return;
    setCallLoading(true);
    try {
      await callDelivery(callTarget.id, slotId);
      invalidateAll();
    } finally {
      setCallLoading(false);
      setCallTarget(null);
      setCallPreSlot(undefined);
    }
  }

  async function doAction(id: string, action: DeliveryLifecycleAction, reason?: string) {
    if (action === 'cancel' && !reason) {
      setCancelTargetId(id);
      return;
    }

    setActionLoading(id + action);
    try {
      await runDeliveryAction(id, action, reason);
      invalidateAll();
    } finally {
      setActionLoading(null);
      if (action === 'cancel') setCancelTargetId(null);
    }
  }

  function openCallModal(delivery: DeliveryRegistration, preSlotId?: string) {
    setCallTarget(delivery);
    setCallPreSlot(preSlotId);
  }

  function closeCallModal() {
    setCallTarget(null);
    setCallPreSlot(undefined);
  }

  function openCallBySuggestion(deliveryId: string, slotId?: string) {
    if (!dispatch) return;
    for (const unitDispatch of Object.values(dispatch) as UnitDispatch[]) {
      const delivery = unitDispatch.active.find((item) => item.id === deliveryId);
      if (delivery) {
        openCallModal(delivery, slotId);
        return;
      }
    }
  }

  function closeViewModal() {
    setViewId(null);
  }

  function closeCancelModal() {
    if (!actionLoading) setCancelTargetId(null);
  }

  return {
    activeTab,
    setActiveTab,
    summary,
    dispatch,
    isLoading,
    callTarget,
    callPreSlot,
    callLoading,
    actionLoading,
    viewId,
    cancelTargetId,
    allSlots: getDispatchSlots(dispatch),
    tabs: getDashboardTabs(dispatch),
    totalWaiting: getTotalWaiting(dispatch),
    invalidateAll,
    doCall,
    doAction,
    openCallModal,
    closeCallModal,
    openCallBySuggestion,
    setViewId,
    closeViewModal,
    closeCancelModal,
  };
}
