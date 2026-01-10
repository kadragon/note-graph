import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSearch } from '../use-search';

vi.mock('@web/lib/api', () => ({
  API: {
    search: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches with the provided query', async () => {
    const payload = {
      workNotes: [],
      persons: [],
      departments: [],
      query: '테스트',
    };
    vi.mocked(API.search).mockResolvedValue(payload);

    const { result } = renderHookWithClient(() => useSearch());

    await act(async () => {
      result.current.mutate({ query: '테스트' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.search).toHaveBeenCalledWith({ query: '테스트' });
    expect(result.current.data).toEqual(payload);
  });

  it('shows an error toast when search fails', async () => {
    vi.mocked(API.search).mockRejectedValue(new Error('Search failed'));

    const { result } = renderHookWithClient(() => useSearch());

    await act(async () => {
      result.current.mutate({ query: '실패' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Search failed',
    });
  });
});
