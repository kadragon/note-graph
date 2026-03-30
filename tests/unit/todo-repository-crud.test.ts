// Trace: Test coverage improvement
// Unit tests for TodoRepository CRUD operations

import { TodoRepository } from '@worker/repositories/todo-repository';
import type { BatchSetDueDatesInput, CreateTodoInput, UpdateTodoInput } from '@worker/schemas/todo';
import { NotFoundError } from '@worker/types/errors';
import { beforeEach, describe, expect, it } from 'vitest';
import { pgCleanupAll } from '../helpers/pg-test-utils';
import { pglite, testPgDb } from '../pg-setup';

describe('TodoRepository - CRUD Operations', () => {
  let repository: TodoRepository;
  let testWorkId: string;

  beforeEach(async () => {
    repository = new TodoRepository(testPgDb);

    await pgCleanupAll(pglite);

    // Create a test work note
    testWorkId = 'WORK-TEST-001';
    const now = new Date().toISOString();
    await pglite.query(
      'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
      [testWorkId, 'Test Work Note', 'Content', now, now]
    );
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
      expect(new Date(result.waitUntil as string).toISOString()).toBe(waitUntil);
      expect(new Date(result.dueDate as string).toISOString()).toBe(waitUntil);

      const stored = await repository.findById(result.todoId);
      expect(new Date(stored?.dueDate as string).toISOString()).toBe(waitUntil);
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
      await expect(repository.update('TODO-NONEXISTENT', { title: 'New' })).rejects.toThrow(
        NotFoundError
      );
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
      expect(new Date(result.waitUntil as string).toISOString()).toBe(waitUntil);
      expect(new Date(result.dueDate as string).toISOString()).toBe(waitUntil);
    });

    it('should keep dueDate when updating waitUntil if dueDate is after waitUntil', async () => {
      // Arrange - set dueDate to 12/10, then update waitUntil to 12/05
      const existingDueDate = new Date('2025-12-10T00:00:00.000Z').toISOString();
      await repository.update(existingTodoId, { dueDate: existingDueDate });

      // Act - update only waitUntil (before dueDate)
      const newWaitUntil = new Date('2025-12-05T00:00:00.000Z').toISOString();
      const result = await repository.update(existingTodoId, { waitUntil: newWaitUntil });

      // Assert - dueDate should remain unchanged since it's after waitUntil
      expect(new Date(result.waitUntil as string).toISOString()).toBe(newWaitUntil);
      expect(new Date(result.dueDate as string).toISOString()).toBe(existingDueDate);
    });

    it('should update dueDate to waitUntil when existing dueDate is before waitUntil', async () => {
      // Arrange - set dueDate to 12/01, then update waitUntil to 12/10
      const existingDueDate = new Date('2025-12-01T00:00:00.000Z').toISOString();
      await repository.update(existingTodoId, { dueDate: existingDueDate });

      // Act - update only waitUntil (after dueDate)
      const newWaitUntil = new Date('2025-12-10T00:00:00.000Z').toISOString();
      const result = await repository.update(existingTodoId, { waitUntil: newWaitUntil });

      // Assert - dueDate should be updated to match waitUntil
      expect(new Date(result.waitUntil as string).toISOString()).toBe(newWaitUntil);
      expect(new Date(result.dueDate as string).toISOString()).toBe(newWaitUntil);
    });

    it('should clamp dueDate to waitUntil when both fields are provided and dueDate is earlier', async () => {
      // Arrange
      const earlierDueDate = new Date('2025-12-01T00:00:00.000Z').toISOString();
      const laterWaitUntil = new Date('2025-12-10T00:00:00.000Z').toISOString();

      // Act
      const result = await repository.update(existingTodoId, {
        dueDate: earlierDueDate,
        waitUntil: laterWaitUntil,
      });

      // Assert
      expect(new Date(result.waitUntil as string).toISOString()).toBe(laterWaitUntil);
      expect(new Date(result.dueDate as string).toISOString()).toBe(laterWaitUntil);
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

  describe('batchSetDueDates()', () => {
    it('should update due_date and let DB trigger handle updated_at', async () => {
      // Arrange
      const todo = await repository.create(testWorkId, {
        title: 'Trigger test',
        dueDate: '2026-01-01',
        repeatRule: 'NONE',
      });

      // Record the original updated_at
      const beforeRow = await pglite.query<{ updated_at: string }>(
        'SELECT updated_at FROM todos WHERE todo_id = $1',
        [todo.todoId]
      );
      const originalUpdatedAt = new Date(beforeRow.rows[0].updated_at).getTime();

      // Small delay to ensure timestamp difference
      await new Promise((r) => setTimeout(r, 10));

      const input: BatchSetDueDatesInput = {
        updates: [{ todoId: todo.todoId, dueDate: '2026-06-15' }],
      };

      // Act
      const result = await repository.batchSetDueDates(input);

      // Assert
      expect(result.updatedCount).toBe(1);

      const afterRow = await pglite.query<{ due_date: string; updated_at: string }>(
        'SELECT due_date, updated_at FROM todos WHERE todo_id = $1',
        [todo.todoId]
      );
      expect(new Date(afterRow.rows[0].due_date).toISOString().slice(0, 10)).toBe('2026-06-15');

      const newUpdatedAt = new Date(afterRow.rows[0].updated_at).getTime();
      expect(newUpdatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should atomically update multiple todos in a single transaction', async () => {
      // Arrange
      const todo1 = await repository.create(testWorkId, {
        title: 'Batch tx 1',
        dueDate: '2026-01-01',
        repeatRule: 'NONE',
      });
      const todo2 = await repository.create(testWorkId, {
        title: 'Batch tx 2',
        dueDate: '2026-01-01',
        repeatRule: 'NONE',
      });

      const input: BatchSetDueDatesInput = {
        updates: [
          { todoId: todo1.todoId, dueDate: '2026-07-01' },
          { todoId: todo2.todoId, dueDate: '2026-08-01' },
        ],
      };

      // Act
      const result = await repository.batchSetDueDates(input);

      // Assert
      expect(result.updatedCount).toBe(2);

      const rows = await pglite.query<{ todo_id: string; due_date: string }>(
        'SELECT todo_id, due_date FROM todos WHERE todo_id IN ($1, $2) ORDER BY todo_id',
        [todo1.todoId, todo2.todoId]
      );
      const dueDates = new Map(
        rows.rows.map((r) => [r.todo_id, new Date(r.due_date).toISOString().slice(0, 10)])
      );
      expect(dueDates.get(todo1.todoId)).toBe('2026-07-01');
      expect(dueDates.get(todo2.todoId)).toBe('2026-08-01');
    });
  });

  describe('getCountsByDateRange()', () => {
    it('should count todos by due date using direct DATE comparison', async () => {
      // Arrange — create todos with different due dates
      await repository.create(testWorkId, {
        title: 'Todo Mar 15',
        dueDate: '2026-03-15',
        repeatRule: 'NONE',
      });
      await repository.create(testWorkId, {
        title: 'Todo Mar 15 second',
        dueDate: '2026-03-15',
        repeatRule: 'NONE',
      });
      await repository.create(testWorkId, {
        title: 'Todo Mar 20',
        dueDate: '2026-03-20',
        repeatRule: 'NONE',
      });
      // Outside range
      await repository.create(testWorkId, {
        title: 'Todo Apr 01',
        dueDate: '2026-04-01',
        repeatRule: 'NONE',
      });

      // Act
      const counts = await repository.getCountsByDateRange('2026-03-01', '2026-03-31');

      // Assert
      expect(counts['2026-03-15']).toBe(2);
      expect(counts['2026-03-20']).toBe(1);
      expect(counts['2026-04-01']).toBeUndefined();
    });
  });
});
