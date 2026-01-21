// Trace: Test coverage improvement
// Unit tests for WorkNoteRepository - Associations (getDeptNameForPerson, findTodosByWorkIds)

import { env } from 'cloudflare:test';
import { WorkNoteRepository } from '@worker/repositories/work-note-repository';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;

describe('WorkNoteRepository - Associations', () => {
  let repository: WorkNoteRepository;

  beforeEach(async () => {
    repository = new WorkNoteRepository(testEnv.DB);

    // Clean up test data
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_relation'),
      testEnv.DB.prepare('DELETE FROM work_note_person'),
      testEnv.DB.prepare('DELETE FROM work_note_versions'),
      testEnv.DB.prepare('DELETE FROM todos'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM person_dept_history'),
      testEnv.DB.prepare('DELETE FROM persons'),
      testEnv.DB.prepare('DELETE FROM departments'),
    ]);
  });

  describe('getDeptNameForPerson()', () => {
    it('should return department name for person', async () => {
      // Arrange
      const personId = '123456';
      const deptName = '개발팀';
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind(deptName),
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)'
        ).bind(personId, '홍길동', deptName),
      ]);

      // Act
      const result = await repository.getDeptNameForPerson(personId);

      // Assert
      expect(result).toBe(deptName);
    });

    it('should return null for person without department', async () => {
      // Arrange
      const personId = '123456';
      await testEnv.DB.prepare('INSERT INTO persons (person_id, name) VALUES (?, ?)')
        .bind(personId, '홍길동')
        .run();

      // Act
      const result = await repository.getDeptNameForPerson(personId);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for non-existent person', async () => {
      // Act
      const result = await repository.getDeptNameForPerson('NONEXISTENT');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findTodosByWorkIds()', () => {
    it('should return empty map for empty work IDs array', async () => {
      // Act
      const result = await repository.findTodosByWorkIds([]);

      // Assert
      expect(result.size).toBe(0);
    });

    it('should return todos grouped by work ID', async () => {
      // Arrange
      const now = new Date().toISOString();
      const dueDate = '2025-12-01';
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).bind('WORK-001', 'Note 1', 'Content 1', now, now),
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).bind('WORK-002', 'Note 2', 'Content 2', now, now),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, description, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-001', 'WORK-001', '할 일 1', '설명 1', '진행중', dueDate, now, now),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, description, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-002', 'WORK-001', '할 일 2', null, '완료', null, now, now),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, description, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-003', 'WORK-002', '할 일 3', '설명 3', '보류', dueDate, now, now),
      ]);

      // Act
      const result = await repository.findTodosByWorkIds(['WORK-001', 'WORK-002']);

      // Assert
      expect(result.size).toBe(2);

      const work1Todos = result.get('WORK-001');
      expect(work1Todos).toBeDefined();
      expect(work1Todos?.length).toBe(2);
      expect(work1Todos?.[0].title).toBe('할 일 1');
      expect(work1Todos?.[0].description).toBe('설명 1');
      expect(work1Todos?.[0].status).toBe('진행중');
      expect(work1Todos?.[0].dueDate).toBe(dueDate);
      expect(work1Todos?.[1].title).toBe('할 일 2');
      expect(work1Todos?.[1].description).toBeNull();
      expect(work1Todos?.[1].status).toBe('완료');

      const work2Todos = result.get('WORK-002');
      expect(work2Todos).toBeDefined();
      expect(work2Todos?.length).toBe(1);
      expect(work2Todos?.[0].title).toBe('할 일 3');
    });

    it('should return empty map when no todos exist for work IDs', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
        .bind('WORK-001', 'Note 1', 'Content 1', now, now)
        .run();

      // Act
      const result = await repository.findTodosByWorkIds(['WORK-001']);

      // Assert
      expect(result.size).toBe(0);
    });

    it('should order todos by due date ascending, then created_at', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).bind('WORK-001', 'Note 1', 'Content 1', now, now),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-001', 'WORK-001', '나중 할 일', '진행중', '2025-12-31', now, now),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-002', 'WORK-001', '먼저 할 일', '진행중', '2025-12-01', now, now),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind('TODO-003', 'WORK-001', '기한 없음', '진행중', null, now, now),
      ]);

      // Act
      const result = await repository.findTodosByWorkIds(['WORK-001']);

      // Assert
      const todos = result.get('WORK-001');
      expect(todos?.length).toBe(3);
      expect(todos?.[0].title).toBe('먼저 할 일');
      expect(todos?.[1].title).toBe('나중 할 일');
      expect(todos?.[2].title).toBe('기한 없음');
    });
  });
});
