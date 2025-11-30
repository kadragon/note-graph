// Trace: SPEC-stats-1, TASK-048
/**
 * Hook for managing statistics data and filters
 */

import { useCallback, useEffect, useState } from 'react';
import { API } from '@/lib/api';
import { type DateRange, getStatisticsPeriodRange } from '@/lib/date-utils';
import type { StatisticsPeriod, WorkNoteStatistics } from '@/types/api';

interface UseStatisticsOptions {
  initialPeriod?: StatisticsPeriod;
  initialYear?: number;
}

export function useStatistics(options: UseStatisticsOptions = {}) {
  const [period, setPeriod] = useState<StatisticsPeriod>(options.initialPeriod || 'this-week');
  const [year, setYear] = useState<number>(options.initialYear || new Date().getFullYear());
  const [dateRange, setDateRange] = useState<DateRange>(() =>
    getStatisticsPeriodRange(period, year)
  );

  const [statistics, setStatistics] = useState<WorkNoteStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update date range when period or year changes
  useEffect(() => {
    const range = getStatisticsPeriodRange(period, year);
    setDateRange(range);
  }, [period, year]);

  // Fetch statistics
  const fetchStatistics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await API.getStatistics({
        period,
        year,
      });
      setStatistics(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '통계를 불러오는데 실패했습니다';
      setError(message);
      console.error('Failed to fetch statistics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [period, year]);

  // Fetch on mount and when filters change
  useEffect(() => {
    void fetchStatistics();
  }, [fetchStatistics]);

  return {
    period,
    setPeriod,
    year,
    setYear,
    dateRange,
    statistics,
    isLoading,
    error,
    refetch: fetchStatistics,
  };
}
