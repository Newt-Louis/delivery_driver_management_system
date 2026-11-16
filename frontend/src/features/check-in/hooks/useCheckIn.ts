import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { App } from 'antd';
import { downloadCsv } from '../../../lib/export';
import type { DeliveryRegistration } from '../../../lib/types';
import { checkInByLookup, fetchRegisteredDeliveries, fetchWaitingDeliveries } from '../api';
import { useAuth } from '../../../context/AuthContext';
import { WAITING_CSV_HEADERS } from '../constants';
import type { CheckInMode } from '../types';
import { buildWaitingCsvRows } from '../utils';

type CheckInErrorData = {
  error?: string;
  message?: string;
  deliveryWindows?: string;
  canOverride?: boolean;
};

function getCheckInErrorData(error: unknown): CheckInErrorData | undefined {
  return (error as { response?: { data?: CheckInErrorData } })?.response?.data;
}

function outsideWindowMessage(data: CheckInErrorData): string {
  const windows = data.deliveryWindows ? ` Khung giờ quy định: ${data.deliveryWindows}.` : '';
  return `${data.message ?? 'Quá khung giờ giao hàng quy định'}.${windows}`;
}

function getCheckInErrorMessage(error: unknown): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message
    ?? 'Không tìm thấy xe hoặc đã check-in rồi';
}

export function useCheckIn() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<CheckInMode>('plate');
  const [result, setResult] = useState<DeliveryRegistration | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [day, setDay] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const { user } = useAuth();
  const { modal } = App.useApp();
  useEffect(() => {
    const update = () => setDay(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const waiting = useQuery<DeliveryRegistration[]>({
    queryKey: ['check-in', 'waiting', user?.businessLocationId, user?.id],
    queryFn: fetchWaitingDeliveries,
    refetchInterval: 30000,
  });
  const registered = useQuery<DeliveryRegistration[]>({
    queryKey: ['check-in', 'registered', user?.businessLocationId, user?.id, day],
    queryFn: fetchRegisteredDeliveries,
    refetchInterval: 30000,
  });
  const waitingList = [...(waiting.data ?? [])].sort((a, b) => new Date(a.checkinTime ?? 8640000000000000).getTime() - new Date(b.checkinTime ?? 8640000000000000).getTime());
  const registeredList = (registered.data ?? []).filter((delivery) => new Date(delivery.requestedTime ?? delivery.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) === day);

  function changeMode(nextMode: CheckInMode) {
    setMode(nextMode);
    setInput('');
    setResult(null);
    setError('');
  }

  function changeInput(value: string) {
    setInput(value.toUpperCase());
  }

  async function runCheckIn(lookupMode: CheckInMode, lookupInput: string, overrideDeliveryWindow: boolean) {
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const checkedInDelivery = await checkInByLookup(lookupMode, lookupInput, { overrideDeliveryWindow });
      setResult(checkedInDelivery);
      setInput('');
      void waiting.refetch();
      void registered.refetch();
    } catch (err: unknown) {
      const data = getCheckInErrorData(err);
      if (data?.error !== 'OutsideDeliveryWindow') {
        setError(getCheckInErrorMessage(err));
        return;
      }
      // CHECKIN bị chặn; ADMIN_OPE trở lên được hỏi xác nhận cho trường hợp đặc biệt.
      if (!data.canOverride || overrideDeliveryWindow) {
        setError(outsideWindowMessage(data));
        return;
      }
      modal.confirm({
        title: 'Xe giao hàng không trong khung giờ quy định, vẫn tiếp tục nhận hàng không?',
        content: data.deliveryWindows ? `Khung giờ quy định: ${data.deliveryWindows}` : undefined,
        okText: 'Đồng ý',
        cancelText: 'Huỷ bỏ',
        okButtonProps: { type: 'primary' },
        cancelButtonProps: { color: 'danger', variant: 'solid' },
        onOk: () => runCheckIn(lookupMode, lookupInput, true),
        onCancel: () => setError(outsideWindowMessage(data)),
      });
    } finally {
      setLoading(false);
    }
  }

  function submitCheckIn(event: FormEvent) {
    event.preventDefault();
    void runCheckIn(mode, input, false);
  }

  function exportWaitingList(deliveries = waitingList) {
    downloadCsv('xe-dang-cho', WAITING_CSV_HEADERS, buildWaitingCsvRows(deliveries));
  }

  return {
    input,
    mode,
    result,
    error,
    loading,
    waitingList,
    registeredList,
    waiting,
    registered,
    changeInput,
    changeMode,
    submitCheckIn,
    exportWaitingList,
  };
}
