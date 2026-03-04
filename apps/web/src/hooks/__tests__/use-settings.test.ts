import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import type { AppSetting } from '@web/types/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpenAIModels, useResetSetting, useSettings, useUpdateSetting } from '../use-settings';

vi.mock('@web/lib/api', () => ({
  API: {
    getSettings: vi.fn(),
    updateSetting: vi.fn(),
    resetSetting: vi.fn(),
    getOpenAIModels: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const makeSetting = (overrides: Partial<AppSetting> = {}): AppSetting => ({
  key: 'test.key',
  value: 'test-value',
  category: 'config',
  label: 'Test',
  description: null,
  defaultValue: 'test-value',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches settings', async () => {
    const settings = [makeSetting()];
    vi.mocked(API.getSettings).mockResolvedValue(settings);

    const { result } = renderHookWithClient(() => useSettings());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getSettings).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual(settings);
  });

  it('fetches settings with category filter', async () => {
    vi.mocked(API.getSettings).mockResolvedValue([]);

    renderHookWithClient(() => useSettings('prompt'));

    await waitFor(() => {
      expect(API.getSettings).toHaveBeenCalledWith('prompt');
    });
  });
});

describe('useUpdateSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates setting and shows success toast', async () => {
    const updated = makeSetting({ value: 'new-value' });
    vi.mocked(API.updateSetting).mockResolvedValue(updated);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useUpdateSetting(), { queryClient });

    await act(async () => {
      result.current.mutate({ key: 'test.key', value: 'new-value' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.updateSetting).toHaveBeenCalledWith('test.key', { value: 'new-value' });
    expect(invalidateSpy).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '설정이 저장되었습니다.',
    });
  });

  it('shows error toast on failure', async () => {
    vi.mocked(API.updateSetting).mockRejectedValue(new Error('Update failed'));

    const { result } = renderHookWithClient(() => useUpdateSetting());

    await act(async () => {
      result.current.mutate({ key: 'test.key', value: 'fail' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Update failed',
    });
  });
});

describe('useResetSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets setting and shows success toast', async () => {
    const reset = makeSetting({ value: 'default' });
    vi.mocked(API.resetSetting).mockResolvedValue(reset);

    const queryClient = createTestQueryClient();
    const { result } = renderHookWithClient(() => useResetSetting(), { queryClient });

    await act(async () => {
      result.current.mutate('test.key');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.resetSetting).toHaveBeenCalledWith('test.key');
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '기본값으로 초기화되었습니다.',
    });
  });
});

describe('useOpenAIModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches OpenAI models', async () => {
    const models = [
      { id: 'gpt-4', owned_by: 'openai' },
      { id: 'gpt-5-mini', owned_by: 'openai' },
    ];
    vi.mocked(API.getOpenAIModels).mockResolvedValue(models);

    const { result } = renderHookWithClient(() => useOpenAIModels());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getOpenAIModels).toHaveBeenCalled();
    expect(result.current.data).toEqual(models);
  });
});
