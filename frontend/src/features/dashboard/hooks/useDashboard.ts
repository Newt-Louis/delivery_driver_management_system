import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import type { DashboardSummary, DeliveryRegistration, DispatchData, UnitDispatch } from '../../../lib/types';
import {
  callDelivery,
  fetchDashboardDispatch,
  fetchDashboardSummary,
  runDeliveryAction,
} from '../api';
import type { DeliveryLifecycleAction, TabKey } from '../types';
import { getDashboardTabs, getTotalActive } from '../utils';

export function useDashboard() {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const { user } = useAuth();
  const toast = useToast();
  const [selectedTab, setSelectedTab] = useState<TabKey>('ALL');
  const [callTarget, setCallTarget] = useState<DeliveryRegistration | null>(null);
  const [callPreSlot, setCallPreSlot] = useState<string | undefined>(undefined);
  const [callLoading, setCallLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['slots'] });
    // Refresh the expanded row's detail panel (only mounted panels refetch).
    queryClient.invalidateQueries({ queryKey: ['delivery'] });
    // Keep the open "Mượn slot" popup in sync with slot occupancy.
    queryClient.invalidateQueries({ queryKey: ['borrowable-slots'] });
  }, [queryClient]);

  const { data: summary, isError: summaryError, refetch: retrySummary } = useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary', user?.businessLocationId],
    queryFn: fetchDashboardSummary,
    enabled: !!user?.businessLocationId,
    refetchInterval: 30_000,
  });

  const { data: dispatch, isLoading, isError: dispatchError, refetch: retryDispatch } = useQuery<DispatchData>({
    queryKey: ['dashboard', 'dispatch', user?.businessLocationId],
    queryFn: fetchDashboardDispatch,
    enabled: !!user?.businessLocationId,
    refetchInterval: 15_000,
  });

  const canViewAll = user?.role === 'ADMIN_LOC' || user?.role === 'SUPERADMIN';
  const tabs = getDashboardTabs(dispatch).filter((tab) => canViewAll || tab.key !== 'ALL');
  const activeTab = tabs.some((tab) => tab.key === selectedTab) ? selectedTab : tabs[0]?.key;
  function setActiveTab(tab: TabKey) {
    if (tabs.some((item) => item.key === tab)) setSelectedTab(tab);
  }

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
      setCallTarget(null);
      setCallPreSlot(undefined);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Không thể gọi xe vào vị trí này.';
      toast.error(message);
    } finally {
      setCallLoading(false);
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
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Thao tác không thành công.';
      toast.error(message);
    } finally {
      setActionLoading(null);
      if (action === 'cancel') setCancelTargetId(null);
    }
  }

  // "Gọi lại": replays the call notification for the slot the vehicle is already called into.
  // Backend treats PATCH /call with the current slot as a recall (RECALLED event + socket + web push),
  // without changing status or slot.
  // TODO(anti-spam): chưa có cơ chế chống spam/bot toàn cục cho thao tác phát thông báo
  // (rate limit theo user + delivery, cooldown). Hiện chỉ khoá nút trong lúc request đang chạy.
  // Sẽ thảo luận và làm thành tính năng riêng.
  async function doRecall(delivery: DeliveryRegistration) {
    if (!delivery.assignedSlotId) {
      toast.error('Xe chưa được gọi vào vị trí nào.');
      return;
    }
    setActionLoading(delivery.id + 'recall');
    try {
      await callDelivery(delivery.id, delivery.assignedSlotId);
      toast.success(`Đã phát lại thông báo cho xe ${delivery.vehiclePlate}.`);
      invalidateAll();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Không thể phát lại thông báo.';
      toast.error(message);
    } finally {
      setActionLoading(null);
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

  function closeCancelModal() {
    if (!actionLoading) setCancelTargetId(null);
  }

  return {
    activeTab,
    setActiveTab,
    summary,
    dispatch,
    isLoading,
    summaryError, dispatchError, retrySummary, retryDispatch,
    callTarget,
    callPreSlot,
    callLoading,
    actionLoading,
    cancelTargetId,
    tabs,
    totalActive: getTotalActive(dispatch),
    invalidateAll,
    doCall,
    doAction,
    doRecall,
    openCallModal,
    closeCallModal,
    openCallBySuggestion,
    closeCancelModal,
  };
}
