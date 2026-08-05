import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { downloadCsv } from '../../../lib/export';
import type { DeliveryRegistration } from '../../../lib/types';
import { checkInByLookup, fetchWaitingDeliveries } from '../api';
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

  const { data: waitingList, refetch } = useQuery<DeliveryRegistration[]>({
    queryKey: ['deliveries', 'waiting'],
    queryFn: fetchWaitingDeliveries,
  });

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
      refetch();
    } catch (err: unknown) {
      setError(getCheckInErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function exportWaitingList() {
    downloadCsv('xe-dang-cho', WAITING_CSV_HEADERS, buildWaitingCsvRows(waitingList ?? []));
  }

  return {
    input,
    mode,
    result,
    error,
    loading,
    waitingList,
    changeInput,
    changeMode,
    submitCheckIn,
    exportWaitingList,
  };
}
