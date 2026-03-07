// Trace: Test coverage improvement
// Unit tests for TodoRepository query methods

import { TodoRepository } from '@worker/repositories/todo-repository';
import { beforeEach, describe, expect, it } from 'vitest';
import { pgCleanupAll } from '../helpers/pg-test-utils';
import { pglite, testPgDb } from '../pg-setup';

describe('TodoRepository - Query Methods', () => {
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

  describe('findById()', () => {
    it('should find todo by ID', async () => {
      // Arrange
      const todoId = 'TODO-TEST-001';
      const now = new Date().toISOString();
      await pglite.query(
        'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES ($1, $2, $3, $4, $5, $6)',
        [todoId, testWorkId, 'Test Todo', now, '진행중', 'NONE']
      );

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

      await pglite.query(
        'INSERT INTO todos (todo_id, work_id, title, description, created_at, due_date, wait_until, status, repeat_rule, recurrence_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [
          todoId,
          testWorkId,
          'Todo with details',
          'Detailed description',
          now,
          dueDate.toISOString(),
          now,
          '진행중',
          'DAILY',
          'DUE_DATE',
        ]
      );

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
      await pglite.query(
        'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES ($1, $2, $3, $4, $5, $6)',
        ['TODO-001', testWorkId, 'Todo 1', now, '진행중', 'NONE']
      );
      await pglite.query(
        'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES ($1, $2, $3, $4, $5, $6)',
        ['TODO-002', testWorkId, 'Todo 2', now, '진행중', 'NONE']
      );

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

      await pglite.query(
        'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES ($1, $2, $3, $4, $5, $6)',
        ['TODO-001', testWorkId, 'Earlier', earlier.toISOString(), '진행중', 'NONE']
      );
      await pglite.query(
        'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES ($1, $2, $3, $4, $5, $6)',
        ['TODO-002', testWorkId, 'Later', now.toISOString(), '진행중', 'NONE']
      );

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
      await pglite.query(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
        [otherWorkId, 'Other Work', 'Content', now, now]
      );
      await pglite.query(
        'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES ($1, $2, $3, $4, $5, $6)',
        ['TODO-001', testWorkId, 'My Todo', now, '진행중', 'NONE']
      );
      await pglite.query(
        'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES ($1, $2, $3, $4, $5, $6)',
        ['TODO-002', otherWorkId, 'Other Todo', now, '진행중', 'NONE']
      );

      // Act
      const result = await repository.findByWorkId(testWorkId);

      // Assert
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('My Todo');
    });
  });
});
