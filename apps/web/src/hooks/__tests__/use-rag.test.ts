import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRAGQuery } from '../use-rag';

vi.mock('@web/lib/api', () => ({
  API: {
    ragQuery: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useRAGQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries RAG with provided parameters', async () => {
    const payload = {
      answer: '응답',
      contexts: [],
    };
    vi.mocked(API.ragQuery).mockResolvedValue(payload);

    const { result } = renderHookWithClient(() => useRAGQuery());

    await act(async () => {
      result.current.mutate({ query: '질문', scope: 'global' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.ragQuery).toHaveBeenCalledWith({ query: '질문', scope: 'global' });
    expect(result.current.data).toEqual(payload);
  });

  it('shows an error toast when query fails', async () => {
    vi.mocked(API.ragQuery).mockRejectedValue(new Error('RAG failed'));

    const { result } = renderHookWithClient(() => useRAGQuery());

    await act(async () => {
      result.current.mutate({ query: '실패', scope: 'global' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'RAG failed',
    });
  });
});
