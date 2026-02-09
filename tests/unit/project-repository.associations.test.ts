// Trace: Test coverage improvement
// Unit tests for ProjectRepository - Associations and statistics

import { env } from 'cloudflare:test';
import { ProjectRepository } from '@worker/repositories/project-repository';
import type { Env } from '@worker/types/env';
import { ConflictError } from '@worker/types/errors';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;

describe('ProjectRepository - Associations and statistics', () => {
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

  describe('getParticipants()', () => {
    it('should return participants with person details', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind('개발팀'),
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, current_dept, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).bind('PERSON-001', '홍길동', '개발팀', now, now),
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, current_dept, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).bind('PERSON-002', '이순신', '개발팀', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-PART-001', '팀 프로젝트', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_participants (project_id, person_id, role, joined_at) VALUES (?, ?, ?, ?)`
        ).bind('PROJECT-PART-001', 'PERSON-001', '리더', now),
        testEnv.DB.prepare(
          `INSERT INTO project_participants (project_id, person_id, role, joined_at) VALUES (?, ?, ?, ?)`
        ).bind('PROJECT-PART-001', 'PERSON-002', '참여자', now),
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
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
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
      const now = new Date().toISOString();
      projectId = 'PROJECT-ADD-PART';
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-001', '홍길동', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(projectId, '참여자 추가 테스트', '진행중', now, now),
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
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-001', '홍길동', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-RM-PART', '참여자 제거 테스트', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_participants (project_id, person_id, role, joined_at) VALUES (?, ?, ?, ?)`
        ).bind('PROJECT-RM-PART', 'PERSON-001', '참여자', now),
      ]);

      // Act
      await repository.removeParticipant('PROJECT-RM-PART', 'PERSON-001');

      // Assert
      const participants = await repository.getParticipants('PROJECT-RM-PART');
      expect(participants).toEqual([]);
    });
  });

  describe('getFiles()', () => {
    it('maps storageType and Drive metadata for mixed rows and normalizes unknown storage types to R2', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-FILES-MIXED', '파일 매핑 테스트', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_files (
            file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'FILE-R2-001',
          'PROJECT-FILES-MIXED',
          'projects/PROJECT-FILES-MIXED/files/FILE-R2-001',
          'legacy.pdf',
          'application/pdf',
          111,
          'tester@example.com',
          now
        ),
        testEnv.DB.prepare(
          `INSERT INTO project_files (
            file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at,
            storage_type, gdrive_file_id, gdrive_folder_id, gdrive_web_view_link
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'FILE-DRIVE-001',
          'PROJECT-FILES-MIXED',
          '',
          'drive.pdf',
          'application/pdf',
          222,
          'tester@example.com',
          now,
          'GDRIVE',
          'GFILE-001',
          'GFOLDER-001',
          'https://drive.example/file/1'
        ),
        testEnv.DB.prepare(
          `INSERT INTO project_files (
            file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, storage_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'FILE-UNKNOWN-001',
          'PROJECT-FILES-MIXED',
          'projects/PROJECT-FILES-MIXED/files/FILE-UNKNOWN-001',
          'unknown.bin',
          'application/octet-stream',
          333,
          'tester@example.com',
          now,
          'DROPBOX'
        ),
      ]);

      // Act
      const result = await repository.getFiles('PROJECT-FILES-MIXED');
      const r2File = result.find((file) => file.fileId === 'FILE-R2-001');
      const driveFile = result.find((file) => file.fileId === 'FILE-DRIVE-001');
      const unknownStorageFile = result.find((file) => file.fileId === 'FILE-UNKNOWN-001');

      // Assert
      expect(result).toHaveLength(3);
      expect(r2File).toMatchObject({
        storageType: 'R2',
        gdriveFileId: null,
        gdriveFolderId: null,
        gdriveWebViewLink: null,
      });
      expect(driveFile).toMatchObject({
        storageType: 'GDRIVE',
        gdriveFileId: 'GFILE-001',
        gdriveFolderId: 'GFOLDER-001',
        gdriveWebViewLink: 'https://drive.example/file/1',
      });
      expect(unknownStorageFile).toMatchObject({
        storageType: 'R2',
        gdriveFileId: null,
        gdriveFolderId: null,
        gdriveWebViewLink: null,
      });
    });
  });

  describe('getStatistics()', () => {
    it('should return statistics for project with work notes and todos', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        // Create project
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-STATS', '통계 테스트', '진행중', now, now),

        // Create work notes
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', '업무1', '내용1', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-002', '업무2', '내용2', now, now),

        // Associate work notes with project
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind('PROJECT-STATS', 'WORK-001', now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind('PROJECT-STATS', 'WORK-002', now),

        // Create todos
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('TODO-001', 'WORK-001', '할일1', '완료', now, now),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('TODO-002', 'WORK-001', '할일2', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('TODO-003', 'WORK-002', '할일3', '보류', now, now),

        // Create files
        testEnv.DB.prepare(
          `INSERT INTO project_files (
            file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'FILE-001',
          'PROJECT-STATS',
          'projects/PROJECT-STATS/files/FILE-001',
          'test.pdf',
          'application/pdf',
          1024,
          'test@example.com',
          now
        ),
        testEnv.DB.prepare(
          `INSERT INTO project_files (
            file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
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
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
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

    it('includes both legacy R2 and GDRIVE active files in totalFiles and totalFileSize', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-STATS-MIXED', '혼합 스토리지 통계', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_files (
            file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at, storage_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'FILE-R2-STATS-1',
          'PROJECT-STATS-MIXED',
          'projects/PROJECT-STATS-MIXED/files/FILE-R2-STATS-1',
          'legacy.pdf',
          'application/pdf',
          1024,
          'tester@example.com',
          now,
          'R2'
        ),
        testEnv.DB.prepare(
          `INSERT INTO project_files (
            file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at,
            storage_type, gdrive_file_id, gdrive_folder_id, gdrive_web_view_link
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'FILE-DRIVE-STATS-1',
          'PROJECT-STATS-MIXED',
          '',
          'drive.pdf',
          'application/pdf',
          2048,
          'tester@example.com',
          now,
          'GDRIVE',
          'GFILE-STATS-1',
          'GFOLDER-STATS-1',
          'https://drive.example/stats-file'
        ),
        testEnv.DB.prepare(
          `INSERT INTO project_files (
            file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at,
            storage_type, gdrive_file_id, deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'FILE-DRIVE-DELETED',
          'PROJECT-STATS-MIXED',
          '',
          'deleted.pdf',
          'application/pdf',
          4096,
          'tester@example.com',
          now,
          'GDRIVE',
          'GFILE-DELETED',
          now
        ),
      ]);

      // Act
      const result = await repository.getStatistics('PROJECT-STATS-MIXED');

      // Assert
      expect(result.totalFiles).toBe(2);
      expect(result.totalFileSize).toBe(3072);
    });
  });

  describe('getDetail()', () => {
    it('should return project detail with all associations', async () => {
      // Arrange
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-001', '홍길동', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-DETAIL', '상세 테스트', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_participants (project_id, person_id, role, joined_at) VALUES (?, ?, ?, ?)`
        ).bind('PROJECT-DETAIL', 'PERSON-001', '참여자', now),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', '업무1', '내용1', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind('PROJECT-DETAIL', 'WORK-001', now),
        testEnv.DB.prepare(
          `INSERT INTO project_files (
            file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
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
