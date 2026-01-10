import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from '../use-debounced-value';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('initial', 100));

    expect(result.current).toBe('initial');
  });

  it('updates after the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
      initialProps: { value: 'first' },
    });

    rerender({ value: 'second' });

    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('second');
  });

  it('cancels the previous timer on rapid changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
      initialProps: { value: 'start' },
    });

    rerender({ value: 'next' });
    rerender({ value: 'final' });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('final');
  });
});
