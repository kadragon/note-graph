// Trace: SPEC-stats-1, TASK-049, TEST-stats-3
/**
 * Unit tests for frontend date calculation utilities
 * Tests period boundary calculations for statistics dashboard
 *
 * Note: These tests use behavioral assertions instead of fixed dates
 * because vi.setSystemTime doesn't work in Cloudflare Workers test environment
 */

import {
  formatDateRange,
  getAvailableYears,
  getStatisticsPeriodLabel,
  getStatisticsPeriodRange,
  type StatisticsPeriod,
} from '@web/lib/date-utils';
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subWeeks,
} from 'date-fns';
import { describe, expect, it } from 'vitest';

describe('Date Utils - getStatisticsPeriodRange', () => {
  describe('this-week period', () => {
    it('should return current week Monday to Sunday', () => {
      // Act
      const result = getStatisticsPeriodRange('this-week');

      // Assert - Should return Monday to Sunday of current week
      const now = new Date();
      const expectedStart = startOfWeek(now, { weekStartsOn: 1 });
      const expectedEnd = endOfWeek(now, { weekStartsOn: 1 });

      const startDate = new Date(result.startDate);
      const endDate = new Date(result.endDate);

      // Verify it's a 7-day range (Monday to Sunday)
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBe(6); // Monday to Sunday is 6 days difference

      // Verify start is Monday (day 1)
      expect(startDate.getDay()).toBe(1);

      // Verify end is Sunday (day 0)
      expect(endDate.getDay()).toBe(0);

      // Verify dates match expected week
      expect(startDate.toDateString()).toBe(expectedStart.toDateString());
      expect(endDate.toDateString()).toBe(expectedEnd.toDateString());
    });
  });

  describe('this-month period', () => {
    it('should return current month first to last day', () => {
      // Act
      const result = getStatisticsPeriodRange('this-month');

      // Assert
      const now = new Date();
      const expectedStart = startOfMonth(now);
      const expectedEnd = endOfMonth(now);

      const startDate = new Date(result.startDate);
      const endDate = new Date(result.endDate);

      // Verify start is first day of month
      expect(startDate.getDate()).toBe(1);

      // Verify end is last day of month
      expect(endDate.toDateString()).toBe(expectedEnd.toDateString());

      // Verify dates match expected month
      expect(startDate.toDateString()).toBe(expectedStart.toDateString());
    });
  });

  describe('first-half period', () => {
    it('should return January 1 to June 30 of current year by default', () => {
      // Act
      const result = getStatisticsPeriodRange('first-half');

      // Assert
      const currentYear = new Date().getFullYear();
      expect(result.startDate).toBe(`${currentYear}-01-01`);
      expect(result.endDate).toBe(`${currentYear}-06-30`);
    });

    it('should return January 1 to June 30 of specified year', () => {
      // Act
      const result = getStatisticsPeriodRange('first-half', 2024);

      // Assert
      expect(result.startDate).toBe('2024-01-01');
      expect(result.endDate).toBe('2024-06-30');
    });

    it('should work for future years', () => {
      // Act
      const result = getStatisticsPeriodRange('first-half', 2026);

      // Assert
      expect(result.startDate).toBe('2026-01-01');
      expect(result.endDate).toBe('2026-06-30');
    });
  });

  describe('second-half period', () => {
    it('should return July 1 to December 31 of current year by default', () => {
      // Act
      const result = getStatisticsPeriodRange('second-half');

      // Assert
      const currentYear = new Date().getFullYear();
      expect(result.startDate).toBe(`${currentYear}-07-01`);
      expect(result.endDate).toBe(`${currentYear}-12-31`);
    });

    it('should return July 1 to December 31 of specified year', () => {
      // Act
      const result = getStatisticsPeriodRange('second-half', 2024);

      // Assert
      expect(result.startDate).toBe('2024-07-01');
      expect(result.endDate).toBe('2024-12-31');
    });
  });

  describe('this-year period', () => {
    it('should return January 1 to December 31 of current year', () => {
      // Act
      const result = getStatisticsPeriodRange('this-year');

      // Assert
      const now = new Date();
      const expectedStart = startOfYear(now);
      const expectedEnd = endOfYear(now);

      const startDate = new Date(result.startDate);
      const endDate = new Date(result.endDate);

      expect(startDate.toDateString()).toBe(expectedStart.toDateString());
      expect(endDate.toDateString()).toBe(expectedEnd.toDateString());
    });
  });

  describe('last-week period (TEST-stats-3)', () => {
    it('should return previous complete week Monday to Sunday', () => {
      // Act
      const result = getStatisticsPeriodRange('last-week');

      // Assert
      const now = new Date();
      const lastWeekDate = subWeeks(now, 1);
      const expectedStart = startOfWeek(lastWeekDate, { weekStartsOn: 1 });
      const expectedEnd = endOfWeek(lastWeekDate, { weekStartsOn: 1 });

      const startDate = new Date(result.startDate);
      const endDate = new Date(result.endDate);

      // Verify it's a 7-day range (Monday to Sunday)
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBe(6); // Monday to Sunday is 6 days difference

      // Verify start is Monday (day 1)
      expect(startDate.getDay()).toBe(1);

      // Verify end is Sunday (day 0)
      expect(endDate.getDay()).toBe(0);

      // Verify dates match expected last week
      expect(startDate.toDateString()).toBe(expectedStart.toDateString());
      expect(endDate.toDateString()).toBe(expectedEnd.toDateString());

      // Verify it's in the past
      expect(endDate.getTime()).toBeLessThan(now.getTime());
    });

    it('should always return complete week regardless of current day', () => {
      // Act
      const result = getStatisticsPeriodRange('last-week');

      // Assert
      const startDate = new Date(result.startDate);
      const endDate = new Date(result.endDate);

      // Monday to Sunday
      expect(startDate.getDay()).toBe(1);
      expect(endDate.getDay()).toBe(0);

      // Exactly 7 days
      const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBe(6);
    });
  });

  it('should throw error for unknown period', () => {
    // Act & Assert
    expect(() => {
      getStatisticsPeriodRange('invalid-period' as StatisticsPeriod);
    }).toThrow('Unknown period: invalid-period');
  });
});

describe('Date Utils - getStatisticsPeriodLabel', () => {
  it('should return Korean labels for all periods', () => {
    const currentYear = new Date().getFullYear();

    expect(getStatisticsPeriodLabel('this-week')).toBe('이번주');
    expect(getStatisticsPeriodLabel('this-month')).toBe('이번달');
    expect(getStatisticsPeriodLabel('this-year')).toBe(`${currentYear}년 올해`);
    expect(getStatisticsPeriodLabel('last-week')).toBe('직전주');
  });

  it('should include year for half-year periods', () => {
    const currentYear = new Date().getFullYear();

    expect(getStatisticsPeriodLabel('first-half')).toBe(`${currentYear}년 1~6월`);
    expect(getStatisticsPeriodLabel('second-half')).toBe(`${currentYear}년 7~12월`);
  });

  it('should use specified year for half-year periods', () => {
    expect(getStatisticsPeriodLabel('first-half', 2024)).toBe('2024년 1~6월');
    expect(getStatisticsPeriodLabel('second-half', 2024)).toBe('2024년 7~12월');
  });
});

describe('Date Utils - formatDateRange', () => {
  it('should format date range in Korean format', () => {
    // Act
    const result = formatDateRange('2025-01-01', '2025-12-31');

    // Assert
    expect(result).toBe('2025.01.01 - 2025.12.31');
  });

  it('should handle same start and end date', () => {
    // Act
    const result = formatDateRange('2025-11-30', '2025-11-30');

    // Assert
    expect(result).toBe('2025.11.30 - 2025.11.30');
  });

  it('should handle cross-year ranges', () => {
    // Act
    const result = formatDateRange('2024-12-25', '2025-01-05');

    // Assert
    expect(result).toBe('2024.12.25 - 2025.01.05');
  });
});

describe('Date Utils - getAvailableYears', () => {
  it('should return years from current year down to 2024', () => {
    // Act
    const years = getAvailableYears();

    // Assert
    const currentYear = new Date().getFullYear();
    expect(years[0]).toBe(currentYear);
    expect(years[years.length - 1]).toBe(2024);
  });

  it('should return years in descending order', () => {
    // Act
    const years = getAvailableYears();

    // Assert
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i]).toBeGreaterThan(years[i + 1]);
    }
  });

  it('should include all years between current and 2024', () => {
    // Act
    const years = getAvailableYears();

    // Assert
    const currentYear = new Date().getFullYear();
    const expectedLength = currentYear - 2024 + 1;
    expect(years.length).toBe(expectedLength);
  });
});
