import { useQuery } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import type { AIGatewayLogQueryParams } from '@web/types/api';
import { useMemo, useState } from 'react';

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return {
    startDateInput: toLocalDateTimeInputValue(start),
    endDateInput: toLocalDateTimeInputValue(end),
  };
}

export function useAIGatewayLogs() {
  const defaults = useMemo(() => getDefaultDateRange(), []);

  const [searchInput, setSearchInput] = useState('');
  const [startDateInput, setStartDateInput] = useState(defaults.startDateInput);
  const [endDateInput, setEndDateInput] = useState(defaults.endDateInput);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    startDateInput: defaults.startDateInput,
    endDateInput: defaults.endDateInput,
    perPage: 20,
  });

  const queryParams: AIGatewayLogQueryParams = useMemo(
    () => ({
      page,
      perPage: appliedFilters.perPage,
      order: 'desc',
      orderBy: 'created_at',
      search: appliedFilters.search || undefined,
      startDate: appliedFilters.startDateInput
        ? new Date(appliedFilters.startDateInput).toISOString()
        : undefined,
      endDate: appliedFilters.endDateInput
        ? new Date(appliedFilters.endDateInput).toISOString()
        : undefined,
    }),
    [appliedFilters, page]
  );

  const query = useQuery({
    queryKey: ['ai-gateway-logs', queryParams],
    queryFn: () => API.getAIGatewayLogs(queryParams),
    retry: false,
    staleTime: 60 * 1000,
  });

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({
      search: searchInput.trim(),
      startDateInput,
      endDateInput,
      perPage,
    });
  };

  const totalPages = query.data?.pagination.totalPages ?? 1;
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const error = query.error instanceof Error ? query.error.message : null;

  return {
    logs: query.data?.logs ?? [],
    pagination: query.data?.pagination ?? {
      page,
      perPage: appliedFilters.perPage,
      count: 0,
      totalCount: 0,
      totalPages: 1,
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error,
    searchInput,
    startDateInput,
    endDateInput,
    perPage,
    setSearchInput,
    setStartDateInput,
    setEndDateInput,
    setPerPage,
    applyFilters,
    refresh: query.refetch,
    canGoPrev,
    canGoNext,
    goPrev: () => setPage((prev) => Math.max(1, prev - 1)),
    goNext: () => setPage((prev) => prev + 1),
  };
}
