// Trace: SPEC-stats-1, TASK-047, TASK-050, TASK-054, TEST-stats-3, TEST-stats-4, TEST-stats-6
/**
 * Integration tests for statistics API routes
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDatabaseFactory } from '../helpers/test-app';

vi.mock('@worker/adapters/database-factory', () => mockDatabaseFactory());

import worker from '@worker/index';
import { pgCleanupAll } from '../helpers/pg-test-utils';
import { createAuthFetch, createTestRequest } from '../helpers/test-app';
import { pglite } from '../pg-setup';

const authFetch = createAuthFetch(worker);
const request = createTestRequest(worker);

describe('Statistics API Routes', () => {
  beforeEach(async () => {
    await pgCleanupAll(pglite);
  });

  describe('GET /api/statistics', () => {
    it('should return statistics for this-week period', async () => {
      // Arrange: Create test data with completed todos
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      await pglite.query(`INSERT INTO departments (dept_name) VALUES ($1)`, ['개발팀']);
      await pglite.query(
        `INSERT INTO persons (person_id, name, current_dept) VALUES ($1, $2, $3)`,
        ['P001', '홍길동', '개발팀']
      );
      await pglite.query(
        `INSERT INTO task_categories (category_id, name, created_at) VALUES ($1, $2, $3)`,
        ['CAT-001', '버그수정', `${today}T00:00:00Z`]
      );
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
        ['WORK-001', 'Work 1', 'Content', `${today}T10:00:00Z`, `${today}T10:00:00Z`]
      );
      await pglite.query(
        `INSERT INTO work_note_person (work_id, person_id, role) VALUES ($1, $2, $3)`,
        ['WORK-001', 'P001', 'OWNER']
      );
      await pglite.query(
        `INSERT INTO work_note_task_category (work_id, category_id) VALUES ($1, $2)`,
        ['WORK-001', 'CAT-001']
      );
      await pglite.query(
        `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TODO-001', 'WORK-001', 'Task 1', '완료', `${today}T10:00:00Z`, `${today}T10:00:00Z`]
      );
      await pglite.query(
        `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TODO-002', 'WORK-001', 'Task 2', '진행중', `${today}T10:00:00Z`, `${today}T10:00:00Z`]
      );

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

      await pglite.query(`INSERT INTO departments (dept_name) VALUES ($1)`, ['개발팀']);
      await pglite.query(
        `INSERT INTO persons (person_id, name, current_dept) VALUES ($1, $2, $3)`,
        ['P001', '홍길동', '개발팀']
      );
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
        ['WORK-001', 'Work 1', 'Content', `${today}T10:00:00Z`, `${today}T10:00:00Z`]
      );
      await pglite.query(
        `INSERT INTO work_note_person (work_id, person_id, role) VALUES ($1, $2, $3)`,
        ['WORK-001', 'P001', 'OWNER']
      );
      await pglite.query(
        `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TODO-001', 'WORK-001', 'Task 1', '진행중', `${today}T10:00:00Z`, `${today}T10:00:00Z`]
      );

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

      await pglite.query(`INSERT INTO departments (dept_name) VALUES ($1)`, ['개발팀']);
      await pglite.query(
        `INSERT INTO persons (person_id, name, current_dept) VALUES ($1, $2, $3)`,
        ['P001', '홍길동', '개발팀']
      );
      await pglite.query(
        `INSERT INTO persons (person_id, name, current_dept) VALUES ($1, $2, $3)`,
        ['P002', '김철수', '개발팀']
      );
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
        ['WORK-001', 'Work 1', 'Content', `${today}T10:00:00Z`, `${today}T10:00:00Z`]
      );
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
        ['WORK-002', 'Work 2', 'Content', `${today}T10:00:00Z`, `${today}T10:00:00Z`]
      );
      await pglite.query(
        `INSERT INTO work_note_person (work_id, person_id, role) VALUES ($1, $2, $3)`,
        ['WORK-001', 'P001', 'OWNER']
      );
      await pglite.query(
        `INSERT INTO work_note_person (work_id, person_id, role) VALUES ($1, $2, $3)`,
        ['WORK-002', 'P002', 'OWNER']
      );
      await pglite.query(
        `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TODO-001', 'WORK-001', 'Task', '완료', `${today}T10:00:00Z`, `${today}T10:00:00Z`]
      );
      await pglite.query(
        `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TODO-002', 'WORK-002', 'Task', '완료', `${today}T10:00:00Z`, `${today}T10:00:00Z`]
      );

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
      await pglite.query(`INSERT INTO departments (dept_name) VALUES ($1)`, ['개발팀']);
      await pglite.query(
        `INSERT INTO persons (person_id, name, current_dept) VALUES ($1, $2, $3)`,
        ['P001', '홍길동', '개발팀']
      );
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
        ['WORK-JAN', 'January Work', 'Content', '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z']
      );
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
        ['WORK-JUL', 'July Work', 'Content', '2025-07-15T10:00:00Z', '2025-07-15T10:00:00Z']
      );
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
        ['WORK-2024', 'Work 2024', 'Content', '2024-05-10T10:00:00Z', '2024-05-10T10:00:00Z']
      );
      await pglite.query(
        `INSERT INTO work_note_person (work_id, person_id, role) VALUES ($1, $2, $3)`,
        ['WORK-JAN', 'P001', 'OWNER']
      );
      await pglite.query(
        `INSERT INTO work_note_person (work_id, person_id, role) VALUES ($1, $2, $3)`,
        ['WORK-JUL', 'P001', 'OWNER']
      );
      await pglite.query(
        `INSERT INTO work_note_person (work_id, person_id, role) VALUES ($1, $2, $3)`,
        ['WORK-2024', 'P001', 'OWNER']
      );
      await pglite.query(
        `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TODO-JAN', 'WORK-JAN', 'Task', '완료', '2025-01-20T10:00:00Z', '2025-01-20T10:00:00Z']
      );
      await pglite.query(
        `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TODO-JUL', 'WORK-JUL', 'Task', '완료', '2025-07-20T10:00:00Z', '2025-07-20T10:00:00Z']
      );
      await pglite.query(
        `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TODO-2024', 'WORK-2024', 'Task', '완료', '2024-05-11T10:00:00Z', '2024-06-01T10:00:00Z']
      );

      const response = await authFetch(`/api/statistics?period=${period}&year=${year}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.summary.totalWorkNotes).toBe(1);
      expect(data.workNotes[0].workId).toBe(expectedWorkId);
    });

    it('should support custom period with startDate and endDate', async () => {
      // Arrange: Create work notes
      await pglite.query(`INSERT INTO departments (dept_name) VALUES ($1)`, ['개발팀']);
      await pglite.query(
        `INSERT INTO persons (person_id, name, current_dept) VALUES ($1, $2, $3)`,
        ['P001', '홍길동', '개발팀']
      );
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
        ['WORK-MAR', 'March Work', 'Content', '2025-03-15T10:00:00Z', '2025-03-15T10:00:00Z']
      );
      await pglite.query(
        `INSERT INTO work_note_person (work_id, person_id, role) VALUES ($1, $2, $3)`,
        ['WORK-MAR', 'P001', 'OWNER']
      );
      await pglite.query(
        `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
        ['TODO-MAR', 'WORK-MAR', 'Task', '완료', '2025-03-20T10:00:00Z', '2025-03-20T10:00:00Z']
      );

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
      const response = await request('/api/statistics?period=this-week');

      // Assert
      expect(response.status).toBe(401);
    });
  });
});
