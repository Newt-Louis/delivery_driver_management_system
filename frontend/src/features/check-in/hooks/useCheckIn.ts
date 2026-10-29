import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { downloadCsv } from '../../../lib/export';
import type { DeliveryRegistration } from '../../../lib/types';
import { checkInByLookup, fetchRegisteredDeliveries, fetchWaitingDeliveries } from '../api';
import { useAuth } from '../../../context/AuthContext';
import { WAITING_CSV_HEADERS } from '../constants';
import type { CheckInMode } from '../types';
import { buildWaitingCsvRows } from '../utils';

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

  async function submitCheckIn(event: FormEvent) {
    event.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const checkedInDelivery = await checkInByLookup(mode, input);
      setResult(checkedInDelivery);
      setInput('');
      void waiting.refetch();
      void registered.refetch();
    } catch (err: unknown) {
      setError(getCheckInErrorMessage(err));
    } finally {
      setLoading(false);
    }
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
