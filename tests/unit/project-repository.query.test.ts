// Trace: Test coverage improvement
// Unit tests for ProjectRepository - Query operations (findById, findAll)

import { env } from 'cloudflare:test';
import { ProjectRepository } from '@worker/repositories/project-repository';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;

describe('ProjectRepository - Query operations', () => {
  let repository: ProjectRepository;

  beforeEach(async () => {
    repository = new ProjectRepository(testEnv.DB);

    // Clean up test data in proper order (respecting FK constraints)
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM project_files'),
      testEnv.DB.prepare('DELETE FROM project_work_notes'),
      testEnv.DB.prepare('DELETE FROM project_participants'),
      testEnv.DB.prepare('DELETE FROM projects'),
      testEnv.DB.prepare('DELETE FROM todos'),
      testEnv.DB.prepare('DELETE FROM work_note_person'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM person_dept_history'),
      testEnv.DB.prepare('DELETE FROM persons'),
      testEnv.DB.prepare('DELETE FROM departments'),
    ]);
  });

  describe('findById()', () => {
    it('should find project by ID', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        `INSERT INTO projects (
          project_id, name, description, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind('PROJECT-001', '테스트 프로젝트', '테스트 설명', '진행중', now, now)
        .run();

      // Act
      const result = await repository.findById('PROJECT-001');

      // Assert
      expect(result).not.toBeNull();
      expect(result?.projectId).toBe('PROJECT-001');
      expect(result?.name).toBe('테스트 프로젝트');
      expect(result?.description).toBe('테스트 설명');
      expect(result?.status).toBe('진행중');
    });

    it('should return null for non-existent project', async () => {
      // Act
      const result = await repository.findById('NONEXISTENT');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for soft-deleted project', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        `INSERT INTO projects (
          project_id, name, status, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind('PROJECT-002', '삭제된 프로젝트', '진행중', now, now, now)
        .run();

      // Act
      const result = await repository.findById('PROJECT-002');

      // Assert
      expect(result).toBeNull();
    });

    it('should include all project fields including dates and foreign keys', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind('개발팀'),
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-001', '홍길동', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (
            project_id, name, description, status, tags, priority,
            start_date, target_end_date, actual_end_date,
            leader_person_id, dept_name, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'PROJECT-003',
          '전체 필드 프로젝트',
          '전체 필드 테스트',
          '완료',
          '태그1,태그2',
          '높음',
          '2025-01-01',
          '2025-12-31',
          '2025-12-30',
          'PERSON-001',
          '개발팀',
          now,
          now
        ),
      ]);

      // Act
      const result = await repository.findById('PROJECT-003');

      // Assert
      expect(result?.tags).toBe('태그1,태그2');
      expect(result?.priority).toBe('높음');
      expect(result?.startDate).toBe('2025-01-01');
      expect(result?.targetEndDate).toBe('2025-12-31');
      expect(result?.actualEndDate).toBe('2025-12-30');
      expect(result?.leaderPersonId).toBe('PERSON-001');
      expect(result?.deptName).toBe('개발팀');
      expect(result?.status).toBe('완료');
    });
  });

  describe('findAll()', () => {
    beforeEach(async () => {
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind('개발팀'),
        testEnv.DB.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind('기획팀'),
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-001', '홍길동', now, now),
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-002', '이순신', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (
            project_id, name, status, leader_person_id, dept_name, start_date, target_end_date, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'PROJECT-101',
          '프로젝트1',
          '진행중',
          'PERSON-001',
          '개발팀',
          '2025-01-01',
          '2025-06-30',
          now,
          now
        ),
        testEnv.DB.prepare(
          `INSERT INTO projects (
            project_id, name, status, leader_person_id, dept_name, start_date, target_end_date, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'PROJECT-102',
          '프로젝트2',
          '완료',
          'PERSON-002',
          '기획팀',
          '2025-02-01',
          '2025-07-31',
          now,
          now
        ),
        testEnv.DB.prepare(
          `INSERT INTO projects (
            project_id, name, status, leader_person_id, dept_name, start_date, target_end_date, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'PROJECT-103',
          '프로젝트3',
          '보류',
          'PERSON-001',
          '개발팀',
          '2025-03-01',
          '2025-08-31',
          now,
          now
        ),
      ]);
    });

    it('should return all projects without filters', async () => {
      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toHaveLength(3);
      expect(result.map((p) => p.projectId)).toEqual(
        expect.arrayContaining(['PROJECT-101', 'PROJECT-102', 'PROJECT-103'])
      );
    });

    it('should filter by status', async () => {
      // Act
      const result = await repository.findAll({ status: '진행중' });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe('PROJECT-101');
      expect(result[0].status).toBe('진행중');
    });

    it('should filter by leader person ID', async () => {
      // Act
      const result = await repository.findAll({ leaderPersonId: 'PERSON-001' });

      // Assert
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.leaderPersonId)).toEqual(
        ['PROJECT-103', 'PROJECT-101'].map(() => 'PERSON-001')
      );
    });

    it('should filter by department', async () => {
      // Act
      const result = await repository.findAll({ deptName: '기획팀' });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe('PROJECT-102');
      expect(result[0].deptName).toBe('기획팀');
    });

    it('should filter by participant person ID', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        `INSERT INTO project_participants (project_id, person_id, role, joined_at) VALUES (?, ?, ?, ?)`
      )
        .bind('PROJECT-102', 'PERSON-001', '참여자', now)
        .run();

      // Act
      const result = await repository.findAll({ participantPersonId: 'PERSON-001' });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe('PROJECT-102');
    });

    it('should filter by date range', async () => {
      // Act
      const result = await repository.findAll({
        startDateFrom: '2025-02-01',
        startDateTo: '2025-03-31',
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.projectId).sort()).toEqual(['PROJECT-102', 'PROJECT-103']);
    });

    it('should include same-day datetime values when startDateTo is date-only', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        `INSERT INTO projects (
          project_id, name, status, start_date, target_end_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          'PROJECT-104',
          '프로젝트4',
          '진행중',
          '2025-03-31T12:00:00.000Z',
          '2025-09-01',
          now,
          now
        )
        .run();

      // Act
      const result = await repository.findAll({ startDateTo: '2025-03-31' });

      // Assert
      expect(result.map((p) => p.projectId)).toContain('PROJECT-104');
    });

    it('should include same-day datetime values when targetEndDateTo is date-only', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        `INSERT INTO projects (
          project_id, name, status, start_date, target_end_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          'PROJECT-105',
          '프로젝트5',
          '진행중',
          '2025-04-01',
          '2025-07-31T18:30:00.000Z',
          now,
          now
        )
        .run();

      // Act
      const result = await repository.findAll({ targetEndDateTo: '2025-07-31' });

      // Assert
      expect(result.map((p) => p.projectId)).toContain('PROJECT-105');
    });

    it('should exclude deleted projects by default', async () => {
      // Arrange
      await testEnv.DB.prepare(`UPDATE projects SET deleted_at = ? WHERE project_id = ?`)
        .bind(new Date().toISOString(), 'PROJECT-101')
        .run();

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.projectId)).not.toContain('PROJECT-101');
    });

    it('should include deleted projects when requested', async () => {
      // Arrange
      await testEnv.DB.prepare(`UPDATE projects SET deleted_at = ? WHERE project_id = ?`)
        .bind(new Date().toISOString(), 'PROJECT-101')
        .run();

      // Act
      const result = await repository.findAll({ includeDeleted: true });

      // Assert
      expect(result).toHaveLength(3);
      expect(result.map((p) => p.projectId)).toContain('PROJECT-101');
    });
  });
});
