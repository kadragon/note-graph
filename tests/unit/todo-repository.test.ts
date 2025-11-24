// Trace: Test coverage improvement
// Unit tests for TodoRepository

import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { TodoRepository } from '../../src/repositories/todo-repository';
import { NotFoundError } from '../../src/types/errors';
import type { Env } from '../../src/types/env';
import type { CreateTodoInput, UpdateTodoInput } from '../../src/schemas/todo';

const testEnv = env as unknown as Env;

describe('TodoRepository', () => {
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

  describe('findById()', () => {
    it('should find todo by ID', async () => {
      // Arrange
      const todoId = 'TODO-TEST-001';
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(todoId, testWorkId, 'Test Todo', now, '진행중', 'NONE')
        .run();

      // Act
      const result = await repository.findById(todoId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.todoId).toBe(todoId);
      expect(result?.workId).toBe(testWorkId);
      expect(result?.title).toBe('Test Todo');
      expect(result?.status).toBe('진행중');
      expect(result?.repeatRule).toBe('NONE');
    });

    it('should return null for non-existent todo', async () => {
      // Act
      const result = await repository.findById('TODO-NONEXISTENT');

      // Assert
      expect(result).toBeNull();
    });

    it('should include optional fields when present', async () => {
      // Arrange
      const todoId = 'TODO-TEST-002';
      const now = new Date().toISOString();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      await testEnv.DB.prepare(
        'INSERT INTO todos (todo_id, work_id, title, description, created_at, due_date, wait_until, status, repeat_rule, recurrence_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          todoId,
          testWorkId,
          'Todo with details',
          'Detailed description',
          now,
          dueDate.toISOString(),
          now,
          '진행중',
          'DAILY',
          'DUE_DATE'
        )
        .run();

      // Act
      const result = await repository.findById(todoId);

      // Assert
      expect(result?.description).toBe('Detailed description');
      expect(result?.dueDate).toBeDefined();
      expect(result?.waitUntil).toBeDefined();
      expect(result?.repeatRule).toBe('DAILY');
      expect(result?.recurrenceType).toBe('DUE_DATE');
    });
  });

  describe('findByWorkId()', () => {
    it('should find all todos for a work note', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('TODO-001', testWorkId, 'Todo 1', now, '진행중', 'NONE'),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('TODO-002', testWorkId, 'Todo 2', now, '진행중', 'NONE'),
      ]);

      // Act
      const result = await repository.findByWorkId(testWorkId);

      // Assert
      expect(result.length).toBe(2);
      expect(result[0].workId).toBe(testWorkId);
      expect(result[1].workId).toBe(testWorkId);
    });

    it('should return empty array for work note with no todos', async () => {
      // Act
      const result = await repository.findByWorkId(testWorkId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should order todos by created_at DESC', async () => {
      // Arrange
      const now = new Date();
      const earlier = new Date(now.getTime() - 3600000); // 1 hour earlier

      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('TODO-001', testWorkId, 'Earlier', earlier.toISOString(), '진행중', 'NONE'),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('TODO-002', testWorkId, 'Later', now.toISOString(), '진행중', 'NONE'),
      ]);

      // Act
      const result = await repository.findByWorkId(testWorkId);

      // Assert
      expect(result[0].title).toBe('Later');
      expect(result[1].title).toBe('Earlier');
    });

    it('should not return todos from other work notes', async () => {
      // Arrange
      const otherWorkId = 'WORK-TEST-002';
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(otherWorkId, 'Other Work', 'Content', now, now),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('TODO-001', testWorkId, 'My Todo', now, '진행중', 'NONE'),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('TODO-002', otherWorkId, 'Other Todo', now, '진행중', 'NONE'),
      ]);

      // Act
      const result = await repository.findByWorkId(testWorkId);

      // Assert
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('My Todo');
    });
  });

  describe('findAll()', () => {
    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);

      await testEnv.DB.batch([
        // Overdue todo
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-OVERDUE', testWorkId, 'Overdue', now.toISOString(), yesterday.toISOString(), '진행중', 'NONE'),
        // Due today
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-TODAY', testWorkId, 'Today', now.toISOString(), now.toISOString(), '진행중', 'NONE'),
        // Due tomorrow
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-TOMORROW', testWorkId, 'Tomorrow', now.toISOString(), tomorrow.toISOString(), '진행중', 'NONE'),
        // Completed
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('TODO-DONE', testWorkId, 'Done', now.toISOString(), '완료', 'NONE'),
      ]);
    });

    it('should return all todos when view is "all"', async () => {
      // Act
      const result = await repository.findAll({ view: 'all' });

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(4);
    });

    it('should filter backlog (overdue) todos', async () => {
      // Act
      const result = await repository.findAll({ view: 'backlog' });

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((todo) => todo.todoId === 'TODO-OVERDUE')).toBe(true);
    });

    it('should not include completed todos in backlog', async () => {
      // Act
      const result = await repository.findAll({ view: 'backlog' });

      // Assert
      expect(result.some((todo) => todo.status === '완료')).toBe(false);
    });

    it('should filter by status', async () => {
      // Act
      const result = await repository.findAll({ status: '완료' });

      // Assert
      expect(result.every((todo) => todo.status === '완료')).toBe(true);
      expect(result.some((todo) => todo.todoId === 'TODO-DONE')).toBe(true);
    });

    it('should include work note title in results', async () => {
      // Act
      const result = await repository.findAll({ view: 'all' });

      // Assert
      const todoWithWork = result.find((todo) => todo.workId === testWorkId);
      expect(todoWithWork?.workTitle).toBe('Test Work Note');
    });

    it('should order by due date ASC, then created_at DESC', async () => {
      // Act
      const result = await repository.findAll({ view: 'all' });

      // Assert
      expect(result.length).toBeGreaterThan(0);

      // Verify due dates are in ASC order (nulls last)
      const withDueDate = result.filter((t) => t.dueDate !== null);
      const withoutDueDate = result.filter((t) => t.dueDate === null);

      // Check that todos with due dates come before those without
      if (withDueDate.length > 0 && withoutDueDate.length > 0) {
        const lastWithDueIndex = result.findIndex((t) => t.dueDate === null);
        if (lastWithDueIndex > 0) {
          expect(result[lastWithDueIndex - 1].dueDate).not.toBeNull();
        }
      }

      // Verify due dates are sorted in ascending order
      for (let i = 1; i < withDueDate.length; i++) {
        const prevDate = new Date(withDueDate[i - 1].dueDate!).getTime();
        const currDate = new Date(withDueDate[i].dueDate!).getTime();
        expect(prevDate).toBeLessThanOrEqual(currDate);
      }

      // Verify created_at is sorted in descending order for todos without due dates
      for (let i = 1; i < withoutDueDate.length; i++) {
        const prevCreated = new Date(withoutDueDate[i - 1].createdAt).getTime();
        const currCreated = new Date(withoutDueDate[i].createdAt).getTime();
        expect(prevCreated).toBeGreaterThanOrEqual(currCreated);
      }
    });
  });

  describe('create()', () => {
    it('should create todo with minimal fields', async () => {
      // Arrange
      const input: CreateTodoInput = {
        title: 'New Todo',
        repeatRule: 'NONE',
      };

      // Act
      const result = await repository.create(testWorkId, input);

      // Assert
      expect(result.todoId).toBeDefined();
      expect(result.todoId).toMatch(/^TODO-/);
      expect(result.workId).toBe(testWorkId);
      expect(result.title).toBe('New Todo');
      expect(result.status).toBe('진행중');
      expect(result.repeatRule).toBe('NONE');
      expect(result.description).toBeNull();
      expect(result.dueDate).toBeNull();
      expect(result.waitUntil).toBeNull();

      // Verify in DB
      const found = await repository.findById(result.todoId);
      expect(found).not.toBeNull();
    });

    it('should create todo with all fields', async () => {
      // Arrange
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      const waitUntil = new Date();

      const input: CreateTodoInput = {
        title: 'Full Todo',
        description: 'Detailed description',
        dueDate: dueDate.toISOString(),
        waitUntil: waitUntil.toISOString(),
        repeatRule: 'DAILY',
        recurrenceType: 'DUE_DATE',
      };

      // Act
      const result = await repository.create(testWorkId, input);

      // Assert
      expect(result.description).toBe('Detailed description');
      expect(result.dueDate).toBeDefined();
      expect(result.waitUntil).toBeDefined();
      expect(result.repeatRule).toBe('DAILY');
      expect(result.recurrenceType).toBe('DUE_DATE');
    });

    it('should auto-set dueDate when waitUntil is provided without dueDate', async () => {
      // Arrange
      const waitUntil = new Date('2025-12-01T00:00:00.000Z').toISOString();
      const input: CreateTodoInput = {
        title: 'Wait only',
        waitUntil,
        repeatRule: 'NONE',
      };

      // Act
      const result = await repository.create(testWorkId, input);

      // Assert
      expect(result.waitUntil).toBe(waitUntil);
      expect(result.dueDate).toBe(waitUntil);

      const stored = await repository.findById(result.todoId);
      expect(stored?.dueDate).toBe(waitUntil);
    });

    it('should create todo with Korean text', async () => {
      // Arrange
      const input: CreateTodoInput = {
        title: '한글 할일',
        description: '상세 설명입니다',
        repeatRule: 'NONE',
      };

      // Act
      const result = await repository.create(testWorkId, input);

      // Assert
      expect(result.title).toBe('한글 할일');
      expect(result.description).toBe('상세 설명입니다');
    });

    it('should generate unique todo IDs', async () => {
      // Arrange
      const input: CreateTodoInput = {
        title: 'Test',
        repeatRule: 'NONE',
      };

      // Act
      const result1 = await repository.create(testWorkId, input);
      const result2 = await repository.create(testWorkId, input);

      // Assert
      expect(result1.todoId).not.toBe(result2.todoId);
    });

    it('should set default status to 진행중', async () => {
      // Arrange
      const input: CreateTodoInput = {
        title: 'Test',
        repeatRule: 'NONE',
      };

      // Act
      const result = await repository.create(testWorkId, input);

      // Assert
      expect(result.status).toBe('진행중');
    });
  });

  describe('update()', () => {
    let existingTodoId: string;

    beforeEach(async () => {
      const input: CreateTodoInput = {
        title: 'Original Todo',
        description: 'Original description',
        repeatRule: 'NONE',
      };
      const created = await repository.create(testWorkId, input);
      existingTodoId = created.todoId;
    });

    it('should throw NotFoundError for non-existent todo', async () => {
      // Act & Assert
      await expect(repository.update('TODO-NONEXISTENT', { title: 'New' })).rejects.toThrow(NotFoundError);
    });

    it('should update title', async () => {
      // Arrange
      const update: UpdateTodoInput = {
        title: 'Updated Title',
      };

      // Act
      const result = await repository.update(existingTodoId, update);

      // Assert
      expect(result.title).toBe('Updated Title');
      expect(result.description).toBe('Original description');
    });

    it('should update description', async () => {
      // Arrange
      const update: UpdateTodoInput = {
        description: 'Updated description',
      };

      // Act
      const result = await repository.update(existingTodoId, update);

      // Assert
      expect(result.description).toBe('Updated description');
    });

    it('should set dueDate when adding waitUntil and dueDate is missing', async () => {
      // Arrange
      const waitUntil = new Date('2025-12-05T00:00:00.000Z').toISOString();

      // Act
      const result = await repository.update(existingTodoId, { waitUntil });

      // Assert
      expect(result.waitUntil).toBe(waitUntil);
      expect(result.dueDate).toBe(waitUntil);
    });

    it('should keep dueDate when updating waitUntil if dueDate is after waitUntil', async () => {
      // Arrange - set dueDate to 12/10, then update waitUntil to 12/05
      const existingDueDate = new Date('2025-12-10T00:00:00.000Z').toISOString();
      await repository.update(existingTodoId, { dueDate: existingDueDate });

      // Act - update only waitUntil (before dueDate)
      const newWaitUntil = new Date('2025-12-05T00:00:00.000Z').toISOString();
      const result = await repository.update(existingTodoId, { waitUntil: newWaitUntil });

      // Assert - dueDate should remain unchanged since it's after waitUntil
      expect(result.waitUntil).toBe(newWaitUntil);
      expect(result.dueDate).toBe(existingDueDate);
    });

    it('should update dueDate to waitUntil when existing dueDate is before waitUntil', async () => {
      // Arrange - set dueDate to 12/01, then update waitUntil to 12/10
      const existingDueDate = new Date('2025-12-01T00:00:00.000Z').toISOString();
      await repository.update(existingTodoId, { dueDate: existingDueDate });

      // Act - update only waitUntil (after dueDate)
      const newWaitUntil = new Date('2025-12-10T00:00:00.000Z').toISOString();
      const result = await repository.update(existingTodoId, { waitUntil: newWaitUntil });

      // Assert - dueDate should be updated to match waitUntil
      expect(result.waitUntil).toBe(newWaitUntil);
      expect(result.dueDate).toBe(newWaitUntil);
    });

    it('should update status', async () => {
      // Arrange
      const update: UpdateTodoInput = {
        status: '완료',
      };

      // Act
      const result = await repository.update(existingTodoId, update);

      // Assert
      expect(result.status).toBe('완료');
    });

    it('should update due date', async () => {
      // Arrange
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      const update: UpdateTodoInput = {
        dueDate: dueDate.toISOString(),
      };

      // Act
      const result = await repository.update(existingTodoId, update);

      // Assert
      expect(result.dueDate).toBeDefined();
    });

    it('should update wait until date', async () => {
      // Arrange
      const waitUntil = new Date();
      waitUntil.setDate(waitUntil.getDate() + 3);

      const update: UpdateTodoInput = {
        waitUntil: waitUntil.toISOString(),
      };

      // Act
      const result = await repository.update(existingTodoId, update);

      // Assert
      expect(result.waitUntil).toBeDefined();
    });

    it('should update repeat rule and recurrence type', async () => {
      // Arrange
      const update: UpdateTodoInput = {
        repeatRule: 'WEEKLY',
        recurrenceType: 'COMPLETION_DATE',
      };

      // Act
      const result = await repository.update(existingTodoId, update);

      // Assert
      expect(result.repeatRule).toBe('WEEKLY');
      expect(result.recurrenceType).toBe('COMPLETION_DATE');
    });

    it('should update multiple fields at once', async () => {
      // Arrange
      const update: UpdateTodoInput = {
        title: 'New Title',
        description: 'New Description',
        status: '완료',
      };

      // Act
      const result = await repository.update(existingTodoId, update);

      // Assert
      expect(result.title).toBe('New Title');
      expect(result.description).toBe('New Description');
      expect(result.status).toBe('완료');
    });
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
      const newDueDate = new Date(incompleteTodos[0].dueDate!);
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

      // New todo's due date should be 7 days after original
      const newDueDate = new Date(incompleteTodos[0].dueDate!);
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
      const newDueDate = new Date(incompleteTodos[0].dueDate!);
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
