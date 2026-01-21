// Trace: Test coverage improvement
// Unit tests for TodoRepository recurrence logic

import { env } from 'cloudflare:test';
import { TodoRepository } from '@worker/repositories/todo-repository';
import type { CreateTodoInput } from '@worker/schemas/todo';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;

describe('TodoRepository - Recurrence Logic', () => {
  let repository: TodoRepository;
  let testWorkId: string;

  beforeEach(async () => {
    repository = new TodoRepository(testEnv.DB);

    // Clean up test data
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM todos'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
    ]);

    // Create a test work note
    testWorkId = 'WORK-TEST-001';
    const now = new Date().toISOString();
    await testEnv.DB.prepare(
      'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(testWorkId, 'Test Work Note', 'Content', now, now)
      .run();
  });

  describe('update() - Recurrence Logic', () => {
    it('should create new todo instance when completing daily recurring todo (DUE_DATE)', async () => {
      // Arrange - create a daily recurring todo
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      const input: CreateTodoInput = {
        title: 'Daily Task',
        dueDate: dueDate.toISOString(),
        repeatRule: 'DAILY',
        recurrenceType: 'DUE_DATE',
      };

      const created = await repository.create(testWorkId, input);

      // Act - complete the todo
      await repository.update(created.todoId, { status: '완료' });

      // Assert - check that a new todo was created
      const allTodos = await repository.findByWorkId(testWorkId);
      const incompleteTodos = allTodos.filter((t) => t.status === '진행중');

      expect(incompleteTodos.length).toBe(1);
      expect(incompleteTodos[0].title).toBe('Daily Task');
      expect(incompleteTodos[0].todoId).not.toBe(created.todoId);

      // New todo's due date should be 1 day after original due date
      const newDueDate = new Date(incompleteTodos[0].dueDate as string);
      const expectedDueDate = new Date(dueDate);
      expectedDueDate.setDate(expectedDueDate.getDate() + 1);

      expect(newDueDate.toDateString()).toBe(expectedDueDate.toDateString());
    });

    it('should create new todo instance when completing weekly recurring todo', async () => {
      // Arrange
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      const input: CreateTodoInput = {
        title: 'Weekly Task',
        dueDate: dueDate.toISOString(),
        repeatRule: 'WEEKLY',
        recurrenceType: 'DUE_DATE',
      };

      const created = await repository.create(testWorkId, input);

      // Act
      await repository.update(created.todoId, { status: '완료' });

      // Assert
      const allTodos = await repository.findByWorkId(testWorkId);
      const incompleteTodos = allTodos.filter((t) => t.status === '진행중');

      expect(incompleteTodos.length).toBe(1);
      expect(incompleteTodos[0].title).toBe('Weekly Task');

      const newDueDate = new Date(incompleteTodos[0].dueDate as string);
      const expectedDueDate = new Date(dueDate);
      expectedDueDate.setDate(expectedDueDate.getDate() + 7);

      expect(newDueDate.toDateString()).toBe(expectedDueDate.toDateString());
    });

    it('should create new todo instance when completing monthly recurring todo', async () => {
      // Arrange
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + 1);

      const input: CreateTodoInput = {
        title: 'Monthly Task',
        dueDate: dueDate.toISOString(),
        repeatRule: 'MONTHLY',
        recurrenceType: 'DUE_DATE',
      };

      const created = await repository.create(testWorkId, input);

      // Act
      await repository.update(created.todoId, { status: '완료' });

      // Assert
      const allTodos = await repository.findByWorkId(testWorkId);
      const incompleteTodos = allTodos.filter((t) => t.status === '진행중');

      expect(incompleteTodos.length).toBe(1);
      expect(incompleteTodos[0].title).toBe('Monthly Task');
    });

    it('should use completion date for COMPLETION_DATE recurrence type', async () => {
      // Arrange
      const pastDueDate = new Date();
      pastDueDate.setDate(pastDueDate.getDate() - 7); // Due a week ago

      const input: CreateTodoInput = {
        title: 'Late Task',
        dueDate: pastDueDate.toISOString(),
        repeatRule: 'DAILY',
        recurrenceType: 'COMPLETION_DATE',
      };

      const created = await repository.create(testWorkId, input);

      // Act - complete today (late)
      const completionDate = new Date();
      await repository.update(created.todoId, { status: '완료' });

      // Assert
      const allTodos = await repository.findByWorkId(testWorkId);
      const incompleteTodos = allTodos.filter((t) => t.status === '진행중');

      expect(incompleteTodos.length).toBe(1);

      // New due date should be based on completion date, not original due date
      const newDueDate = new Date(incompleteTodos[0].dueDate as string);
      const expectedDueDate = new Date(completionDate);
      expectedDueDate.setDate(expectedDueDate.getDate() + 1);

      // Allow for small time differences (should be same day)
      expect(newDueDate.toDateString()).toBe(expectedDueDate.toDateString());
    });

    it('should not create new instance when completing non-recurring todo', async () => {
      // Arrange
      const input: CreateTodoInput = {
        title: 'One-time Task',
        repeatRule: 'NONE',
      };

      const created = await repository.create(testWorkId, input);

      // Act
      await repository.update(created.todoId, { status: '완료' });

      // Assert
      const allTodos = await repository.findByWorkId(testWorkId);
      expect(allTodos.length).toBe(1);
      expect(allTodos[0].status).toBe('완료');
    });

    it('should not create new instance when updating status from 완료 to 진행중', async () => {
      // Arrange
      const input: CreateTodoInput = {
        title: 'Task',
        repeatRule: 'DAILY',
        recurrenceType: 'DUE_DATE',
        dueDate: new Date().toISOString(),
      };

      const created = await repository.create(testWorkId, input);

      // Complete it
      await repository.update(created.todoId, { status: '완료' });

      // Act - uncomplete it
      await repository.update(created.todoId, { status: '진행중' });

      // Assert - should not create additional instances
      const allTodos = await repository.findByWorkId(testWorkId);
      expect(allTodos.filter((t) => t.status === '진행중').length).toBeLessThanOrEqual(2);
    });

    it('should copy next due_date to wait_until for new recurring instance', async () => {
      // Arrange
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);
      const waitUntil = new Date();

      const input: CreateTodoInput = {
        title: 'Daily Task',
        dueDate: dueDate.toISOString(),
        waitUntil: waitUntil.toISOString(),
        repeatRule: 'DAILY',
        recurrenceType: 'DUE_DATE',
      };

      const created = await repository.create(testWorkId, input);

      // Act
      await repository.update(created.todoId, { status: '완료' });

      // Assert
      const allTodos = await repository.findByWorkId(testWorkId);
      const newTodo = allTodos.find((t) => t.status === '진행중');

      expect(newTodo?.dueDate).toBeDefined();
      expect(newTodo?.waitUntil).toBe(newTodo?.dueDate);
    });

    it('should preserve repeat_rule and recurrence_type in new instance', async () => {
      // Arrange
      const input: CreateTodoInput = {
        title: 'Weekly Task',
        dueDate: new Date().toISOString(),
        repeatRule: 'WEEKLY',
        recurrenceType: 'COMPLETION_DATE',
      };

      const created = await repository.create(testWorkId, input);

      // Act
      await repository.update(created.todoId, { status: '완료' });

      // Assert
      const allTodos = await repository.findByWorkId(testWorkId);
      const newTodo = allTodos.find((t) => t.status === '진행중');

      expect(newTodo?.repeatRule).toBe('WEEKLY');
      expect(newTodo?.recurrenceType).toBe('COMPLETION_DATE');
    });
  });
});
