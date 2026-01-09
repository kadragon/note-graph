// Trace: SPEC-stats-1, TASK-047, TASK-050, TASK-054, TEST-stats-3, TEST-stats-4, TEST-stats-6
/**
 * Integration tests for statistics API routes
 */

import { SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { authFetch, testEnv } from '../test-setup';

describe('Statistics API Routes', () => {
  beforeEach(async () => {
    // Clean up test data
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_person'),
      testEnv.DB.prepare('DELETE FROM work_note_task_category'),
      testEnv.DB.prepare('DELETE FROM todos'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM persons'),
      testEnv.DB.prepare('DELETE FROM departments'),
      testEnv.DB.prepare('DELETE FROM task_categories'),
    ]);
  });

  describe('GET /api/statistics', () => {
    it('should return statistics for this-week period', async () => {
      // Arrange: Create test data with completed todos
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name) VALUES (?)`).bind('개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO task_categories (category_id, name, created_at) VALUES (?, ?, ?)`
        ).bind('CAT-001', '버그수정', `${today}T00:00:00Z`),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', 'Work 1', 'Content', `${today}T10:00:00Z`, `${today}T10:00:00Z`),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-001', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_task_category (work_id, category_id) VALUES (?, ?)`
        ).bind('WORK-001', 'CAT-001'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-001',
          'WORK-001',
          'Task 1',
          '완료',
          `${today}T10:00:00Z`,
          `${today}T10:00:00Z`
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-002',
          'WORK-001',
          'Task 2',
          '진행중',
          `${today}T10:00:00Z`,
          `${today}T10:00:00Z`
        ),
      ]);

      // Act
      const response = await authFetch('/api/statistics?period=this-week');

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.summary).toBeDefined();
      expect(data.summary.totalWorkNotes).toBe(1);
      expect(data.summary.totalCompletedTodos).toBe(1);
      expect(data.summary.totalTodos).toBe(2);
      expect(data.distributions).toBeDefined();
      expect(data.workNotes).toHaveLength(1);
      expect(data.distributions.byCategory[0].categoryName).toBe('버그수정');
    });

    it('should return empty statistics when no completed todos exist', async () => {
      // Arrange: Create work note with no completed todos
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name) VALUES (?)`).bind('개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', 'Work 1', 'Content', `${today}T10:00:00Z`, `${today}T10:00:00Z`),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-001', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-001',
          'WORK-001',
          'Task 1',
          '진행중',
          `${today}T10:00:00Z`,
          `${today}T10:00:00Z`
        ),
      ]);

      // Act
      const response = await authFetch('/api/statistics?period=this-week');

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.summary.totalWorkNotes).toBe(0);
      expect(data.workNotes).toHaveLength(0);
    });

    it('should filter by person correctly', async () => {
      // Arrange: Create work notes for different persons
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name) VALUES (?)`).bind('개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P002', '김철수', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', 'Work 1', 'Content', `${today}T10:00:00Z`, `${today}T10:00:00Z`),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-002', 'Work 2', 'Content', `${today}T10:00:00Z`, `${today}T10:00:00Z`),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-001', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-002', 'P002', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('TODO-001', 'WORK-001', 'Task', '완료', `${today}T10:00:00Z`, `${today}T10:00:00Z`),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('TODO-002', 'WORK-002', 'Task', '완료', `${today}T10:00:00Z`, `${today}T10:00:00Z`),
      ]);

      // Act: Filter by P001
      const response = await authFetch('/api/statistics?period=this-week&personId=P001');

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.summary.totalWorkNotes).toBe(1);
      expect(data.workNotes[0].workId).toBe('WORK-001');
    });

    it.each([
      {
        name: 'first-half',
        period: 'first-half',
        year: 2025,
        expectedWorkId: 'WORK-JAN',
      },
      {
        name: 'second-half',
        period: 'second-half',
        year: 2025,
        expectedWorkId: 'WORK-JUL',
      },
      {
        name: 'this-year',
        period: 'this-year',
        year: 2024,
        expectedWorkId: 'WORK-2024',
      },
    ])('should support $name period with year parameter', async ({
      period,
      year,
      expectedWorkId,
    }) => {
      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name) VALUES (?)`).bind('개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(
          'WORK-JAN',
          'January Work',
          'Content',
          '2025-01-15T10:00:00Z',
          '2025-01-15T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-JUL', 'July Work', 'Content', '2025-07-15T10:00:00Z', '2025-07-15T10:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-2024', 'Work 2024', 'Content', '2024-05-10T10:00:00Z', '2024-05-10T10:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-JAN', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-JUL', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-2024', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-JAN',
          'WORK-JAN',
          'Task',
          '완료',
          '2025-01-20T10:00:00Z',
          '2025-01-20T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-JUL',
          'WORK-JUL',
          'Task',
          '완료',
          '2025-07-20T10:00:00Z',
          '2025-07-20T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-2024',
          'WORK-2024',
          'Task',
          '완료',
          '2024-05-11T10:00:00Z',
          '2024-06-01T10:00:00Z'
        ),
      ]);

      const response = await authFetch(`/api/statistics?period=${period}&year=${year}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.summary.totalWorkNotes).toBe(1);
      expect(data.workNotes[0].workId).toBe(expectedWorkId);
    });

    it('should support custom period with startDate and endDate', async () => {
      // Arrange: Create work notes
      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name) VALUES (?)`).bind('개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-MAR', 'March Work', 'Content', '2025-03-15T10:00:00Z', '2025-03-15T10:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-MAR', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-MAR',
          'WORK-MAR',
          'Task',
          '완료',
          '2025-03-20T10:00:00Z',
          '2025-03-20T10:00:00Z'
        ),
      ]);

      // Act: Query custom range (March 2025)
      const response = await authFetch(
        '/api/statistics?period=custom&startDate=2025-03-01&endDate=2025-03-31'
      );

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.summary.totalWorkNotes).toBe(1);
      expect(data.workNotes[0].workId).toBe('WORK-MAR');
    });

    it('should return 400 for custom period without dates', async () => {
      // Act
      const response = await authFetch('/api/statistics?period=custom');

      // Assert
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      // Act: Request without auth header
      const response = await SELF.fetch('http://localhost/api/statistics?period=this-week');

      // Assert
      expect(response.status).toBe(401);
    });
  });
});
