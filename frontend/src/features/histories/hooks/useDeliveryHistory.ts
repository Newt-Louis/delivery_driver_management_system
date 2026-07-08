import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDeliveryHistory, type DeliveryHistoryParams } from '../api';
import type { DeliveryHistoryItem, DeliverySortField, SortDir, PaginatedResponse } from '../types';
import { DEFAULT_PAGE_SIZE } from '../constants';

export interface DeliveryFilters {
  finalStatus: string;
  receivingUnit: string;
  goodsType: string;
  vehicleType: string;
  from: string;
  to: string;
}

export function useDeliveryHistory() {
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<DeliverySortField>('registeredAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<DeliveryFilters>({
    finalStatus: '',
    receivingUnit: '',
    goodsType: '',
    vehicleType: '',
    from: '',
    to: '',
  });

  const setFilter = useCallback(<K extends keyof DeliveryFilters>(key: K, value: DeliveryFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const handleSort = useCallback((field: DeliverySortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortDir('desc');
      return field;
    });
  }, []);

  const params: DeliveryHistoryParams = {
    page,
    limit: DEFAULT_PAGE_SIZE,
    sortField,
    sortDir,
    search: search.trim() || undefined,
    finalStatus: filters.finalStatus || undefined,
    receivingUnit: filters.receivingUnit || undefined,
    goodsType: filters.goodsType || undefined,
    vehicleType: filters.vehicleType || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };

  const { data, isLoading, isFetching } = useQuery<PaginatedResponse<DeliveryHistoryItem>>({
    queryKey: ['histories-delivery', params],
    queryFn: () => getDeliveryHistory(params),
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
