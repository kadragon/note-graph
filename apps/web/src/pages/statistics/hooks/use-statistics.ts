// Trace: SPEC-stats-1, TASK-048
/**
 * Hook for managing statistics data and filters
 */

import { useQuery } from '@tanstack/react-query';
import { API } from '@web/lib/api';
import { type DateRange, getStatisticsPeriodRange } from '@web/lib/date-utils';
import type { StatisticsPeriod } from '@web/types/api';
import { useMemo, useState } from 'react';

interface UseStatisticsOptions {
  initialPeriod?: StatisticsPeriod;
  initialYear?: number;
}

export function useStatistics(options: UseStatisticsOptions = {}) {
  const [period, setPeriod] = useState<StatisticsPeriod>(options.initialPeriod || 'this-week');
  const [year, setYear] = useState<number>(options.initialYear || new Date().getFullYear());

  const dateRange: DateRange = useMemo(
    () => getStatisticsPeriodRange(period, year),
    [period, year]
  );

  const query = useQuery({
    queryKey: ['statistics', period, year],
    queryFn: async () => {
      const data = await API.getStatistics({ period, year });
      return data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Map error to string for backward compatibility
  // Log full error for debugging (message may not contain all details)
  if (query.error) {
    console.error('Failed to fetch statistics:', query.error);
  }
  const error = query.error instanceof Error ? query.error.message : null;

  return {
    period,
    setPeriod,
    year,
    setYear,
    dateRange,
    statistics: query.data ?? null,
    isLoading: query.isLoading,
    error,
    refetch: query.refetch,
    // Expose React Query states for advanced usage
    isSuccess: query.isSuccess,
    isError: query.isError,
  };
}
