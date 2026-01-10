import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { createTaskCategory, resetFactoryCounter } from '@web/test/factories';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useCreateTaskCategory,
  useDeleteTaskCategory,
  useTaskCategories,
  useUpdateTaskCategory,
} from '../use-task-categories';

vi.mock('@web/lib/api', () => ({
  API: {
    getTaskCategories: vi.fn(),
    createTaskCategory: vi.fn(),
    updateTaskCategory: vi.fn(),
    deleteTaskCategory: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useTaskCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches task categories', async () => {
    const categories = [createTaskCategory({ name: '회의' })];
    vi.mocked(API.getTaskCategories).mockResolvedValue(categories);

    const { result } = renderHookWithClient(() => useTaskCategories());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getTaskCategories).toHaveBeenCalledWith();
    expect(result.current.data).toEqual(categories);
  });

  it('creates a task category and invalidates queries', async () => {
    const category = createTaskCategory({ name: '검토' });
    vi.mocked(API.createTaskCategory).mockResolvedValue(category);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useCreateTaskCategory(), { queryClient });

    await act(async () => {
      result.current.mutate({ name: '검토' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.createTaskCategory).toHaveBeenCalledWith({ name: '검토' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['taskCategories'] });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무 구분이 생성되었습니다.',
    });
  });

  it('updates a task category and invalidates queries', async () => {
    const category = createTaskCategory({ categoryId: 'cat-1', name: '수정' });
    vi.mocked(API.updateTaskCategory).mockResolvedValue(category);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useUpdateTaskCategory(), { queryClient });

    await act(async () => {
      result.current.mutate({ categoryId: 'cat-1', data: { name: '수정' } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.updateTaskCategory).toHaveBeenCalledWith('cat-1', { name: '수정' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['taskCategories'] });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무 구분이 수정되었습니다.',
    });
  });

  it('deletes a task category and invalidates queries', async () => {
    vi.mocked(API.deleteTaskCategory).mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useDeleteTaskCategory(), { queryClient });

    await act(async () => {
      result.current.mutate('cat-2');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.deleteTaskCategory).toHaveBeenCalledWith('cat-2');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['taskCategories'] });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '업무 구분이 삭제되었습니다.',
    });
  });

  it('shows an error toast when creation fails', async () => {
    vi.mocked(API.createTaskCategory).mockRejectedValue(new Error('Create failed'));

    const { result } = renderHookWithClient(() => useCreateTaskCategory());

    await act(async () => {
      result.current.mutate({ name: '실패' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Create failed',
    });
  });
});
