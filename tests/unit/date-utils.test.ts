import { getTodayDateForOffset, getTodayDateUTC } from '@worker/utils/date';
import { afterEach, describe, expect, it } from 'vitest';
import { restoreDate, useFixedDateAt } from '../helpers/mock-date';

afterEach(() => {
  restoreDate();
});

describe('getTodayDateForOffset', () => {
  it('returns KST date when offset is 540', () => {
    // UTC 2025-01-10T23:30:00Z = KST 2025-01-11T08:30:00
    useFixedDateAt('2025-01-10T23:30:00.000Z');
    expect(getTodayDateForOffset(540)).toBe('2025-01-11');
  });

  it('returns UTC date when offset is 0', () => {
    useFixedDateAt('2025-01-10T23:30:00.000Z');
    expect(getTodayDateForOffset(0)).toBe('2025-01-10');
  });

  it('defaults to KST (540) when no offset is given', () => {
    // UTC 2025-01-10T16:00:00Z = KST 2025-01-11T01:00:00
    useFixedDateAt('2025-01-10T16:00:00.000Z');
    expect(getTodayDateForOffset()).toBe('2025-01-11');
  });

  it('handles KST midnight boundary exactly (UTC 15:00 = KST 00:00)', () => {
    useFixedDateAt('2025-01-10T15:00:00.000Z');
    expect(getTodayDateForOffset(540)).toBe('2025-01-11');
  });

  it('handles just before KST midnight (UTC 14:59 = KST 23:59)', () => {
    useFixedDateAt('2025-01-10T14:59:00.000Z');
    expect(getTodayDateForOffset(540)).toBe('2025-01-10');
  });
});

describe('getTodayDateUTC (deprecated)', () => {
  it('returns UTC date (equivalent to offset=0)', () => {
    useFixedDateAt('2025-01-10T23:30:00.000Z');
    expect(getTodayDateUTC()).toBe('2025-01-10');
  });
});
