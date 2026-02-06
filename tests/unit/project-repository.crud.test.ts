// Trace: Test coverage improvement
// Unit tests for ProjectRepository - CRUD operations (create, update, delete)

import { env } from 'cloudflare:test';
import type { CreateProjectData, UpdateProjectData } from '@shared/types/project';
import { ProjectRepository } from '@worker/repositories/project-repository';
import type { Env } from '@worker/types/env';
import { NotFoundError } from '@worker/types/errors';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;

describe('ProjectRepository - CRUD operations', () => {
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

  describe('create()', () => {
    it('should create project with required fields only', async () => {
      // Arrange
      const data: CreateProjectData = {
        name: '최소 프로젝트',
      };

      // Act
      const result = await repository.create(data);

      // Assert
      expect(result).toBeDefined();
      expect(result.projectId).toMatch(/^PROJECT-/);
      expect(result.name).toBe('최소 프로젝트');
      expect(result.status).toBe('진행중'); // Default status
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should create project with all fields', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind('개발팀'),
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-001', '홍길동', now, now),
      ]);

      const data: CreateProjectData = {
        name: '전체 필드 프로젝트',
        description: '상세 설명',
        status: '진행중',
        tags: '태그1,태그2',
        startDate: '2025-01-01',
        deptName: '개발팀',
      };

      // Act
      const result = await repository.create(data);

      // Assert
      expect(result.name).toBe('전체 필드 프로젝트');
      expect(result.description).toBe('상세 설명');
      expect(result.status).toBe('진행중');
      expect(result.tags).toBe('태그1,태그2');
      expect(result.startDate).toBe('2025-01-01');
      expect(result.deptName).toBe('개발팀');
    });

    it('should create project with participants', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-001', '홍길동', now, now),
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-002', '이순신', now, now),
      ]);

      const data: CreateProjectData = {
        name: '팀 프로젝트',
        participantPersonIds: ['PERSON-001', 'PERSON-002'],
      };

      // Act
      const result = await repository.create(data);

      // Assert
      const participants = await repository.getParticipants(result.projectId);
      expect(participants).toHaveLength(2);
      expect(participants.map((p) => p.personId).sort()).toEqual(['PERSON-001', 'PERSON-002']);
      expect(participants.every((p) => p.role === '참여자')).toBe(true);
    });
  });

  describe('update()', () => {
    let projectId: string;

    beforeEach(async () => {
      const now = new Date().toISOString();
      projectId = 'PROJECT-UPDATE-001';
      await testEnv.DB.prepare(
        `INSERT INTO projects (
          project_id, name, description, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(projectId, '초기 이름', '초기 설명', '진행중', now, now)
        .run();
    });

    it('should update project name', async () => {
      // Arrange
      const data: UpdateProjectData = {
        name: '변경된 이름',
      };

      // Act
      const result = await repository.update(projectId, data);

      // Assert
      expect(result.name).toBe('변경된 이름');
      expect(result.description).toBe('초기 설명'); // Unchanged
    });

    it('should update multiple fields', async () => {
      // Arrange
      const data: UpdateProjectData = {
        name: '새 이름',
        description: '새 설명',
        status: '완료',
      };

      // Act
      const result = await repository.update(projectId, data);

      // Assert
      expect(result.name).toBe('새 이름');
      expect(result.description).toBe('새 설명');
      expect(result.status).toBe('완료');
    });

    it('should update status and actualEndDate', async () => {
      // Arrange
      const data: UpdateProjectData = {
        status: '완료',
        actualEndDate: '2025-06-15',
      };

      // Act
      const result = await repository.update(projectId, data);

      // Assert
      expect(result.status).toBe('완료');
      expect(result.actualEndDate).toBe('2025-06-15');
    });

    it('should throw NotFoundError for non-existent project', async () => {
      // Arrange
      const data: UpdateProjectData = { name: '새 이름' };

      // Act & Assert
      await expect(repository.update('NONEXISTENT', data)).rejects.toThrow(NotFoundError);
    });

    it('should return unchanged project when no updates provided', async () => {
      // Arrange
      const data: UpdateProjectData = {};

      // Act
      const result = await repository.update(projectId, data);

      // Assert
      expect(result.name).toBe('초기 이름');
      expect(result.description).toBe('초기 설명');
    });
  });

  describe('delete()', () => {
    let projectId: string;

    beforeEach(async () => {
      const now = new Date().toISOString();
      projectId = 'PROJECT-DELETE-001';
      await testEnv.DB.prepare(
        `INSERT INTO projects (
          project_id, name, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?)`
      )
        .bind(projectId, '삭제 테스트', '진행중', now, now)
        .run();
    });

    it('should soft delete project', async () => {
      // Act
      await repository.delete(projectId);

      // Assert
      const result = await repository.findById(projectId);
      expect(result).toBeNull(); // findById excludes deleted

      // Verify deleted_at is set
      const deleted = await testEnv.DB.prepare(
        `SELECT deleted_at FROM projects WHERE project_id = ?`
      )
        .bind(projectId)
        .first<{ deleted_at: string }>();
      expect(deleted?.deleted_at).toBeDefined();
    });

    it('should throw NotFoundError for non-existent project', async () => {
      // Act & Assert
      await expect(repository.delete('NONEXISTENT')).rejects.toThrow(NotFoundError);
    });
  });
});
