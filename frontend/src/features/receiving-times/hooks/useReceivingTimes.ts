import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { downloadCsv } from '../../../lib/export';
import {
  acceptAllReceivingTimes,
  acceptReceivingTime,
  analyzeReceivingTimes,
  fetchReceivingTimes,
} from '../api';
import { RECEIVING_TIMES_CSV_HEADERS } from '../constants';
import type { AnalyticsData, FlashMessage } from '../types';
import { buildReceivingTimesCsvRows, groupReceivingTimeConfigs } from '../utils';

function getErrorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback;
}

export function useReceivingTimes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [analyzing, setAnalyzing] = useState(false);
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [message, setMessage] = useState<FlashMessage>(null);

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics', 'receiving-times'],
    queryFn: fetchReceivingTimes,
    staleTime: 10_000,
  });

  function flash(text: string, ok: boolean) {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 4000);
  }

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      flash(await analyzeReceivingTimes(), true);
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    } catch {
      flash('Lỗi khi phân tích. Vui lòng thử lại.', false);
    } finally {
      setAnalyzing(false);
    }
  }

  async function acceptOne(id: string) {
    setAcceptingId(id);
    try {
      await acceptReceivingTime(id);
      flash('Đã chấp nhận khuyến nghị', true);
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    } catch (error: unknown) {
      flash(getErrorMessage(error, 'Lỗi khi chấp nhận'), false);
    } finally {
      setAcceptingId(null);
    }
  }

  async function acceptAll() {
    setAcceptingAll(true);
    try {
      flash(await acceptAllReceivingTimes(), true);
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    } catch {
      flash('Lỗi khi chấp nhận', false);
    } finally {
      setAcceptingAll(false);
    }
  }

  const configs = data?.configs ?? [];
  const pendingCount = configs.filter((config) => config.shouldUpdate).length;
  const canManageConfig = user?.role === 'SUPERADMIN' || user?.role === 'ADMIN_LOC';
  const unitGroups = useMemo(() => groupReceivingTimeConfigs(configs), [configs]);

  function exportCsv() {
    downloadCsv('thoi-gian-nhan-hang', RECEIVING_TIMES_CSV_HEADERS, buildReceivingTimesCsvRows(configs));
  }

  return {
    data,
    configs,
    isLoading,
    analyzing,
    acceptingAll,
    acceptingId,
    message,
    pendingCount,
    canManageConfig,
    unitGroups,
    runAnalysis,
    acceptOne,
    acceptAll,
    exportCsv,
  };
}
