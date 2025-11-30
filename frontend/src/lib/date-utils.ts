// Trace: SPEC-stats-1, TASK-048
/**
 * Date calculation utilities for statistics period boundaries
 */

import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subWeeks,
  format,
} from 'date-fns';
import { ko } from 'date-fns/locale';

export type StatisticsPeriod =
  | 'this-week'
  | 'this-month'
  | 'first-half'
  | 'second-half'
  | 'this-year'
  | 'last-week';

export interface DateRange {
  startDate: string; // ISO 8601 date string (YYYY-MM-DD)
  endDate: string; // ISO 8601 date string (YYYY-MM-DD)
}

/**
 * Get the date range for a specific statistics period
 * @param period - The period type
 * @param year - Optional year for first-half/second-half periods (defaults to current year)
 * @returns Object with startDate and endDate in YYYY-MM-DD format
 */
export function getStatisticsPeriodRange(
  period: StatisticsPeriod,
  year?: number
): DateRange {
  const now = new Date();
  const targetYear = year ?? now.getFullYear();

  switch (period) {
    case 'this-week': {
      // Current week (Monday to Sunday)
      const start = startOfWeek(now, { weekStartsOn: 1 }); // 1 = Monday
      const end = endOfWeek(now, { weekStartsOn: 1 });
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      };
    }

    case 'this-month': {
      // Current month
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      };
    }

    case 'first-half': {
      // January 1 to June 30 of target year
      const start = new Date(targetYear, 0, 1); // Jan 1
      const end = new Date(targetYear, 5, 30); // Jun 30
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      };
    }

    case 'second-half': {
      // July 1 to December 31 of target year
      const start = new Date(targetYear, 6, 1); // Jul 1
      const end = new Date(targetYear, 11, 31); // Dec 31
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      };
    }

    case 'this-year': {
      // Current year
      const start = startOfYear(now);
      const end = endOfYear(now);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      };
    }

    case 'last-week': {
      // Previous week (Monday to Sunday of last complete week)
      const lastWeekDate = subWeeks(now, 1);
      const start = startOfWeek(lastWeekDate, { weekStartsOn: 1 });
      const end = endOfWeek(lastWeekDate, { weekStartsOn: 1 });
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      };
    }

    default:
      throw new Error(`Unknown period: ${period}`);
  }
}

/**
 * Get human-readable label for a statistics period
 */
export function getStatisticsPeriodLabel(
  period: StatisticsPeriod,
  year?: number
): string {
  const targetYear = year ?? new Date().getFullYear();

  const labels: Record<StatisticsPeriod, string> = {
    'this-week': '이번주',
    'this-month': '이번달',
    'first-half': `${targetYear}년 1~6월`,
    'second-half': `${targetYear}년 7~12월`,
    'this-year': `${targetYear}년 올해`,
    'last-week': '직전주',
  };

  return labels[period];
}

/**
 * Format date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return `${format(start, 'yyyy.MM.dd', { locale: ko })} - ${format(end, 'yyyy.MM.dd', { locale: ko })}`;
}

/**
 * Get available years for the year selector
 * Returns array of years from 2024 to current year
 */
export function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear();
  const startYear = 2024;
  const years: number[] = [];

  for (let year = currentYear; year >= startYear; year--) {
    years.push(year);
  }

  return years;
}
