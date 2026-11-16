import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRegistrationHistory, type RegistrationHistoryParams } from '../api';
import type { PaginatedResponse, RegistrationHistoryItem, RegistrationSortField, SortDir } from '../types';
import { DEFAULT_PAGE_SIZE } from '../constants';

export interface RegistrationFilters {
  status: string;
  receivingUnit: string;
  vehicleType: string;
  from: string;
  to: string;
}

export function useRegistrationHistory(enabled: boolean) {
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<RegistrationSortField>('registeredAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearchValue] = useState('');
  const [filters, setFilters] = useState<RegistrationFilters>({
    status: '',
    receivingUnit: '',
    vehicleType: '',
    from: '',
    to: '',
  });

  const setFilter = useCallback(<K extends keyof RegistrationFilters>(key: K, value: RegistrationFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const setSearch = useCallback((value: string) => {
    setSearchValue(value);
    setPage(1);
  }, []);

  const handleSort = useCallback((field: RegistrationSortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  const params: RegistrationHistoryParams = {
    page,
    limit: DEFAULT_PAGE_SIZE,
    sortField,
    sortDir,
    search: search.trim() || undefined,
    status: filters.status || undefined,
    receivingUnit: filters.receivingUnit || undefined,
    vehicleType: filters.vehicleType || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };

  const { data, isLoading, isFetching, isError, refetch } = useQuery<PaginatedResponse<RegistrationHistoryItem>>({
    queryKey: ['histories-registration', params],
    queryFn: () => getRegistrationHistory(params),
    placeholderData: (prev) => prev,
    enabled,
  });

  return {
    data,
    isLoading,
    isFetching, isError, refetch,
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
