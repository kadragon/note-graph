import { act } from '@testing-library/react';
import { API } from '@web/lib/api';
import { renderHookWithClient } from '@web/test/setup';
import type { AIGenerateDraftResponse } from '@web/types/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgentDraft } from '../use-agent-draft';

vi.mock('@web/lib/api', () => ({
  API: {
    generateAgentDraft: vi.fn(),
    generateAgentDraftFromPDF: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockResponse: AIGenerateDraftResponse = {
  draft: { title: 'AI 초안', content: '초안 내용', category: '일반', todos: [] },
  references: [],
};

describe('useAgentDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generate sets isPending during execution and resets after', async () => {
    vi.mocked(API.generateAgentDraft).mockResolvedValue(mockResponse);

    const { result } = renderHookWithClient(() => useAgentDraft());

    expect(result.current.isPending).toBe(false);

    let resolvedResult: unknown;
    await act(async () => {
      resolvedResult = await result.current.generate({
        inputText: 'test',
        category: '일반',
        personIds: [],
        deptName: '팀',
      });
    });

    expect(resolvedResult).toEqual(mockResponse);
    expect(result.current.isPending).toBe(false);
  });

  it('generate shows toast on error and returns null', async () => {
    vi.mocked(API.generateAgentDraft).mockRejectedValue(new Error('API failed'));

    const { result } = renderHookWithClient(() => useAgentDraft());

    let resolvedResult: unknown;
    await act(async () => {
      resolvedResult = await result.current.generate({
        inputText: 'test',
        category: '일반',
        personIds: [],
        deptName: '팀',
      });
    });

    expect(resolvedResult).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'API failed' })
    );
  });

  it('generateFromPDF sets isPending during execution and resets after', async () => {
    vi.mocked(API.generateAgentDraftFromPDF).mockResolvedValue(mockResponse);

    const { result } = renderHookWithClient(() => useAgentDraft());

    let resolvedResult: unknown;
    await act(async () => {
      resolvedResult = await result.current.generateFromPDF(new File(['pdf'], 'test.pdf'));
    });

    expect(resolvedResult).toEqual(mockResponse);
    expect(result.current.isPending).toBe(false);
  });

  it('generateFromPDF shows toast on error and returns null', async () => {
    vi.mocked(API.generateAgentDraftFromPDF).mockRejectedValue(new Error('PDF failed'));

    const { result } = renderHookWithClient(() => useAgentDraft());

    let resolvedResult: unknown;
    await act(async () => {
      resolvedResult = await result.current.generateFromPDF(new File(['pdf'], 'test.pdf'));
    });

    expect(resolvedResult).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', description: 'PDF failed' })
    );
  });

  it('reset clears progress and stops pending state', async () => {
    vi.mocked(API.generateAgentDraft).mockResolvedValue(mockResponse);

    const { result } = renderHookWithClient(() => useAgentDraft());

    await act(async () => {
      await result.current.generate({
        inputText: 'test',
        category: '일반',
        personIds: [],
        deptName: '팀',
      });
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.progress).toEqual([]);
  });
});
