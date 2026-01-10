// Trace: SPEC-stats-1, TASK-048
// Tests for date-utils: statistics period ranges and formatting

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatDateRange,
  getAvailableYears,
  getStatisticsPeriodLabel,
  getStatisticsPeriodRange,
} from './date-utils';

describe('getStatisticsPeriodRange', () => {
  beforeEach(() => {
    // Set a fixed date: Wednesday, 2025-03-12
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 12)); // March 12, 2025
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns correct range for 'this-week' (Monday to Sunday)", () => {
    const result = getStatisticsPeriodRange('this-week');

    // March 12, 2025 is a Wednesday
    // Week starts on Monday (March 10) and ends on Sunday (March 16)
    expect(result).toEqual({
      startDate: '2025-03-10',
      endDate: '2025-03-16',
    });
  });

  it("returns correct range for 'this-month'", () => {
    const result = getStatisticsPeriodRange('this-month');

    expect(result).toEqual({
      startDate: '2025-03-01',
      endDate: '2025-03-31',
    });
  });

  it("returns correct range for 'first-half' (Jan 1 to Jun 30)", () => {
    const result = getStatisticsPeriodRange('first-half');

    expect(result).toEqual({
      startDate: '2025-01-01',
      endDate: '2025-06-30',
    });
  });

  it("returns correct range for 'first-half' with specific year", () => {
    const result = getStatisticsPeriodRange('first-half', 2024);

    expect(result).toEqual({
      startDate: '2024-01-01',
      endDate: '2024-06-30',
    });
  });

  it("returns correct range for 'second-half' (Jul 1 to Dec 31)", () => {
    const result = getStatisticsPeriodRange('second-half');

    expect(result).toEqual({
      startDate: '2025-07-01',
      endDate: '2025-12-31',
    });
  });

  it("returns correct range for 'second-half' with specific year", () => {
    const result = getStatisticsPeriodRange('second-half', 2024);

    expect(result).toEqual({
      startDate: '2024-07-01',
      endDate: '2024-12-31',
    });
  });

  it("returns correct range for 'this-year'", () => {
    const result = getStatisticsPeriodRange('this-year');

    expect(result).toEqual({
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    });
  });

  it("returns correct range for 'this-year' with specific year", () => {
    const result = getStatisticsPeriodRange('this-year', 2024);

    expect(result).toEqual({
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    });
  });

  it("returns correct range for 'last-week'", () => {
    const result = getStatisticsPeriodRange('last-week');

    // Current date is March 12, 2025 (Wednesday)
    // Last week: Monday March 3 to Sunday March 9
    expect(result).toEqual({
      startDate: '2025-03-03',
      endDate: '2025-03-09',
    });
  });

  it("returns today for 'custom'", () => {
    const result = getStatisticsPeriodRange('custom');

    expect(result).toEqual({
      startDate: '2025-03-12',
      endDate: '2025-03-12',
    });
  });

  it('throws error for unknown period', () => {
    expect(() => {
      // @ts-expect-error Testing invalid input
      getStatisticsPeriodRange('invalid-period');
    }).toThrow('Unknown period: invalid-period');
  });
});

describe('getStatisticsPeriodLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 12)); // March 12, 2025
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns '이번주' for 'this-week'", () => {
    const result = getStatisticsPeriodLabel('this-week');
    expect(result).toBe('이번주');
  });

  it("returns '이번달' for 'this-month'", () => {
    const result = getStatisticsPeriodLabel('this-month');
    expect(result).toBe('이번달');
  });

  it("returns '2025년 1~6월' for 'first-half' with year 2025", () => {
    const result = getStatisticsPeriodLabel('first-half', 2025);
    expect(result).toBe('2025년 1~6월');
  });

  it("returns '2024년 1~6월' for 'first-half' with year 2024", () => {
    const result = getStatisticsPeriodLabel('first-half', 2024);
    expect(result).toBe('2024년 1~6월');
  });

  it("returns '2025년 7~12월' for 'second-half' with current year", () => {
    const result = getStatisticsPeriodLabel('second-half');
    expect(result).toBe('2025년 7~12월');
  });

  it("returns '2025년 올해' for 'this-year'", () => {
    const result = getStatisticsPeriodLabel('this-year');
    expect(result).toBe('2025년 올해');
  });

  it("returns '직전주' for 'last-week'", () => {
    const result = getStatisticsPeriodLabel('last-week');
    expect(result).toBe('직전주');
  });

  it("returns '직접 입력' for 'custom'", () => {
    const result = getStatisticsPeriodLabel('custom');
    expect(result).toBe('직접 입력');
  });
});

describe('formatDateRange', () => {
  it("formats date range as 'yyyy.MM.dd - yyyy.MM.dd'", () => {
    const result = formatDateRange('2025-01-01', '2025-06-30');
    expect(result).toBe('2025.01.01 - 2025.06.30');
  });

  it('formats same-day range correctly', () => {
    const result = formatDateRange('2025-03-12', '2025-03-12');
    expect(result).toBe('2025.03.12 - 2025.03.12');
  });

  it('formats range across different years', () => {
    const result = formatDateRange('2024-12-25', '2025-01-05');
    expect(result).toBe('2024.12.25 - 2025.01.05');
  });
});

describe('getAvailableYears', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns array from current year down to 2024', () => {
    vi.setSystemTime(new Date(2025, 2, 12)); // March 12, 2025

    const result = getAvailableYears();

    expect(result).toEqual([2025, 2024]);
  });

  it('returns in descending order', () => {
    vi.setSystemTime(new Date(2027, 5, 15)); // June 15, 2027

    const result = getAvailableYears();

    expect(result).toEqual([2027, 2026, 2025, 2024]);
    // Verify descending order
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i]).toBeGreaterThan(result[i + 1]);
    }
  });

  it('returns only 2024 when current year is 2024', () => {
    vi.setSystemTime(new Date(2024, 0, 1)); // January 1, 2024

    const result = getAvailableYears();

    expect(result).toEqual([2024]);
  });
});
