// Trace: SPEC-stats-1, TASK-047, TASK-050, TASK-054, TEST-stats-1, TEST-stats-2, TEST-stats-3
/**
 * Unit tests for StatisticsRepository
 */

import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { StatisticsRepository } from '@/repositories/statistics-repository';
import type { Env } from '@/types/env';

const testEnv = env as unknown as Env;

describe('StatisticsRepository', () => {
  let repo: StatisticsRepository;

  beforeEach(async () => {
    repo = new StatisticsRepository(testEnv.DB);

    // Clean up before each test
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_person'),
      testEnv.DB.prepare('DELETE FROM work_note_relation'),
      testEnv.DB.prepare('DELETE FROM work_note_task_category'),
      testEnv.DB.prepare('DELETE FROM todos'),
      testEnv.DB.prepare('DELETE FROM work_note_versions'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM persons'),
      testEnv.DB.prepare('DELETE FROM departments'),
      testEnv.DB.prepare('DELETE FROM task_categories'),
    ]);
  });

  describe('findCompletedWorkNotes', () => {
    it('should return work notes with at least one completed todo', async () => {
      // Arrange: Create department, person, work note, and todos
      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name, description) VALUES (?, ?)`).bind(
          '개발팀',
          'Development'
        ),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept, current_position) VALUES (?, ?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀', '팀장'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', 'Test Work', 'Content', '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-001', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-001',
          'WORK-001',
          'Task 1',
          '완료',
          '2025-01-15T10:00:00Z',
          '2025-01-15T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-002',
          'WORK-001',
          'Task 2',
          '진행중',
          '2025-01-15T10:00:00Z',
          '2025-01-15T10:00:00Z'
        ),
      ]);

      // Act
      const results = await repo.findCompletedWorkNotes('2025-01-01', '2025-01-31');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].workId).toBe('WORK-001');
      expect(results[0].completedTodoCount).toBe(1);
      expect(results[0].totalTodoCount).toBe(2);
      expect(results[0].assignedPersons).toHaveLength(1);
      expect(results[0].assignedPersons[0].personName).toBe('홍길동');
    });

    it('should not return work notes with no completed todos', async () => {
      // Arrange: Work note with only in-progress todos
      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name, description) VALUES (?, ?)`).bind(
          '개발팀',
          'Development'
        ),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(
          'WORK-002',
          'Incomplete Work',
          'Content',
          '2025-01-15T10:00:00Z',
          '2025-01-15T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-002', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-003',
          'WORK-002',
          'Task 1',
          '진행중',
          '2025-01-20T10:00:00Z',
          '2025-01-20T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-004',
          'WORK-002',
          'Task 2',
          '보류',
          '2025-01-20T10:00:00Z',
          '2025-01-20T10:00:00Z'
        ),
      ]);

      // Act
      const results = await repo.findCompletedWorkNotes('2025-01-01', '2025-01-31');

      // Assert
      expect(results).toHaveLength(0);
    });

    it('should filter by date range correctly', async () => {
      // Arrange: Work notes in different months
      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name, description) VALUES (?, ?)`).bind(
          '개발팀',
          'Development'
        ),
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
        ).bind(
          'WORK-FEB',
          'February Work',
          'Content',
          '2025-02-15T10:00:00Z',
          '2025-02-15T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-JAN', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-FEB', 'P001', 'OWNER'),
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
          'TODO-FEB',
          'WORK-FEB',
          'Task',
          '완료',
          '2025-02-20T10:00:00Z',
          '2025-02-20T10:00:00Z'
        ),
      ]);

      // Act: Query only January
      const results = await repo.findCompletedWorkNotes('2025-01-01', '2025-01-31');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].workId).toBe('WORK-JAN');
    });

    it('should include work notes completed within range even if created earlier', async () => {
      // Arrange: Work note created last year but completed this year
      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name, description) VALUES (?, ?)`).bind(
          '개발팀',
          'Development'
        ),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-OLD', 'Old Work', 'Content', '2024-12-15T10:00:00Z', '2024-12-15T10:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-OLD', 'P001', 'OWNER'),
        // Completed in January 2025
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-OLD',
          'WORK-OLD',
          'Task',
          '완료',
          '2024-12-20T10:00:00Z',
          '2025-01-05T09:00:00Z'
        ),
      ]);

      // Act: Query January 2025
      const results = await repo.findCompletedWorkNotes('2025-01-01', '2025-01-31');

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].workId).toBe('WORK-OLD');
    });

    it('should support filtering by person', async () => {
      // Arrange: Work notes assigned to different persons
      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name, description) VALUES (?, ?)`).bind(
          '개발팀',
          'Development'
        ),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P002', '김철수', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-HGD', 'Hong Work', 'Content', '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-KCS', 'Kim Work', 'Content', '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-HGD', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-KCS', 'P002', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-HGD',
          'WORK-HGD',
          'Task',
          '완료',
          '2025-01-20T10:00:00Z',
          '2025-01-20T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-KCS',
          'WORK-KCS',
          'Task',
          '완료',
          '2025-01-20T10:00:00Z',
          '2025-01-20T10:00:00Z'
        ),
      ]);

      // Act: Query only P001's work notes
      const results = await repo.findCompletedWorkNotes('2025-01-01', '2025-01-31', {
        personId: 'P001',
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].workId).toBe('WORK-HGD');
    });

    it('should support filtering by category', async () => {
      // Arrange: Work notes with different categories
      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name, description) VALUES (?, ?)`).bind(
          '개발팀',
          'Development'
        ),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '홍길동', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO task_categories (category_id, name, created_at) VALUES (?, ?, ?)`
        ).bind('CAT-BUG', '버그수정', '2025-01-01T00:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO task_categories (category_id, name, created_at) VALUES (?, ?, ?)`
        ).bind('CAT-FEAT', '기능개발', '2025-01-01T00:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-BUG', 'Bug Work', 'Content', '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(
          'WORK-FEAT',
          'Feature Work',
          'Content',
          '2025-01-15T10:00:00Z',
          '2025-01-15T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO work_note_task_category (work_id, category_id) VALUES (?, ?)`
        ).bind('WORK-BUG', 'CAT-BUG'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_task_category (work_id, category_id) VALUES (?, ?)`
        ).bind('WORK-FEAT', 'CAT-FEAT'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-BUG', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-FEAT', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-BUG',
          'WORK-BUG',
          'Task',
          '완료',
          '2025-01-20T10:00:00Z',
          '2025-01-20T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-FEAT',
          'WORK-FEAT',
          'Task',
          '완료',
          '2025-01-20T10:00:00Z',
          '2025-01-20T10:00:00Z'
        ),
      ]);

      // Act: Query only bug fix work notes
      const results = await repo.findCompletedWorkNotes('2025-01-01', '2025-01-31', {
        categoryId: 'CAT-BUG',
      });

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].workId).toBe('WORK-BUG');
    });
  });

  describe('calculateStatistics', () => {
    beforeEach(async () => {
      // Arrange: Set up test data
      await testEnv.DB.batch([
        testEnv.DB.prepare(`INSERT INTO departments (dept_name, description) VALUES (?, ?)`).bind(
          '개발팀',
          'Development'
        ),
        testEnv.DB.prepare(`INSERT INTO departments (dept_name, description) VALUES (?, ?)`).bind(
          '기획팀',
          'Planning'
        ),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P001', '개발자A', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P002', '개발자B', '개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO persons (person_id, name, current_dept) VALUES (?, ?, ?)`
        ).bind('P003', '기획자', '기획팀'),
        testEnv.DB.prepare(
          `INSERT INTO task_categories (category_id, name, created_at) VALUES (?, ?, ?)`
        ).bind('CAT-BUG', '버그수정', '2025-01-01T00:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO task_categories (category_id, name, created_at) VALUES (?, ?, ?)`
        ).bind('CAT-FEAT', '기능개발', '2025-01-01T00:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', 'Work 1', 'Content', '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-002', 'Work 2', 'Content', '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-003', 'Work 3', 'Content', '2025-01-15T10:00:00Z', '2025-01-15T10:00:00Z'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_task_category (work_id, category_id) VALUES (?, ?)`
        ).bind('WORK-001', 'CAT-BUG'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_task_category (work_id, category_id) VALUES (?, ?)`
        ).bind('WORK-002', 'CAT-BUG'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_task_category (work_id, category_id) VALUES (?, ?)`
        ).bind('WORK-003', 'CAT-FEAT'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-001', 'P001', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-002', 'P002', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO work_note_person (work_id, person_id, role) VALUES (?, ?, ?)`
        ).bind('WORK-003', 'P003', 'OWNER'),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-001',
          'WORK-001',
          'Task 1',
          '완료',
          '2025-01-20T10:00:00Z',
          '2025-01-20T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-002',
          'WORK-001',
          'Task 2',
          '완료',
          '2025-01-20T10:00:00Z',
          '2025-01-20T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-003',
          'WORK-001',
          'Task 3',
          '진행중',
          '2025-01-20T10:00:00Z',
          '2025-01-20T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-004',
          'WORK-002',
          'Task 1',
          '완료',
          '2025-01-20T10:00:00Z',
          '2025-01-20T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-005',
          'WORK-003',
          'Task 1',
          '완료',
          '2025-01-20T10:00:00Z',
          '2025-01-20T10:00:00Z'
        ),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          'TODO-006',
          'WORK-003',
          'Task 2',
          '보류',
          '2025-01-20T10:00:00Z',
          '2025-01-20T10:00:00Z'
        ),
      ]);
    });

    it('should calculate summary statistics correctly', async () => {
      // Act
      const stats = await repo.calculateStatistics('2025-01-01', '2025-01-31');

      // Assert
      expect(stats.summary.totalWorkNotes).toBe(3);
      expect(stats.summary.totalCompletedTodos).toBe(4);
      expect(stats.summary.totalTodos).toBe(6);
      expect(stats.summary.completionRate).toBeCloseTo(66.67, 1); // 4/6 * 100
    });

    it('should calculate category distribution correctly with names', async () => {
      // Act
      const stats = await repo.calculateStatistics('2025-01-01', '2025-01-31');

      // Assert
      expect(stats.distributions.byCategory).toHaveLength(2);
      const bugCategory = stats.distributions.byCategory.find((c) => c.categoryId === 'CAT-BUG');
      const featCategory = stats.distributions.byCategory.find((c) => c.categoryId === 'CAT-FEAT');
      expect(bugCategory?.count).toBe(2);
      expect(featCategory?.count).toBe(1);
      expect(bugCategory?.categoryName).toBe('버그수정');
      expect(featCategory?.categoryName).toBe('기능개발');
    });

    it('should calculate person distribution correctly', async () => {
      // Act
      const stats = await repo.calculateStatistics('2025-01-01', '2025-01-31');

      // Assert
      expect(stats.distributions.byPerson).toHaveLength(3);
      const person1 = stats.distributions.byPerson.find((p) => p.personId === 'P001');
      const person2 = stats.distributions.byPerson.find((p) => p.personId === 'P002');
      const person3 = stats.distributions.byPerson.find((p) => p.personId === 'P003');
      expect(person1?.count).toBe(1);
      expect(person1?.personName).toBe('개발자A');
      expect(person2?.count).toBe(1);
      expect(person3?.count).toBe(1);
    });

    it('should calculate department distribution correctly', async () => {
      // Act
      const stats = await repo.calculateStatistics('2025-01-01', '2025-01-31');

      // Assert
      expect(stats.distributions.byDepartment).toHaveLength(2);
      const devDept = stats.distributions.byDepartment.find((d) => d.deptName === '개발팀');
      const planDept = stats.distributions.byDepartment.find((d) => d.deptName === '기획팀');
      expect(devDept?.count).toBe(2);
      expect(planDept?.count).toBe(1);
    });

    it('should include work notes in statistics', async () => {
      // Act
      const stats = await repo.calculateStatistics('2025-01-01', '2025-01-31');

      // Assert
      expect(stats.workNotes).toHaveLength(3);
      expect(stats.workNotes[0]).toHaveProperty('completedTodoCount');
      expect(stats.workNotes[0]).toHaveProperty('totalTodoCount');
      expect(stats.workNotes[0]).toHaveProperty('assignedPersons');
      expect(stats.workNotes[0]).toHaveProperty('categoryName');
    });
  });
});
