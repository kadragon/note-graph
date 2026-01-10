import { act, waitFor } from '@testing-library/react';
import { API } from '@web/lib/api';
import { createTodo, resetFactoryCounter } from '@web/test/factories';
import { createTestQueryClient, renderHookWithClient } from '@web/test/setup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeleteTodo, useTodos, useToggleTodo, useUpdateTodo } from '../use-todos';

vi.mock('@web/lib/api', () => ({
  API: {
    getTodos: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('../use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe('useTodos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('fetches todos with default view', async () => {
    const mockTodos = [createTodo({ title: 'Todo 1' }), createTodo({ title: 'Todo 2' })];
    vi.mocked(API.getTodos).mockResolvedValue(mockTodos);

    const { result } = renderHookWithClient(() => useTodos());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getTodos).toHaveBeenCalledWith('today', undefined);
    expect(result.current.data).toEqual(mockTodos);
  });

  it('fetches todos with specified view and year', async () => {
    const mockTodos = [createTodo({ title: 'Archive Todo' })];
    vi.mocked(API.getTodos).mockResolvedValue(mockTodos);

    const { result } = renderHookWithClient(() => useTodos('completed', 2024));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.getTodos).toHaveBeenCalledWith('completed', 2024);
    expect(result.current.data).toEqual(mockTodos);
  });

  it('returns loading state initially', () => {
    vi.mocked(API.getTodos).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const { result } = renderHookWithClient(() => useTodos());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('returns error state on API failure', async () => {
    const error = new Error('Network error');
    vi.mocked(API.getTodos).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useTodos());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
  });
});

describe('useToggleTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('toggles todo status successfully', async () => {
    const todo = createTodo({ id: 'todo-1', status: '진행중' });
    const updatedTodo = { ...todo, status: '완료' as const };
    vi.mocked(API.updateTodo).mockResolvedValue(updatedTodo);

    const { result } = renderHookWithClient(() => useToggleTodo());

    await act(async () => {
      result.current.mutate({ id: 'todo-1', status: '완료' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.updateTodo).toHaveBeenCalledWith('todo-1', { status: '완료' });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '할일 상태가 변경되었습니다.',
    });
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Update failed');
    vi.mocked(API.updateTodo).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useToggleTodo());

    await act(async () => {
      result.current.mutate({ id: 'todo-1', status: '완료' });
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

  it('performs optimistic update on todos query', async () => {
    const todos = [
      createTodo({ id: 'todo-1', status: '진행중' }),
      createTodo({ id: 'todo-2', status: '진행중' }),
    ];
    vi.mocked(API.getTodos).mockResolvedValue(todos);
    vi.mocked(API.updateTodo).mockImplementation(
      () => new Promise(() => {}) // Never resolves to test optimistic update
    );

    const queryClient = createTestQueryClient();

    // First, populate the todos query
    const { result: todosResult } = renderHookWithClient(() => useTodos(), { queryClient });

    await waitFor(() => {
      expect(todosResult.current.isSuccess).toBe(true);
    });

    // Now toggle a todo
    const { result: toggleResult } = renderHookWithClient(() => useToggleTodo(), { queryClient });

    await act(async () => {
      toggleResult.current.mutate({ id: 'todo-1', status: '완료' });
    });

    // Check that the optimistic update happened
    const cachedTodos = queryClient.getQueryData(['todos', 'today', undefined]) as typeof todos;
    expect(cachedTodos[0].status).toBe('완료');
    expect(cachedTodos[1].status).toBe('진행중');
  });

  it('rolls back on error after optimistic update', async () => {
    const todos = [createTodo({ id: 'todo-1', status: '진행중' })];
    vi.mocked(API.getTodos).mockResolvedValue(todos);
    vi.mocked(API.updateTodo).mockRejectedValue(new Error('Network error'));

    const queryClient = createTestQueryClient();

    // Populate the todos query
    const { result: todosResult } = renderHookWithClient(() => useTodos(), { queryClient });

    await waitFor(() => {
      expect(todosResult.current.isSuccess).toBe(true);
    });

    // Toggle a todo (will fail)
    const { result: toggleResult } = renderHookWithClient(() => useToggleTodo(), { queryClient });

    await act(async () => {
      toggleResult.current.mutate({ id: 'todo-1', status: '완료' });
    });

    await waitFor(() => {
      expect(toggleResult.current.isError).toBe(true);
    });

    // Check that the rollback happened
    const cachedTodos = queryClient.getQueryData(['todos', 'today', undefined]) as typeof todos;
    expect(cachedTodos[0].status).toBe('진행중');
  });
});

describe('useUpdateTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('updates todo successfully', async () => {
    const todo = createTodo({ id: 'todo-1', title: 'Original Title' });
    const updatedTodo = { ...todo, title: 'Updated Title' };
    vi.mocked(API.updateTodo).mockResolvedValue(updatedTodo);

    const { result } = renderHookWithClient(() => useUpdateTodo());

    await act(async () => {
      result.current.mutate({ id: 'todo-1', data: { title: 'Updated Title' } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.updateTodo).toHaveBeenCalledWith('todo-1', { title: 'Updated Title' });
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '할일이 수정되었습니다.',
    });
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Update failed');
    vi.mocked(API.updateTodo).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useUpdateTodo());

    await act(async () => {
      result.current.mutate({ id: 'todo-1', data: { title: 'New Title' } });
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

  it('invalidates queries on success', async () => {
    const todo = createTodo({ id: 'todo-1' });
    vi.mocked(API.getTodos).mockResolvedValue([todo]);
    vi.mocked(API.updateTodo).mockResolvedValue(todo);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Populate the todos query
    const { result: todosResult } = renderHookWithClient(() => useTodos(), { queryClient });

    await waitFor(() => {
      expect(todosResult.current.isSuccess).toBe(true);
    });

    // Update a todo
    const { result: updateResult } = renderHookWithClient(() => useUpdateTodo(), { queryClient });

    await act(async () => {
      updateResult.current.mutate({ id: 'todo-1', data: { title: 'New Title' } });
    });

    await waitFor(() => {
      expect(updateResult.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['todos'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-notes-with-stats'] });
  });

  it('invalidates work-note-todos query when workNoteId is provided', async () => {
    const todo = createTodo({ id: 'todo-1' });
    vi.mocked(API.updateTodo).mockResolvedValue(todo);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useUpdateTodo('work-note-123'), { queryClient });

    await act(async () => {
      result.current.mutate({ id: 'todo-1', data: { title: 'New Title' } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-note-todos', 'work-note-123'] });
  });
});

describe('useDeleteTodo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFactoryCounter();
  });

  it('deletes todo successfully', async () => {
    vi.mocked(API.deleteTodo).mockResolvedValue(undefined);

    const { result } = renderHookWithClient(() => useDeleteTodo());

    await act(async () => {
      result.current.mutate('todo-1');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(API.deleteTodo).toHaveBeenCalledWith('todo-1');
    expect(mockToast).toHaveBeenCalledWith({
      title: '성공',
      description: '할일이 삭제되었습니다.',
    });
  });

  it('shows error toast on failure', async () => {
    const error = new Error('Delete failed');
    vi.mocked(API.deleteTodo).mockRejectedValue(error);

    const { result } = renderHookWithClient(() => useDeleteTodo());

    await act(async () => {
      result.current.mutate('todo-1');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      variant: 'destructive',
      title: '오류',
      description: 'Delete failed',
    });
  });

  it('performs optimistic delete on todos query', async () => {
    const todos = [
      createTodo({ id: 'todo-1', title: 'Todo 1' }),
      createTodo({ id: 'todo-2', title: 'Todo 2' }),
    ];
    vi.mocked(API.getTodos).mockResolvedValue(todos);
    vi.mocked(API.deleteTodo).mockImplementation(
      () => new Promise(() => {}) // Never resolves to test optimistic update
    );

    const queryClient = createTestQueryClient();

    // Populate the todos query
    const { result: todosResult } = renderHookWithClient(() => useTodos(), { queryClient });

    await waitFor(() => {
      expect(todosResult.current.isSuccess).toBe(true);
    });

    // Delete a todo
    const { result: deleteResult } = renderHookWithClient(() => useDeleteTodo(), { queryClient });

    await act(async () => {
      deleteResult.current.mutate('todo-1');
    });

    // Check that the optimistic delete happened
    const cachedTodos = queryClient.getQueryData(['todos', 'today', undefined]) as typeof todos;
    expect(cachedTodos).toHaveLength(1);
    expect(cachedTodos[0].id).toBe('todo-2');
  });

  it('rolls back on error after optimistic delete', async () => {
    const todos = [
      createTodo({ id: 'todo-1', title: 'Todo 1' }),
      createTodo({ id: 'todo-2', title: 'Todo 2' }),
    ];
    vi.mocked(API.getTodos).mockResolvedValue(todos);
    vi.mocked(API.deleteTodo).mockRejectedValue(new Error('Network error'));

    const queryClient = createTestQueryClient();

    // Populate the todos query
    const { result: todosResult } = renderHookWithClient(() => useTodos(), { queryClient });

    await waitFor(() => {
      expect(todosResult.current.isSuccess).toBe(true);
    });

    // Delete a todo (will fail)
    const { result: deleteResult } = renderHookWithClient(() => useDeleteTodo(), { queryClient });

    await act(async () => {
      deleteResult.current.mutate('todo-1');
    });

    await waitFor(() => {
      expect(deleteResult.current.isError).toBe(true);
    });

    // Check that the rollback happened
    const cachedTodos = queryClient.getQueryData(['todos', 'today', undefined]) as typeof todos;
    expect(cachedTodos).toHaveLength(2);
    expect(cachedTodos[0].id).toBe('todo-1');
  });

  it('invalidates work-note-todos query when workNoteId is provided', async () => {
    vi.mocked(API.deleteTodo).mockResolvedValue(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHookWithClient(() => useDeleteTodo('work-note-123'), { queryClient });

    await act(async () => {
      result.current.mutate('todo-1');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['work-note-todos', 'work-note-123'] });
  });
});
