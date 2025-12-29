// Trace: spec_id=SPEC-project-1, task_id=TASK-036
// Unit tests for ProjectRepository

import type { CreateProjectData, UpdateProjectData } from '@shared/types/project';
import { ProjectRepository } from '@worker/repositories/project-repository';
import type { Env } from '@worker/types/env';
import { ConflictError, NotFoundError } from '@worker/types/errors';

describe('ProjectRepository', () => {
  let repository: ProjectRepository;

  beforeEach(async () => {
    const getDB = (global as any).getDB;
    const db = await getDB();
    repository = new ProjectRepository(db);

    // Clean up test data in proper order (respecting FK constraints)
    await db.batch([
      db.prepare('DELETE FROM project_files'),
      db.prepare('DELETE FROM project_work_notes'),
      db.prepare('DELETE FROM project_participants'),
      db.prepare('DELETE FROM projects'),
      db.prepare('DELETE FROM todos'),
      db.prepare('DELETE FROM work_note_person'),
      db.prepare('DELETE FROM work_notes'),
      db.prepare('DELETE FROM person_dept_history'),
      db.prepare('DELETE FROM persons'),
      db.prepare('DELETE FROM departments'),
    ]);
  });

  describe('findById()', () => {
    it('should find project by ID', async () => {
      // Arrange
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      await db
        .prepare(
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
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      await db
        .prepare(
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
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      await db.batch([
        db.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind('개발팀'),
        db
          .prepare(
            'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
          )
          .bind('PERSON-001', '홍길동', now, now),
        db
          .prepare(
            `INSERT INTO projects (
						project_id, name, description, status, tags, priority,
						start_date, target_end_date, actual_end_date,
						leader_person_id, dept_name, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
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
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      await db.batch([
        db.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind('개발팀'),
        db.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind('기획팀'),
        db
          .prepare(
            'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
          )
          .bind('PERSON-001', '홍길동', now, now),
        db
          .prepare(
            'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
          )
          .bind('PERSON-002', '이순신', now, now),
        db
          .prepare(
            `INSERT INTO projects (
						project_id, name, status, leader_person_id, dept_name, start_date, target_end_date, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
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
        db
          .prepare(
            `INSERT INTO projects (
						project_id, name, status, leader_person_id, dept_name, start_date, target_end_date, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
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
        db
          .prepare(
            `INSERT INTO projects (
						project_id, name, status, leader_person_id, dept_name, start_date, target_end_date, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
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
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      await db
        .prepare(
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

    it('should exclude deleted projects by default', async () => {
      // Arrange
      const getDB = (global as any).getDB;
      const db = await getDB();
      await db
        .prepare(`UPDATE projects SET deleted_at = ? WHERE project_id = ?`)
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
      const getDB = (global as any).getDB;
      const db = await getDB();
      await db
        .prepare(`UPDATE projects SET deleted_at = ? WHERE project_id = ?`)
        .bind(new Date().toISOString(), 'PROJECT-101')
        .run();

      // Act
      const result = await repository.findAll({ includeDeleted: true });

      // Assert
      expect(result).toHaveLength(3);
      expect(result.map((p) => p.projectId)).toContain('PROJECT-101');
    });
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
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      await db.batch([
        db.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind('개발팀'),
        db
          .prepare(
            'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
          )
          .bind('PERSON-001', '홍길동', now, now),
      ]);

      const data: CreateProjectData = {
        name: '전체 필드 프로젝트',
        description: '상세 설명',
        status: '진행중',
        tags: '태그1,태그2',
        priority: '높음',
        startDate: '2025-01-01',
        targetEndDate: '2025-12-31',
        leaderPersonId: 'PERSON-001',
        deptName: '개발팀',
      };

      // Act
      const result = await repository.create(data);

      // Assert
      expect(result.name).toBe('전체 필드 프로젝트');
      expect(result.description).toBe('상세 설명');
      expect(result.status).toBe('진행중');
      expect(result.tags).toBe('태그1,태그2');
      expect(result.priority).toBe('높음');
      expect(result.startDate).toBe('2025-01-01');
      expect(result.targetEndDate).toBe('2025-12-31');
      expect(result.leaderPersonId).toBe('PERSON-001');
      expect(result.deptName).toBe('개발팀');
    });

    it('should create project with participants', async () => {
      // Arrange
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      await db.batch([
        db
          .prepare(
            'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
          )
          .bind('PERSON-001', '홍길동', now, now),
        db
          .prepare(
            'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
          )
          .bind('PERSON-002', '이순신', now, now),
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
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      projectId = 'PROJECT-UPDATE-001';
      await db
        .prepare(
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
        priority: '높음',
      };

      // Act
      const result = await repository.update(projectId, data);

      // Assert
      expect(result.name).toBe('새 이름');
      expect(result.description).toBe('새 설명');
      expect(result.status).toBe('완료');
      expect(result.priority).toBe('높음');
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
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      projectId = 'PROJECT-DELETE-001';
      await db
        .prepare(
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
      const getDB = (global as any).getDB;
      const db = await getDB();
      const deleted = await db
        .prepare(`SELECT deleted_at FROM projects WHERE project_id = ?`)
        .bind(projectId)
        .first();
      expect(deleted?.deleted_at).toBeDefined();
    });

    it('should throw NotFoundError for non-existent project', async () => {
      // Act & Assert
      await expect(repository.delete('NONEXISTENT')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getParticipants()', () => {
    it('should return participants with person details', async () => {
      // Arrange
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      await db.batch([
        db.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind('개발팀'),
        db
          .prepare(
            'INSERT INTO persons (person_id, name, current_dept, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          )
          .bind('PERSON-001', '홍길동', '개발팀', now, now),
        db
          .prepare(
            'INSERT INTO persons (person_id, name, current_dept, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          )
          .bind('PERSON-002', '이순신', '개발팀', now, now),
        db
          .prepare(
            `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
          )
          .bind('PROJECT-PART-001', '팀 프로젝트', '진행중', now, now),
        db
          .prepare(
            `INSERT INTO project_participants (project_id, person_id, role, joined_at) VALUES (?, ?, ?, ?)`
          )
          .bind('PROJECT-PART-001', 'PERSON-001', '리더', now),
        db
          .prepare(
            `INSERT INTO project_participants (project_id, person_id, role, joined_at) VALUES (?, ?, ?, ?)`
          )
          .bind('PROJECT-PART-001', 'PERSON-002', '참여자', now),
      ]);

      // Act
      const result = await repository.getParticipants('PROJECT-PART-001');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].personName).toBeDefined();
      expect(result[0].currentDept).toBe('개발팀');
      expect(result.map((p) => p.role).sort()).toEqual(['리더', '참여자'].sort());
    });

    it('should return empty array for project with no participants', async () => {
      // Arrange
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        )
        .bind('PROJECT-EMPTY', '빈 프로젝트', '진행중', now, now)
        .run();

      // Act
      const result = await repository.getParticipants('PROJECT-EMPTY');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('addParticipant()', () => {
    let projectId: string;

    beforeEach(async () => {
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      projectId = 'PROJECT-ADD-PART';
      await db.batch([
        db
          .prepare(
            'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
          )
          .bind('PERSON-001', '홍길동', now, now),
        db
          .prepare(
            `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
          )
          .bind(projectId, '참여자 추가 테스트', '진행중', now, now),
      ]);
    });

    it('should add participant with default role', async () => {
      // Act
      await repository.addParticipant(projectId, 'PERSON-001');

      // Assert
      const participants = await repository.getParticipants(projectId);
      expect(participants).toHaveLength(1);
      expect(participants[0].personId).toBe('PERSON-001');
      expect(participants[0].role).toBe('참여자');
    });

    it('should add participant with custom role', async () => {
      // Act
      await repository.addParticipant(projectId, 'PERSON-001', '검토자');

      // Assert
      const participants = await repository.getParticipants(projectId);
      expect(participants[0].role).toBe('검토자');
    });

    it('should throw ConflictError when adding duplicate participant', async () => {
      // Arrange
      await repository.addParticipant(projectId, 'PERSON-001');

      // Act & Assert
      await expect(repository.addParticipant(projectId, 'PERSON-001')).rejects.toThrow(
        ConflictError
      );
    });
  });

  describe('removeParticipant()', () => {
    it('should remove participant from project', async () => {
      // Arrange
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      await db.batch([
        db
          .prepare(
            'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
          )
          .bind('PERSON-001', '홍길동', now, now),
        db
          .prepare(
            `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
          )
          .bind('PROJECT-RM-PART', '참여자 제거 테스트', '진행중', now, now),
        db
          .prepare(
            `INSERT INTO project_participants (project_id, person_id, role, joined_at) VALUES (?, ?, ?, ?)`
          )
          .bind('PROJECT-RM-PART', 'PERSON-001', '참여자', now),
      ]);

      // Act
      await repository.removeParticipant('PROJECT-RM-PART', 'PERSON-001');

      // Assert
      const participants = await repository.getParticipants('PROJECT-RM-PART');
      expect(participants).toEqual([]);
    });
  });

  describe('getStatistics()', () => {
    it('should return statistics for project with work notes and todos', async () => {
      // Arrange
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      await db.batch([
        // Create project
        db
          .prepare(
            `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
          )
          .bind('PROJECT-STATS', '통계 테스트', '진행중', now, now),

        // Create work notes
        db
          .prepare(
            `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
          )
          .bind('WORK-001', '업무1', '내용1', now, now),
        db
          .prepare(
            `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
          )
          .bind('WORK-002', '업무2', '내용2', now, now),

        // Associate work notes with project
        db
          .prepare(
            `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
          )
          .bind('PROJECT-STATS', 'WORK-001', now),
        db
          .prepare(
            `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
          )
          .bind('PROJECT-STATS', 'WORK-002', now),

        // Create todos
        db
          .prepare(
            `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind('TODO-001', 'WORK-001', '할일1', '완료', now, now),
        db
          .prepare(
            `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind('TODO-002', 'WORK-001', '할일2', '진행중', now, now),
        db
          .prepare(
            `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind('TODO-003', 'WORK-002', '할일3', '보류', now, now),

        // Create files
        db
          .prepare(
            `INSERT INTO project_files (
						file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            'FILE-001',
            'PROJECT-STATS',
            'projects/PROJECT-STATS/files/FILE-001',
            'test.pdf',
            'application/pdf',
            1024,
            'test@example.com',
            now
          ),
        db
          .prepare(
            `INSERT INTO project_files (
						file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            'FILE-002',
            'PROJECT-STATS',
            'projects/PROJECT-STATS/files/FILE-002',
            'test.png',
            'image/png',
            2048,
            'test@example.com',
            now
          ),
      ]);

      // Act
      const result = await repository.getStatistics('PROJECT-STATS');

      // Assert
      expect(result.projectId).toBe('PROJECT-STATS');
      expect(result.totalWorkNotes).toBe(2);
      expect(result.totalTodos).toBe(3);
      expect(result.completedTodos).toBe(1);
      expect(result.pendingTodos).toBe(1);
      expect(result.onHoldTodos).toBe(1);
      expect(result.totalFiles).toBe(2);
      expect(result.totalFileSize).toBe(3072); // 1024 + 2048
      expect(result.lastActivity).toBeDefined();
    });

    it('should return zero statistics for empty project', async () => {
      // Arrange
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        )
        .bind('PROJECT-EMPTY-STATS', '빈 프로젝트', '진행중', now, now)
        .run();

      // Act
      const result = await repository.getStatistics('PROJECT-EMPTY-STATS');

      // Assert
      expect(result.totalWorkNotes).toBe(0);
      expect(result.totalTodos).toBe(0);
      expect(result.completedTodos).toBe(0);
      expect(result.pendingTodos).toBe(0);
      expect(result.onHoldTodos).toBe(0);
      expect(result.totalFiles).toBe(0);
      expect(result.totalFileSize).toBe(0);
      expect(result.lastActivity).toBeNull();
    });
  });

  describe('getDetail()', () => {
    it('should return project detail with all associations', async () => {
      // Arrange
      const getDB = (global as any).getDB;
      const db = await getDB();
      const now = new Date().toISOString();
      await db.batch([
        db
          .prepare(
            'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
          )
          .bind('PERSON-001', '홍길동', now, now),
        db
          .prepare(
            `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
          )
          .bind('PROJECT-DETAIL', '상세 테스트', '진행중', now, now),
        db
          .prepare(
            `INSERT INTO project_participants (project_id, person_id, role, joined_at) VALUES (?, ?, ?, ?)`
          )
          .bind('PROJECT-DETAIL', 'PERSON-001', '참여자', now),
        db
          .prepare(
            `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
          )
          .bind('WORK-001', '업무1', '내용1', now, now),
        db
          .prepare(
            `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
          )
          .bind('PROJECT-DETAIL', 'WORK-001', now),
        db
          .prepare(
            `INSERT INTO project_files (
						file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            'FILE-001',
            'PROJECT-DETAIL',
            'projects/PROJECT-DETAIL/files/FILE-001',
            'test.pdf',
            'application/pdf',
            1024,
            'test@example.com',
            now
          ),
      ]);

      // Act
      const result = await repository.getDetail('PROJECT-DETAIL');

      // Assert
      expect(result).not.toBeNull();
      expect(result?.projectId).toBe('PROJECT-DETAIL');
      expect(result?.participants).toHaveLength(1);
      expect(result?.workNotes).toHaveLength(1);
      expect(result?.files).toHaveLength(1);
      expect(result?.stats).toBeDefined();
      expect(result?.stats.totalWorkNotes).toBe(1);
      expect(result?.stats.totalFiles).toBe(1);
    });

    it('should return null for non-existent project', async () => {
      // Act
      const result = await repository.getDetail('NONEXISTENT');

      // Assert
      expect(result).toBeNull();
    });
  });
});
