import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGenerateDraftWithSimilar } from '../use-ai-draft';

vi.mock('@web/lib/api', () => ({
  API: {
    generateDraftWithSimilar: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useGenerateDraftWithSimilar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a draft with similar references', async () => {
    const payload = {
      draft: {
        title: 'AI 초안',
        content: '초안 내용',
        category: '일반',
        todos: [],
      },
      references: [],
    };
    vi.mocked(API.generateDraftWithSimilar).mockResolvedValue(payload);

    const { result } = renderHookWithClient(() => useGenerateDraftWithSimilar());

    await act(async () => {
      result.current.mutate({
        inputText: '입력 텍스트',
        category: '일반',
        personIds: ['P-001'],
        deptName: '개발팀',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.generateDraftWithSimilar).toHaveBeenCalledWith({
      inputText: '입력 텍스트',
      category: '일반',
      personIds: ['P-001'],
      deptName: '개발팀',
    });
    expect(result.current.data).toEqual(payload);
  });

  it('shows an error toast when generation fails', async () => {
    vi.mocked(API.generateDraftWithSimilar).mockRejectedValue(new Error('Draft failed'));

    const { result } = renderHookWithClient(() => useGenerateDraftWithSimilar());

    await act(async () => {
      result.current.mutate({ inputText: '실패' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Draft failed',
    });
  });
});
