// Tests for getLatestTodoDate utility function

import type { Todo } from '@web/types/api';
import { describe, expect, it } from 'vitest';
import { getLatestTodoDate } from '../get-latest-todo-date';

// Helper to create a minimal Todo object with only required fields
function createTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'test-id',
    title: 'Test Todo',
    status: '진행중',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getLatestTodoDate', () => {
  describe('empty array input', () => {
    it('returns null for empty array', () => {
      expect(getLatestTodoDate([])).toBeNull();
    });
  });

  describe('todos without due dates', () => {
    it('returns null when no todos have dueDates', () => {
      const todos = [
        createTodo({ id: '1', dueDate: undefined }),
        createTodo({ id: '2', dueDate: undefined }),
        createTodo({ id: '3', dueDate: undefined }),
      ];

      expect(getLatestTodoDate(todos)).toBeNull();
    });

    it('returns null when dueDate is explicitly undefined', () => {
      const todos = [createTodo({ dueDate: undefined })];

      expect(getLatestTodoDate(todos)).toBeNull();
    });
  });

  describe('single todo', () => {
    it('returns the dueDate of a single todo with a dueDate', () => {
      const todos = [createTodo({ dueDate: '2025-03-15' })];

      expect(getLatestTodoDate(todos)).toBe('2025-03-15');
    });

    it('returns null for a single todo without a dueDate', () => {
      const todos = [createTodo({ dueDate: undefined })];

      expect(getLatestTodoDate(todos)).toBeNull();
    });
  });

  describe('multiple todos with due dates', () => {
    it('returns the latest dueDate when multiple todos have dueDates', () => {
      const todos = [
        createTodo({ id: '1', dueDate: '2025-01-10' }),
        createTodo({ id: '2', dueDate: '2025-03-20' }),
        createTodo({ id: '3', dueDate: '2025-02-15' }),
      ];

      expect(getLatestTodoDate(todos)).toBe('2025-03-20');
    });

    it('returns the latest dueDate regardless of array order', () => {
      const todos = [
        createTodo({ id: '1', dueDate: '2025-12-31' }),
        createTodo({ id: '2', dueDate: '2025-01-01' }),
        createTodo({ id: '3', dueDate: '2025-06-15' }),
      ];

      expect(getLatestTodoDate(todos)).toBe('2025-12-31');
    });

    it('handles same due dates correctly', () => {
      const todos = [
        createTodo({ id: '1', dueDate: '2025-05-01' }),
        createTodo({ id: '2', dueDate: '2025-05-01' }),
        createTodo({ id: '3', dueDate: '2025-05-01' }),
      ];

      expect(getLatestTodoDate(todos)).toBe('2025-05-01');
    });
  });

  describe('mixed todos (some with due dates, some without)', () => {
    it('returns the latest dueDate ignoring todos without dueDates', () => {
      const todos = [
        createTodo({ id: '1', dueDate: undefined }),
        createTodo({ id: '2', dueDate: '2025-04-10' }),
        createTodo({ id: '3', dueDate: undefined }),
        createTodo({ id: '4', dueDate: '2025-02-05' }),
      ];

      expect(getLatestTodoDate(todos)).toBe('2025-04-10');
    });

    it('returns the single dueDate when only one todo has a dueDate', () => {
      const todos = [
        createTodo({ id: '1', dueDate: undefined }),
        createTodo({ id: '2', dueDate: '2025-07-20' }),
        createTodo({ id: '3', dueDate: undefined }),
      ];

      expect(getLatestTodoDate(todos)).toBe('2025-07-20');
    });
  });

  describe('different date formats', () => {
    it('compares dates in YYYY-MM-DD format correctly', () => {
      const todos = [
        createTodo({ id: '1', dueDate: '2024-12-31' }),
        createTodo({ id: '2', dueDate: '2025-01-01' }),
      ];

      expect(getLatestTodoDate(todos)).toBe('2025-01-01');
    });

    it('handles year boundary comparisons', () => {
      const todos = [
        createTodo({ id: '1', dueDate: '2023-12-31' }),
        createTodo({ id: '2', dueDate: '2024-01-01' }),
        createTodo({ id: '3', dueDate: '2025-01-01' }),
      ];

      expect(getLatestTodoDate(todos)).toBe('2025-01-01');
    });

    it('handles month boundary comparisons', () => {
      const todos = [
        createTodo({ id: '1', dueDate: '2025-01-31' }),
        createTodo({ id: '2', dueDate: '2025-02-01' }),
      ];

      expect(getLatestTodoDate(todos)).toBe('2025-02-01');
    });
  });

  describe('edge cases', () => {
    it('handles a large number of todos', () => {
      const todos = Array.from({ length: 100 }, (_, i) => {
        const month = String((i % 12) + 1).padStart(2, '0');
        const day = String((i % 28) + 1).padStart(2, '0');
        return createTodo({
          id: String(i),
          dueDate: `2025-${month}-${day}`,
        });
      });

      // The latest should be 2025-12-28 (from iteration 95: month=12, day=28)
      expect(getLatestTodoDate(todos)).toBe('2025-12-28');
    });

    it('handles todos at the first position having the latest date', () => {
      const todos = [
        createTodo({ id: '1', dueDate: '2025-12-31' }),
        createTodo({ id: '2', dueDate: '2025-01-01' }),
        createTodo({ id: '3', dueDate: '2025-06-15' }),
      ];

      expect(getLatestTodoDate(todos)).toBe('2025-12-31');
    });

    it('handles todos at the last position having the latest date', () => {
      const todos = [
        createTodo({ id: '1', dueDate: '2025-01-01' }),
        createTodo({ id: '2', dueDate: '2025-06-15' }),
        createTodo({ id: '3', dueDate: '2025-12-31' }),
      ];

      expect(getLatestTodoDate(todos)).toBe('2025-12-31');
    });
  });
});
