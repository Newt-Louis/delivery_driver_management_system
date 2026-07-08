import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs, type AuditLogParams } from '../api';
import type { AuditLogItem, AuditSortField, SortDir, PaginatedResponse } from '../types';
import { DEFAULT_PAGE_SIZE } from '../constants';

export interface AuditFilters {
  actorType: string;
  action: string;
  targetType: string;
  from: string;
  to: string;
}

export function useAuditLogs() {
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<AuditSortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<AuditFilters>({
    actorType: '',
    action: '',
    targetType: '',
    from: '',
    to: '',
  });

  const setFilter = useCallback(<K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const handleSort = useCallback((field: AuditSortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  const params: AuditLogParams = {
    page,
    limit: DEFAULT_PAGE_SIZE,
    sortField,
    sortDir,
    search: search.trim() || undefined,
    actorType: filters.actorType || undefined,
    action: filters.action || undefined,
    targetType: filters.targetType || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };

  const { data, isLoading, isFetching } = useQuery<PaginatedResponse<AuditLogItem>>({
    queryKey: ['histories-audit', params],
    queryFn: () => getAuditLogs(params),
    placeholderData: (prev) => prev,
  });

  return {
    data,
    isLoading,
    isFetching,
    page,
    setPage,
    sortField,
    sortDir,
    handleSort,
    search,
    setSearch,
    filters,
    setFilter,
  };
}
