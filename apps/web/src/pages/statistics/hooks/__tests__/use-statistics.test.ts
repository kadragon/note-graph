import { waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { renderHookWithClient } from '@web/test/setup';
import type { WorkNoteStatistics } from '@web/types/api';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStatistics } from '../use-statistics';

vi.mock('@web/lib/api', () => ({
  API: {
    getStatistics: vi.fn(),
  },
}));

const mockStatistics: WorkNoteStatistics = {
  summary: {
    totalWorkNotes: 10,
    totalCompletedTodos: 5,
    totalTodos: 8,
    completionRate: 62.5,
  },
  distributions: {
    byCategory: [],
    byPerson: [],
    byDepartment: [],
  },
  workNotes: [],
};

describe('useStatistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches statistics with default period', async () => {
    vi.mocked(API.getStatistics).mockResolvedValue(mockStatistics);

    const { result } = renderHookWithClient(() => useStatistics());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getStatistics).toHaveBeenCalledWith(
      expect.objectContaining({
        period: 'this-week',
        year: new Date().getFullYear(),
      })
    );
    expect(result.current.statistics).toEqual(mockStatistics);
  });

  it('fetches statistics with custom initial period', async () => {
    vi.mocked(API.getStatistics).mockResolvedValue(mockStatistics);

    const { result } = renderHookWithClient(() =>
      useStatistics({ initialPeriod: 'this-month', initialYear: 2025 })
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getStatistics).toHaveBeenCalledWith(
      expect.objectContaining({
        period: 'this-month',
        year: 2025,
      })
    );
  });

  it('refetches when period changes', async () => {
    vi.mocked(API.getStatistics).mockResolvedValue(mockStatistics);

    const { result } = renderHookWithClient(() => useStatistics());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    vi.clearAllMocks();

    act(() => {
      result.current.setPeriod('this-year');
    });

    await waitFor(() => {
      expect(API.getStatistics).toHaveBeenCalledWith(
        expect.objectContaining({
          period: 'this-year',
        })
      );
    });
  });

  it('refetches when year changes', async () => {
    vi.mocked(API.getStatistics).mockResolvedValue(mockStatistics);

    const { result } = renderHookWithClient(() => useStatistics());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    vi.clearAllMocks();

    act(() => {
      result.current.setYear(2024);
    });

    await waitFor(() => {
      expect(API.getStatistics).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
        })
      );
    });
  });

  it('handles API error', async () => {
    vi.mocked(API.getStatistics).mockRejectedValue(new Error('API Error'));

    const { result } = renderHookWithClient(() => useStatistics());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe('API Error');
  });

  it('exposes dateRange computed from period and year', async () => {
    vi.mocked(API.getStatistics).mockResolvedValue(mockStatistics);

    const { result } = renderHookWithClient(() => useStatistics());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.dateRange).toBeDefined();
    expect(result.current.dateRange.startDate).toBeDefined();
    expect(result.current.dateRange.endDate).toBeDefined();
  });

  it('exposes refetch function via React Query', async () => {
    vi.mocked(API.getStatistics).mockResolvedValue(mockStatistics);

    const { result } = renderHookWithClient(() => useStatistics());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(typeof result.current.refetch).toBe('function');
  });
});
