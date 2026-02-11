import { act, waitFor } from '@testing-library/react';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createStandardMutation } from '../create-standard-mutation';

const mockToast = vi.fn();
vi.mock('@web/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('createStandardMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a mutation hook that calls mutationFn with provided data', async () => {
    const mockMutationFn = vi.fn().mockResolvedValue({ id: '1', name: 'Test' });

    const useTestMutation = createStandardMutation({
      mutationFn: mockMutationFn,
      invalidateKeys: [['test-items']],
      messages: {
        success: '항목이 추가되었습니다.',
        error: '항목을 추가할 수 없습니다.',
      },
    });

    const { result } = renderHookWithClient(() => useTestMutation());

    await act(async () => {
      result.current.mutate({ name: 'Test' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockMutationFn).toHaveBeenCalledWith({ name: 'Test' }, expect.anything());
  });

  it('invalidates specified query keys on success', async () => {
    const mockMutationFn = vi.fn().mockResolvedValue({ id: '1' });

    const useTestMutation = createStandardMutation({
      mutationFn: mockMutationFn,
      invalidateKeys: [['items'], ['related-items']],
      messages: {
        success: '성공',
        error: '오류',
      },
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useTestMutation(), { queryClient });

    await act(async () => {
      result.current.mutate({ name: 'Test' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['related-items'] });
  });

  it('shows success toast on successful mutation', async () => {
    const mockMutationFn = vi.fn().mockResolvedValue({ id: '1' });

    const useTestMutation = createStandardMutation({
      mutationFn: mockMutationFn,
      invalidateKeys: [['items']],
      messages: {
        success: '항목이 추가되었습니다.',
        error: '항목을 추가할 수 없습니다.',
      },
    });

    const { result } = renderHookWithClient(() => useTestMutation());

    await act(async () => {
      result.current.mutate({ name: 'Test' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '항목이 추가되었습니다.',
    });
  });

  it('shows error toast on failed mutation', async () => {
    const mockMutationFn = vi.fn().mockRejectedValue(new Error('API Error'));

    const useTestMutation = createStandardMutation({
      mutationFn: mockMutationFn,
      invalidateKeys: [['items']],
      messages: {
        success: '성공',
        error: '항목을 추가할 수 없습니다.',
      },
    });

    const { result } = renderHookWithClient(() => useTestMutation());

    await act(async () => {
      result.current.mutate({ name: 'Test' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'API Error',
    });
  });

  it('uses fallback error message when error has no message', async () => {
    const mockMutationFn = vi.fn().mockRejectedValue(new Error());

    const useTestMutation = createStandardMutation({
      mutationFn: mockMutationFn,
      invalidateKeys: [['items']],
      messages: {
        success: '성공',
        error: '기본 오류 메시지',
      },
    });

    const { result } = renderHookWithClient(() => useTestMutation());

    await act(async () => {
      result.current.mutate({ name: 'Test' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: '기본 오류 메시지',
    });
  });

  it('returns mutation data on success', async () => {
    const responseData = { id: '123', name: 'Created Item' };
    const mockMutationFn = vi.fn().mockResolvedValue(responseData);

    const useTestMutation = createStandardMutation({
      mutationFn: mockMutationFn,
      invalidateKeys: [['items']],
      messages: {
        success: '성공',
        error: '오류',
      },
    });

    const { result } = renderHookWithClient(() => useTestMutation());

    await act(async () => {
      result.current.mutate({ name: 'Test' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(responseData);
  });

  it('supports dynamic invalidateKeys derived from variables', async () => {
    const mockMutationFn = vi.fn().mockResolvedValue({ id: '1' });

    const useTestMutation = createStandardMutation({
      mutationFn: mockMutationFn,
      invalidateKeys: (_data, variables: { itemId: string }) => [
        ['items'],
        ['item', variables.itemId],
      ],
      messages: {
        success: '성공',
        error: '오류',
      },
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useTestMutation(), { queryClient });

    await act(async () => {
      result.current.mutate({ itemId: 'item-123' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['items'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['item', 'item-123'] });
  });

  it('works with empty invalidateKeys array', async () => {
    const mockMutationFn = vi.fn().mockResolvedValue({ id: '1' });

    const useTestMutation = createStandardMutation({
      mutationFn: mockMutationFn,
      invalidateKeys: [],
      messages: {
        success: '성공',
        error: '오류',
      },
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useTestMutation(), { queryClient });

    await act(async () => {
      result.current.mutate({ name: 'Test' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '성공',
    });
  });
});
