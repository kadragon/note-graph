// Trace: SPEC-worknote-2, TASK-025, SPEC-ui-1, TASK-034
// Tests for utility functions

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cn,
  formatDateToYYYYMMDD,
  formatDateWithYear,
  formatPersonBadge,
  formatPhoneExt,
  getDepartmentColor,
  preserveLineBreaksForMarkdown,
  toUTCISOString,
  truncateRoleDescription,
} from './utils';

describe('cn', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    const isDisabled = false;

    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('deduplicates tailwind classes', () => {
    // tailwind-merge should pick the last conflicting class
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    expect(cn('bg-white', 'bg-black')).toBe('bg-black');
  });
});

describe('formatDateWithYear', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'MM-dd' for current year dates", () => {
    vi.setSystemTime(new Date('2025-06-15'));

    expect(formatDateWithYear('2025-01-15T00:00:00.000Z')).toBe('01-15');
    expect(formatDateWithYear('2025-12-31T00:00:00.000Z')).toBe('12-31');
  });

  it("returns 'yyyy-MM-dd' for different year dates", () => {
    vi.setSystemTime(new Date('2025-06-15'));

    expect(formatDateWithYear('2024-12-25T00:00:00.000Z')).toBe('2024-12-25');
    expect(formatDateWithYear('2026-01-01T00:00:00.000Z')).toBe('2026-01-01');
    expect(formatDateWithYear('2020-03-15T00:00:00.000Z')).toBe('2020-03-15');
  });
});

describe('formatPersonBadge', () => {
  it("returns 'dept/position/name/id/phone' when all present", () => {
    const person = {
      name: '홍길동',
      currentDept: '개발팀',
      currentPosition: '팀장',
      personId: '111111',
      phoneExt: '043-123-4567',
    };

    expect(formatPersonBadge(person)).toBe('개발팀/팀장/홍길동/111111/043-123-4567');
  });

  it("returns 'dept/name/id' when no position and phone", () => {
    const person = {
      name: '김철수',
      currentDept: '기획팀',
      currentPosition: null,
      personId: '222222',
      phoneExt: null,
    };

    expect(formatPersonBadge(person)).toBe('기획팀/김철수/222222');
  });

  it("returns 'name/id/phone' when no dept", () => {
    const person = {
      name: '이영희',
      currentDept: null,
      currentPosition: null,
      personId: '333333',
      phoneExt: '043-987-6543',
    };

    expect(formatPersonBadge(person)).toBe('이영희/333333/043-987-6543');
  });

  it("returns 'name/id/phone' when position but no dept (position ignored)", () => {
    const person = {
      name: '박철수',
      currentDept: null,
      currentPosition: '팀장',
      personId: '444444',
      phoneExt: '043-555-0000',
    };

    expect(formatPersonBadge(person)).toBe('박철수/444444/043-555-0000');
  });

  it("returns 'dept/name' when personId is undefined (backward compat)", () => {
    const person = {
      name: '홍길동',
      currentDept: '개발팀',
      currentPosition: null,
    };

    expect(formatPersonBadge(person)).toBe('개발팀/홍길동');
  });

  it("returns 'name' when only name is provided (minimal input)", () => {
    const person = {
      name: '최민수',
    };

    expect(formatPersonBadge(person)).toBe('최민수');
  });

  it('strips 043-230- prefix from phoneExt', () => {
    const person = {
      name: '홍길동',
      personId: '111111',
      phoneExt: '043-230-3346',
    };

    expect(formatPersonBadge(person)).toBe('홍길동/111111/3346');
  });

  it('preserves non-matching phone prefixes', () => {
    const person = {
      name: '홍길동',
      personId: '111111',
      phoneExt: '043-123-4567',
    };

    expect(formatPersonBadge(person)).toBe('홍길동/111111/043-123-4567');
  });
});

describe('getDepartmentColor', () => {
  it('returns consistent color for same department', () => {
    const color1 = getDepartmentColor('개발팀');
    const color2 = getDepartmentColor('개발팀');
    const color3 = getDepartmentColor('개발팀');

    expect(color1).toBe(color2);
    expect(color2).toBe(color3);
  });

  it('returns different colors for different departments', () => {
    // Use department names known to produce different hash indices
    const engineeringColor = getDepartmentColor('Engineering');
    const hrColor = getDepartmentColor('HR');
    const marketingColor = getDepartmentColor('Marketing');

    // These specific names are verified to produce different colors
    expect(engineeringColor).not.toBe(hrColor);
    expect(hrColor).not.toBe(marketingColor);
    expect(engineeringColor).not.toBe(marketingColor);
  });

  it('returns valid Tailwind classes', () => {
    const color = getDepartmentColor('테스트팀');

    // Should contain bg-*, text-*, and hover:bg-* classes
    expect(color).toMatch(/bg-\w+-100/);
    expect(color).toMatch(/text-\w+-800/);
    expect(color).toMatch(/hover:bg-\w+-200/);
  });
});

describe('preserveLineBreaksForMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(preserveLineBreaksForMarkdown('')).toBe('');
  });

  it('preserves single line', () => {
    expect(preserveLineBreaksForMarkdown('Hello World')).toBe('Hello World');
  });

  it("converts newlines to '  \\n' for markdown", () => {
    const input = 'Line 1\nLine 2\nLine 3';
    const expected = 'Line 1  \nLine 2  \nLine 3';

    expect(preserveLineBreaksForMarkdown(input)).toBe(expected);
  });

  it('handles Windows-style line endings (\\r\\n)', () => {
    const input = 'Line 1\r\nLine 2\r\nLine 3';
    const expected = 'Line 1  \nLine 2  \nLine 3';

    expect(preserveLineBreaksForMarkdown(input)).toBe(expected);
  });
});

describe('formatPhoneExt', () => {
  it('strips 043-230- prefix from phone number', () => {
    expect(formatPhoneExt('043-230-3346')).toBe('3346');
  });

  it('returns full number when prefix does not match', () => {
    expect(formatPhoneExt('043-123-4567')).toBe('043-123-4567');
  });

  it('returns null for null input', () => {
    expect(formatPhoneExt(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(formatPhoneExt(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(formatPhoneExt('')).toBeNull();
  });
});

describe('toUTCISOString', () => {
  it('converts date to UTC ISO string', () => {
    const result = toUTCISOString('2025-12-01');

    expect(result).toBe('2025-12-01T00:00:00.000Z');
  });

  it('preserves the date correctly', () => {
    // Test various dates to ensure no timezone shifting
    expect(toUTCISOString('2025-01-01')).toBe('2025-01-01T00:00:00.000Z');
    expect(toUTCISOString('2025-06-15')).toBe('2025-06-15T00:00:00.000Z');
    expect(toUTCISOString('2025-12-31')).toBe('2025-12-31T00:00:00.000Z');
  });
});

describe('formatDateToYYYYMMDD', () => {
  it("formats ISO date strings to 'yyyy-MM-dd'", () => {
    expect(formatDateToYYYYMMDD('2026-02-09T12:42:11Z')).toBe('2026-02-09');
    expect(formatDateToYYYYMMDD('2025-01-01')).toBe('2025-01-01');
  });

  it("returns '-' for invalid date strings", () => {
    expect(formatDateToYYYYMMDD('')).toBe('-');
    expect(formatDateToYYYYMMDD('not-a-date')).toBe('-');
  });
});

describe('truncateRoleDescription', () => {
  it('returns input as-is when length is 20 or less', () => {
    expect(truncateRoleDescription('12345678901234567890')).toBe('12345678901234567890');
    expect(truncateRoleDescription('짧은 설명')).toBe('짧은 설명');
  });

  it("truncates input longer than 20 chars with '...'", () => {
    expect(truncateRoleDescription('12345678901234567890가나다')).toBe('12345678901234567890...');
  });
});
