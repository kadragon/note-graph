import { describe, expect, it } from 'vitest';

import { formatDateTimeInKstOrFallback, formatDateTimeOrFallback } from './date-format';

describe('formatDateTimeOrFallback', () => {
  it('formats valid ISO datetime values', () => {
    expect(formatDateTimeOrFallback('2026-02-14T12:34:56', 'yyyy-MM-dd HH:mm:ss', '-')).toBe(
      '2026-02-14 12:34:56'
    );
  });

  it('returns fallback for invalid values', () => {
    expect(formatDateTimeOrFallback('invalid-value', 'yyyy-MM-dd HH:mm:ss', 'invalid-value')).toBe(
      'invalid-value'
    );
  });
});

describe('formatDateTimeInKstOrFallback', () => {
  it('formats valid ISO datetime values in KST', () => {
    expect(formatDateTimeInKstOrFallback('2026-02-14T00:05:00.000Z')).toBe('2026-02-14 09:05');
  });

  it('returns fallback for invalid values', () => {
    expect(formatDateTimeInKstOrFallback('not-a-date', '-')).toBe('-');
  });
});
