import { getLatestTodoDate } from '@web/hooks/get-latest-todo-date';
import type { Todo } from '@web/types/api';
import { describe, expect, it } from 'vitest';

describe('getLatestTodoDate', () => {
  const createTodo = (overrides: Partial<Todo> = {}): Todo => ({
    id: 'todo-1',
    title: 'Test Todo',
    status: '진행중',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  });

  it('should return null for empty todo array', () => {
    const result = getLatestTodoDate([]);
    expect(result).toBeNull();
  });

  it('should return the dueDate when there is only one todo with dueDate', () => {
    const todos = [createTodo({ dueDate: '2024-06-15' })];
    const result = getLatestTodoDate(todos);
    expect(result).toBe('2024-06-15');
  });

  it('should return the most recent dueDate when multiple todos have dueDates', () => {
    const todos = [
      createTodo({ id: 'todo-1', dueDate: '2024-06-10' }),
      createTodo({ id: 'todo-2', dueDate: '2024-06-20' }),
      createTodo({ id: 'todo-3', dueDate: '2024-06-15' }),
    ];
    const result = getLatestTodoDate(todos);
    expect(result).toBe('2024-06-20');
  });

  it('should ignore todos without dueDate', () => {
    const todos = [
      createTodo({ id: 'todo-1', dueDate: undefined }),
      createTodo({ id: 'todo-2', dueDate: '2024-06-10' }),
      createTodo({ id: 'todo-3', dueDate: undefined }),
    ];
    const result = getLatestTodoDate(todos);
    expect(result).toBe('2024-06-10');
  });

  it('should return null when no todos have dueDate', () => {
    const todos = [
      createTodo({ id: 'todo-1', dueDate: undefined }),
      createTodo({ id: 'todo-2', dueDate: undefined }),
    ];
    const result = getLatestTodoDate(todos);
    expect(result).toBeNull();
  });
});
