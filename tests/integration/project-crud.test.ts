// Trace: SPEC-project-1, TASK-037, TASK-065
// Integration tests for Project API routes (CRUD + stats + file archival)

import type {
  R2Object,
  R2ObjectBody,
  R2PutOptions,
  VectorizeIndex,
} from '@cloudflare/workers-types';
import type { Project, ProjectDetail, ProjectStats } from '@shared/types/project';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authFetch, MockR2, setTestR2Bucket, testEnv } from '../test-setup';

describe('Project API Routes', () => {
  beforeEach(async () => {
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM project_files'),
      testEnv.DB.prepare('DELETE FROM project_work_notes'),
      testEnv.DB.prepare('DELETE FROM project_participants'),
      testEnv.DB.prepare('DELETE FROM todos'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM projects'),
      testEnv.DB.prepare('DELETE FROM persons'),
      testEnv.DB.prepare('DELETE FROM departments'),
    ]);
  });

  describe('POST /api/projects', () => {
    it('should create project with all required fields', async () => {
      const projectData = {
        name: '테스트 프로젝트',
        description: '프로젝트 설명',
        status: '진행중' as const,
      };

      const response = await authFetch('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify(projectData),
      });

      expect(response.status).toBe(201);
      const project = await response.json<Project>();
      expect(project.projectId).toMatch(/^PROJECT-/);
      expect(project.name).toBe(projectData.name);
      expect(project.description).toBe(projectData.description);
      expect(project.status).toBe('진행중');
      expect(project.createdAt).toBeDefined();
    });

    it('should accept ISO date-only string for start date', async () => {
      const projectData = {
        name: '날짜 형식 테스트 프로젝트',
        startDate: '2026-02-04',
      };

      const response = await authFetch('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify(projectData),
      });

      expect(response.status).toBe(201);
      const project = await response.json<Project>();
      expect(project.startDate).toBe('2026-02-04');
    });

    it('should create project with participants', async () => {
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-001', '홍길동', now, now),
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-002', '이순신', now, now),
      ]);

      const projectData = {
        name: '팀 프로젝트',
        participantPersonIds: ['PERSON-001', 'PERSON-002'],
      };

      const response = await authFetch('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify(projectData),
      });

      expect(response.status).toBe(201);
      const project = await response.json<Project>();

      const participantsCheck = await testEnv.DB.prepare(
        'SELECT COUNT(*) as count FROM project_participants WHERE project_id = ?'
      )
        .bind(project.projectId)
        .first<{ count: number }>();
      expect(participantsCheck?.count).toBe(2);
    });

    it('should create project participants from participantIds payload', async () => {
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-101', '강감찬', now, now),
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-102', '유관순', now, now),
      ]);

      const projectData = {
        name: '참가자 필드 별칭 테스트',
        participantIds: ['PERSON-101', 'PERSON-102'],
      };

      const response = await authFetch('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify(projectData),
      });

      expect(response.status).toBe(201);
      const project = await response.json<Project>();

      const participantsCheck = await testEnv.DB.prepare(
        'SELECT COUNT(*) as count FROM project_participants WHERE project_id = ?'
      )
        .bind(project.projectId)
        .first<{ count: number }>();
      expect(participantsCheck?.count).toBe(2);
    });

    it('should merge participant IDs when both participantPersonIds and participantIds are provided', async () => {
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-201', '세종대왕', now, now),
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-202', '장영실', now, now),
      ]);

      const projectData = {
        name: '참가자 병합 테스트',
        participantPersonIds: [],
        participantIds: ['PERSON-201', 'PERSON-202'],
      };

      const response = await authFetch('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify(projectData),
      });

      expect(response.status).toBe(201);
      const project = await response.json<Project>();

      const participantsCheck = await testEnv.DB.prepare(
        'SELECT COUNT(*) as count FROM project_participants WHERE project_id = ?'
      )
        .bind(project.projectId)
        .first<{ count: number }>();
      expect(participantsCheck?.count).toBe(2);
    });

    it('should reject invalid project data', async () => {
      const response = await authFetch('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/projects', () => {
    beforeEach(async () => {
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind('개발팀'),
        testEnv.DB.prepare(
          `INSERT INTO projects (
            project_id, name, status, dept_name, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('PROJECT-001', '프로젝트1', '진행중', '개발팀', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (
            project_id, name, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-002', '프로젝트2', '완료', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (
            project_id, name, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-003', '프로젝트3', '보류', now, now),
      ]);
    });

    it('should list all projects', async () => {
      const response = await authFetch('http://localhost/api/projects');

      expect(response.status).toBe(200);
      const projects = await response.json<Project[]>();
      expect(projects).toHaveLength(3);
    });

    it('should filter projects by status', async () => {
      const response = await authFetch('http://localhost/api/projects?status=진행중');

      expect(response.status).toBe(200);
      const projects = await response.json<Project[]>();
      expect(projects).toHaveLength(1);
      expect(projects[0].status).toBe('진행중');
    });

    it('should filter projects by department', async () => {
      const response = await authFetch('http://localhost/api/projects?deptName=개발팀');

      expect(response.status).toBe(200);
      const projects = await response.json<Project[]>();
      expect(projects).toHaveLength(1);
      expect(projects[0].deptName).toBe('개발팀');
    });
  });

  describe('GET /api/projects/:projectId', () => {
    let projectId: string;

    beforeEach(async () => {
      const now = new Date().toISOString();
      projectId = 'PROJECT-DETAIL-001';
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(projectId, '상세 프로젝트', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', '업무1', '내용1', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-002', '업무2', '내용2', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-003', '업무3', '내용3', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind(projectId, 'WORK-001', now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind(projectId, 'WORK-002', now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind(projectId, 'WORK-003', now),
        testEnv.DB.prepare(
          `INSERT INTO project_files (file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'FILE-001',
          projectId,
          'projects/PROJECT-DETAIL-001/files/FILE-001',
          'a.pdf',
          'application/pdf',
          1024,
          'tester@example.com',
          now
        ),
        testEnv.DB.prepare(
          `INSERT INTO project_files (file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'FILE-002',
          projectId,
          'projects/PROJECT-DETAIL-001/files/FILE-002',
          'b.txt',
          'text/plain',
          2048,
          'tester@example.com',
          now
        ),
      ]);
    });

    it('should return project detail with associations', async () => {
      const response = await authFetch(`http://localhost/api/projects/${projectId}`);

      expect(response.status).toBe(200);
      const project = await response.json<ProjectDetail>();
      expect(project.projectId).toBe(projectId);
      expect(project.name).toBe('상세 프로젝트');
      expect(project.participants).toBeDefined();
      expect(project.workNotes).toBeDefined();
      expect(project.workNotes).toHaveLength(3);
      expect(project.files).toBeDefined();
      expect(project.files).toHaveLength(2);
      expect(project.stats).toBeDefined();
    });

    it('should return 404 for non-existent project', async () => {
      const response = await authFetch('http://localhost/api/projects/NONEXISTENT');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/projects/:projectId', () => {
    let projectId: string;

    beforeEach(async () => {
      const now = new Date().toISOString();
      projectId = 'PROJECT-UPDATE-001';
      await testEnv.DB.prepare(
        `INSERT INTO projects (project_id, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(projectId, '초기 이름', '초기 설명', '진행중', now, now)
        .run();
    });

    it('should update project fields', async () => {
      const updateData = {
        name: '변경된 이름',
        status: '완료' as const,
        actualEndDate: new Date().toISOString(),
      };

      const response = await authFetch(`http://localhost/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const updated = await response.json<Project>();
      expect(updated.name).toBe('변경된 이름');
      expect(updated.status).toBe('완료');
      expect(updated.actualEndDate).toBeDefined();
    });

    it('should return 404 for non-existent project', async () => {
      const response = await authFetch('http://localhost/api/projects/NONEXISTENT', {
        method: 'PUT',
        body: JSON.stringify({ name: '새 이름' }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:projectId', () => {
    let projectId: string;

    beforeEach(async () => {
      const now = new Date().toISOString();
      projectId = 'PROJECT-DELETE-001';
      await testEnv.DB.prepare(
        `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
        .bind(projectId, '삭제 테스트', '진행중', now, now)
        .run();
    });

    it('should soft delete project', async () => {
      const response = await authFetch(`http://localhost/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);

      const deleted = await testEnv.DB.prepare(
        'SELECT deleted_at FROM projects WHERE project_id = ?'
      )
        .bind(projectId)
        .first<{ deleted_at: string }>();
      expect(deleted?.deleted_at).toBeDefined();
    });

    it('should detach work notes when project is soft deleted', async () => {
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, project_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('WORK-DEL-001', '프로젝트 삭제 업무', '내용', projectId, now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind(projectId, 'WORK-DEL-001', now),
      ]);

      const response = await authFetch(`http://localhost/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);

      const association = await testEnv.DB.prepare(
        'SELECT * FROM project_work_notes WHERE project_id = ? AND work_id = ?'
      )
        .bind(projectId, 'WORK-DEL-001')
        .first();
      expect(association).toBeNull();

      const workNote = await testEnv.DB.prepare(
        'SELECT project_id FROM work_notes WHERE work_id = ?'
      )
        .bind('WORK-DEL-001')
        .first<{ project_id: string | null }>();
      expect(workNote?.project_id).toBeNull();
    });

    it('should return 404 for non-existent project', async () => {
      const response = await authFetch('http://localhost/api/projects/NONEXISTENT', {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:projectId with files', () => {
    let projectId: string;
    let r2: MockR2;

    beforeEach(async () => {
      const now = new Date().toISOString();
      projectId = 'PROJECT-DEL-FILES';

      r2 = new MockR2();
      setTestR2Bucket(r2);

      testEnv.VECTORIZE = {
        query: vi.fn().mockResolvedValue({ matches: [] }),
        deleteByIds: vi.fn().mockResolvedValue(undefined),
        upsert: vi.fn().mockResolvedValue(undefined),
      } as unknown as VectorizeIndex;

      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, '진행중', ?, ?)`
        ).bind(projectId, '삭제 파일 프로젝트', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_files (file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'FILE-DEL-1',
          projectId,
          `projects/${projectId}/files/FILE-DEL-1`,
          'report.txt',
          'text/plain',
          10,
          'tester@example.com',
          now
        ),
        testEnv.DB.prepare(
          `INSERT INTO project_files (file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'FILE-DEL-2',
          projectId,
          `projects/${projectId}/files/FILE-DEL-2`,
          'diagram.png',
          'image/png',
          20,
          'tester@example.com',
          now
        ),
      ]);

      r2.storage.set(`projects/${projectId}/files/FILE-DEL-1`, {
        value: new Blob(['hello'], { type: 'text/plain' }),
      });
      r2.storage.set(`projects/${projectId}/files/FILE-DEL-2`, {
        value: new Blob(['img'], { type: 'image/png' }),
      });
    });

    it('archives project files and soft deletes project', async () => {
      const response = await authFetch(`http://localhost/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);

      const project = await testEnv.DB.prepare(
        'SELECT deleted_at FROM projects WHERE project_id = ?'
      )
        .bind(projectId)
        .first<{ deleted_at: string }>();
      expect(project?.deleted_at).toBeDefined();

      const fileRows = await testEnv.DB.prepare(
        'SELECT file_id, deleted_at FROM project_files WHERE project_id = ?'
      )
        .bind(projectId)
        .all<{ file_id: string; deleted_at: string }>();
      fileRows.results?.forEach((row) => {
        expect(row.deleted_at).toBeDefined();
      });

      expect(r2.storage.has(`projects/${projectId}/files/FILE-DEL-1`)).toBe(false);
      expect(r2.storage.has(`projects/${projectId}/files/FILE-DEL-2`)).toBe(false);
      expect(r2.storage.has(`projects/${projectId}/archive/FILE-DEL-1`)).toBe(true);
      expect(r2.storage.has(`projects/${projectId}/archive/FILE-DEL-2`)).toBe(true);
    });

    it('handles partial failures gracefully during archival', async () => {
      class FailingMockR2 extends MockR2 {
        callCount = 0;

        async get(key: string): Promise<R2ObjectBody | null> {
          const result = await super.get(key);
          return result;
        }

        async put(key: string, value: Blob, options?: R2PutOptions): Promise<R2Object | null> {
          this.callCount++;
          if (this.callCount === 2) {
            throw new Error('Simulated R2 failure');
          }
          return super.put(key, value, options);
        }
      }

      const failingR2 = new FailingMockR2();
      setTestR2Bucket(failingR2);

      failingR2.storage.set(`projects/${projectId}/files/FILE-DEL-1`, {
        value: new Blob(['hello'], { type: 'text/plain' }),
      });
      failingR2.storage.set(`projects/${projectId}/files/FILE-DEL-2`, {
        value: new Blob(['img'], { type: 'image/png' }),
      });

      const response = await authFetch(`http://localhost/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);

      const project = await testEnv.DB.prepare(
        'SELECT deleted_at FROM projects WHERE project_id = ?'
      )
        .bind(projectId)
        .first<{ deleted_at: string }>();
      expect(project?.deleted_at).toBeDefined();

      expect(failingR2.storage.has(`projects/${projectId}/archive/FILE-DEL-1`)).toBe(true);
      expect(failingR2.storage.has(`projects/${projectId}/files/FILE-DEL-1`)).toBe(false);
    });

    it('handles case where file exists in DB but not in R2', async () => {
      const response = await authFetch(`http://localhost/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);

      const fileRows = await testEnv.DB.prepare(
        'SELECT file_id, deleted_at FROM project_files WHERE project_id = ?'
      )
        .bind(projectId)
        .all<{ file_id: string; deleted_at: string }>();
      fileRows.results?.forEach((row) => {
        expect(row.deleted_at).toBeDefined();
      });
    });
  });

  describe('GET /api/projects/:projectId/stats', () => {
    let projectId: string;

    beforeEach(async () => {
      const now = new Date().toISOString();
      projectId = 'PROJECT-STATS-001';
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(projectId, '통계 테스트', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', '업무1', '내용1', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind(projectId, 'WORK-001', now),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('TODO-001', 'WORK-001', '할일1', '완료', now, now),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('TODO-002', 'WORK-001', '할일2', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_files (file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'FILE-001',
          projectId,
          'projects/PROJECT-STATS-001/files/FILE-001',
          'a.pdf',
          'application/pdf',
          10_000,
          'tester@example.com',
          now
        ),
        testEnv.DB.prepare(
          `INSERT INTO project_files (file_id, project_id, r2_key, original_name, file_type, file_size, uploaded_by, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          'FILE-002',
          projectId,
          'projects/PROJECT-STATS-001/files/FILE-002',
          'b.png',
          'image/png',
          15_000,
          'tester@example.com',
          now
        ),
      ]);
    });

    it('should return project statistics', async () => {
      const response = await authFetch(`http://localhost/api/projects/${projectId}/stats`);

      expect(response.status).toBe(200);
      const stats = await response.json<ProjectStats>();
      expect(stats.projectId).toBe(projectId);
      expect(stats.totalWorkNotes).toBe(1);
      expect(stats.totalTodos).toBe(2);
      expect(stats.completedTodos).toBe(1);
      expect(stats.pendingTodos).toBe(1);
      expect(stats.totalFiles).toBe(2);
      expect(stats.totalFileSize).toBe(25000);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await authFetch('http://localhost/api/projects/NONEXISTENT/stats');

      expect(response.status).toBe(404);
    });
  });
});
