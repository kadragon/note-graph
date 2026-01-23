// Trace: SPEC-todo-2, TASK-053, TEST-todo-ux-3, TEST-todo-ux-5, TEST-todo-ux-6
import { groupRecurringTodos } from '@web/pages/work-notes/components/group-recurring-todos';
import type { Todo } from '@web/types/api';
import { beforeEach, describe, expect, it } from 'vitest';

describe('groupRecurringTodos', () => {
  let nextId = 1;
  beforeEach(() => {
    nextId = 1;
  });
  const createTodo = (overrides: Partial<Todo>): Todo => ({
    id: `todo-${nextId++}`,
    title: 'Test Todo',
    status: '진행중',
    createdAt: '2025-12-01T00:00:00Z',
    updatedAt: '2025-12-01T00:00:00Z',
    repeatRule: 'NONE',
    ...overrides,
  });

  it('should group recurring todos with same title and repeat rule', () => {
    const todos: Todo[] = [
      createTodo({
        id: 'todo-1',
        title: 'Daily Standup',
        repeatRule: 'DAILY',
        dueDate: '2025-12-01',
      }),
      createTodo({
        id: 'todo-2',
        title: 'Daily Standup',
        repeatRule: 'DAILY',
        dueDate: '2025-12-02',
      }),
      createTodo({
        id: 'todo-3',
        title: 'Daily Standup',
        repeatRule: 'DAILY',
        dueDate: '2025-12-03',
      }),
    ];

    const result = groupRecurringTodos(todos);

    expect(result.recurring).toHaveLength(1);
    expect(result.recurring[0].title).toBe('Daily Standup');
    expect(result.recurring[0].repeatRule).toBe('DAILY');
    expect(result.recurring[0].todos).toHaveLength(3);
    expect(result.standalone).toHaveLength(0);
  });

  it('should not group todos with repeatRule=NONE', () => {
    const todos: Todo[] = [
      createTodo({ id: 'todo-1', title: 'Task A', repeatRule: 'NONE' }),
      createTodo({ id: 'todo-2', title: 'Task A', repeatRule: 'NONE' }),
      createTodo({ id: 'todo-3', title: 'Task A', repeatRule: 'NONE' }),
    ];

    const result = groupRecurringTodos(todos);

    expect(result.recurring).toHaveLength(0);
    expect(result.standalone).toHaveLength(3);
  });

  it('should handle mixed recurring and non-recurring todos', () => {
    const todos: Todo[] = [
      createTodo({ id: 'todo-1', title: 'Weekly Meeting', repeatRule: 'WEEKLY' }),
      createTodo({ id: 'todo-2', title: 'Weekly Meeting', repeatRule: 'WEEKLY' }),
      createTodo({ id: 'todo-3', title: 'One-time Task', repeatRule: 'NONE' }),
    ];

    const result = groupRecurringTodos(todos);

    expect(result.recurring).toHaveLength(1);
    expect(result.recurring[0].todos).toHaveLength(2);
    expect(result.standalone).toHaveLength(1);
    expect(result.standalone[0].title).toBe('One-time Task');
  });

  it('should treat single recurring instances as standalone', () => {
    const todos: Todo[] = [
      createTodo({ id: 'todo-1', title: 'Unique Recurring', repeatRule: 'MONTHLY' }),
      createTodo({ id: 'todo-2', title: 'Weekly Task', repeatRule: 'WEEKLY' }),
      createTodo({ id: 'todo-3', title: 'Weekly Task', repeatRule: 'WEEKLY' }),
    ];

    const result = groupRecurringTodos(todos);

    // Only the Weekly Task group should be in recurring (has 2+ instances)
    expect(result.recurring).toHaveLength(1);
    expect(result.recurring[0].title).toBe('Weekly Task');

    // Single instance of "Unique Recurring" should be standalone
    expect(result.standalone).toHaveLength(1);
    expect(result.standalone[0].title).toBe('Unique Recurring');
  });

  it('should group case-insensitively by normalized title', () => {
    const todos: Todo[] = [
      createTodo({ id: 'todo-1', title: 'Daily Standup', repeatRule: 'DAILY' }),
      createTodo({ id: 'todo-2', title: 'daily standup', repeatRule: 'DAILY' }),
      createTodo({ id: 'todo-3', title: '  Daily Standup  ', repeatRule: 'DAILY' }),
    ];

    const result = groupRecurringTodos(todos);

    expect(result.recurring).toHaveLength(1);
    expect(result.recurring[0].todos).toHaveLength(3);
    // Should use original title from first todo
    expect(result.recurring[0].title).toBe('Daily Standup');
  });

  it('should sort todos within groups by due date', () => {
    const todos: Todo[] = [
      createTodo({
        id: 'todo-3',
        title: 'Task',
        repeatRule: 'DAILY',
        dueDate: '2025-12-03',
      }),
      createTodo({
        id: 'todo-1',
        title: 'Task',
        repeatRule: 'DAILY',
        dueDate: '2025-12-01',
      }),
      createTodo({
        id: 'todo-2',
        title: 'Task',
        repeatRule: 'DAILY',
        dueDate: '2025-12-02',
      }),
    ];

    const result = groupRecurringTodos(todos);

    expect(result.recurring[0].todos[0].dueDate).toBe('2025-12-01');
    expect(result.recurring[0].todos[1].dueDate).toBe('2025-12-02');
    expect(result.recurring[0].todos[2].dueDate).toBe('2025-12-03');
  });

  it('should separate groups by different repeat rules', () => {
    const todos: Todo[] = [
      createTodo({ id: 'todo-1', title: 'Same Title', repeatRule: 'DAILY' }),
      createTodo({ id: 'todo-2', title: 'Same Title', repeatRule: 'DAILY' }),
      createTodo({ id: 'todo-3', title: 'Same Title', repeatRule: 'WEEKLY' }),
      createTodo({ id: 'todo-4', title: 'Same Title', repeatRule: 'WEEKLY' }),
    ];

    const result = groupRecurringTodos(todos);

    expect(result.recurring).toHaveLength(2);
    expect(result.recurring.find((g) => g.repeatRule === 'DAILY')?.todos).toHaveLength(2);
    expect(result.recurring.find((g) => g.repeatRule === 'WEEKLY')?.todos).toHaveLength(2);
  });

  it('should handle empty todo list', () => {
    const result = groupRecurringTodos([]);

    expect(result.recurring).toHaveLength(0);
    expect(result.standalone).toHaveLength(0);
  });

  it('should use createdAt for sorting when dueDate is missing', () => {
    const todos: Todo[] = [
      createTodo({
        id: 'todo-2',
        title: 'Task',
        repeatRule: 'DAILY',
        createdAt: '2025-12-02T00:00:00Z',
      }),
      createTodo({
        id: 'todo-1',
        title: 'Task',
        repeatRule: 'DAILY',
        createdAt: '2025-12-01T00:00:00Z',
      }),
    ];

    const result = groupRecurringTodos(todos);

    expect(result.recurring[0].todos[0].id).toBe('todo-1');
    expect(result.recurring[0].todos[1].id).toBe('todo-2');
  });
});
