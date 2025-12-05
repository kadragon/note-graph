// Trace: SPEC-project-1, TASK-037
// Integration tests for Project API routes

import { env, SELF } from 'cloudflare:test';
import type {
  R2Bucket,
  R2HTTPMetadata,
  R2Object,
  R2ObjectBody,
  R2PutOptions,
  VectorizeIndex,
} from '@cloudflare/workers-types';
import type { Project, ProjectDetail, ProjectStats } from '@shared/types/project';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '@/types/env';

type WritableEnv = {
  -readonly [K in keyof Env]: Env[K];
};

interface GlobalWithTestR2 {
  __TEST_R2_BUCKET: R2Bucket;
}

const testEnv = env as unknown as WritableEnv;

class MockR2 implements R2Bucket {
  storage = new Map<
    string,
    { value: Blob; httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string> }
  >();

  async put(key: string, value: Blob, options?: R2PutOptions): Promise<R2Object | null> {
    this.storage.set(key, {
      value,
      httpMetadata: options?.httpMetadata,
      customMetadata: options?.customMetadata,
    });
    return null;
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const entry = this.storage.get(key);
    if (!entry) return null;
    return {
      body: entry.value.stream(),
      size: entry.value.size,
      httpMetadata: entry.httpMetadata ?? {},
      customMetadata: entry.customMetadata ?? {},
      httpEtag: '',
      writeHttpMetadata: () => {},
    } as unknown as R2ObjectBody;
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async head(): Promise<R2Object | null> {
    return null;
  }
}

// Initialize R2_BUCKET early if not set (required for service instantiation in routes)
const defaultMockR2 = new MockR2();
if (!testEnv.R2_BUCKET) {
  testEnv.R2_BUCKET = defaultMockR2 as unknown as R2Bucket;
}
// Also set globalThis fallback for when c.env.R2_BUCKET is not available during request processing
(globalThis as unknown as GlobalWithTestR2).__TEST_R2_BUCKET = defaultMockR2 as unknown as R2Bucket;

// Helper to create authenticated fetch request
const authFetch = (url: string, options?: RequestInit) => {
  return SELF.fetch(url, {
    ...options,
    headers: {
      'Cf-Access-Authenticated-User-Email': 'test@example.com',
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
};

describe('Project API Routes', () => {
  beforeEach(async () => {
    // Clean up test data
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

  describe('POST /api/projects', () => {
    it('should create project with all required fields', async () => {
      // Arrange
      const projectData = {
        name: '테스트 프로젝트',
        description: '프로젝트 설명',
        status: '진행중' as const,
        priority: '높음' as const,
      };

      // Act
      const response = await authFetch('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify(projectData),
      });

      // Assert
      expect(response.status).toBe(201);
      const project = await response.json<Project>();
      expect(project.projectId).toMatch(/^PROJECT-/);
      expect(project.name).toBe(projectData.name);
      expect(project.description).toBe(projectData.description);
      expect(project.status).toBe('진행중');
      expect(project.priority).toBe('높음');
      expect(project.createdAt).toBeDefined();
    });

    it('should create project with participants', async () => {
      // Arrange - Create persons first
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

      // Act
      const response = await authFetch('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify(projectData),
      });

      // Assert
      expect(response.status).toBe(201);
      const project = await response.json<Project>();

      // Verify participants were created
      const participantsCheck = await testEnv.DB.prepare(
        'SELECT COUNT(*) as count FROM project_participants WHERE project_id = ?'
      )
        .bind(project.projectId)
        .first<{ count: number }>();
      expect(participantsCheck?.count).toBe(2);
    });

    it('should reject invalid project data', async () => {
      // Act
      const response = await authFetch('http://localhost/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: '' }), // Empty name
      });

      // Assert
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/projects', () => {
    beforeEach(async () => {
      // Setup test data
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare('INSERT INTO departments (dept_name) VALUES (?)').bind('개발팀'),
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-001', '홍길동', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (
						project_id, name, status, leader_person_id, dept_name, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind('PROJECT-001', '프로젝트1', '진행중', 'PERSON-001', '개발팀', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (
						project_id, name, status, leader_person_id, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('PROJECT-002', '프로젝트2', '완료', 'PERSON-001', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (
						project_id, name, status, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-003', '프로젝트3', '보류', now, now),
      ]);
    });

    it('should list all projects', async () => {
      // Act
      const response = await authFetch('http://localhost/api/projects');

      // Assert
      expect(response.status).toBe(200);
      const projects = await response.json<Project[]>();
      expect(projects).toHaveLength(3);
    });

    it('should filter projects by status', async () => {
      // Act
      const response = await authFetch('http://localhost/api/projects?status=진행중');

      // Assert
      expect(response.status).toBe(200);
      const projects = await response.json<Project[]>();
      expect(projects).toHaveLength(1);
      expect(projects[0].status).toBe('진행중');
    });

    it('should filter projects by leader', async () => {
      // Act
      const response = await authFetch('http://localhost/api/projects?leaderPersonId=PERSON-001');

      // Assert
      expect(response.status).toBe(200);
      const projects = await response.json<Project[]>();
      expect(projects).toHaveLength(2);
      expect(projects.every((p) => p.leaderPersonId === 'PERSON-001')).toBe(true);
    });

    it('should filter projects by department', async () => {
      // Act
      const response = await authFetch('http://localhost/api/projects?deptName=개발팀');

      // Assert
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
        // Seed work notes and associations
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
        // Seed project files (logical only; no R2 interaction needed for detail response)
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
      // Act
      const response = await authFetch(`http://localhost/api/projects/${projectId}`);

      // Assert
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
      // Act
      const response = await authFetch('http://localhost/api/projects/NONEXISTENT');

      // Assert
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
      // Arrange
      const updateData = {
        name: '변경된 이름',
        status: '완료' as const,
        actualEndDate: new Date().toISOString(),
      };

      // Act
      const response = await authFetch(`http://localhost/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      // Assert
      expect(response.status).toBe(200);
      const updated = await response.json<Project>();
      expect(updated.name).toBe('변경된 이름');
      expect(updated.status).toBe('완료');
      expect(updated.actualEndDate).toBeDefined();
    });

    it('should return 404 for non-existent project', async () => {
      // Act
      const response = await authFetch('http://localhost/api/projects/NONEXISTENT', {
        method: 'PUT',
        body: JSON.stringify({ name: '새 이름' }),
      });

      // Assert
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
      // Act
      const response = await authFetch(`http://localhost/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      // Assert
      expect(response.status).toBe(204);

      // Verify soft delete
      const deleted = await testEnv.DB.prepare(
        'SELECT deleted_at FROM projects WHERE project_id = ?'
      )
        .bind(projectId)
        .first<{ deleted_at: string }>();
      expect(deleted?.deleted_at).toBeDefined();
    });

    it('should return 404 for non-existent project', async () => {
      // Act
      const response = await authFetch('http://localhost/api/projects/NONEXISTENT', {
        method: 'DELETE',
      });

      // Assert
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:projectId with files', () => {
    let projectId: string;
    let r2: MockR2;

    beforeEach(async () => {
      const now = new Date().toISOString();
      projectId = 'PROJECT-DEL-FILES';

      // Reuse or replace the existing R2_BUCKET with a fresh MockR2
      r2 = new MockR2();
      testEnv.R2_BUCKET = r2 as unknown as R2Bucket;
      (globalThis as unknown as GlobalWithTestR2).__TEST_R2_BUCKET = r2 as unknown as R2Bucket;

      // Inject VECTORIZE mock
      testEnv.VECTORIZE = {
        query: vi.fn().mockResolvedValue({ matches: [] }),
        deleteByIds: vi.fn().mockResolvedValue(undefined),
        upsert: vi.fn().mockResolvedValue(undefined),
      } as unknown as VectorizeIndex;

      await testEnv.DB.batch([
        // Project
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, '진행중', ?, ?)`
        ).bind(projectId, '삭제 파일 프로젝트', now, now),
        // File rows
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

      // Seed R2 objects
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

      // Project soft deleted
      const project = await testEnv.DB.prepare(
        'SELECT deleted_at FROM projects WHERE project_id = ?'
      )
        .bind(projectId)
        .first<{ deleted_at: string }>();
      expect(project?.deleted_at).toBeDefined();

      // Files soft deleted and archived
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
      // Create a mock R2 that fails on the second file
      class FailingMockR2 extends MockR2 {
        callCount = 0;

        async get(key: string): Promise<R2ObjectBody | null> {
          const result = await super.get(key);
          return result;
        }

        async put(key: string, value: Blob, options?: R2PutOptions): Promise<R2Object | null> {
          this.callCount++;
          // Fail on second put (archive operation for FILE-DEL-2)
          if (this.callCount === 2) {
            throw new Error('Simulated R2 failure');
          }
          return super.put(key, value, options);
        }
      }

      const failingR2 = new FailingMockR2();
      testEnv.R2_BUCKET = failingR2 as unknown as R2Bucket;
      (globalThis as unknown as GlobalWithTestR2).__TEST_R2_BUCKET =
        failingR2 as unknown as R2Bucket;

      // Seed R2 objects
      failingR2.storage.set(`projects/${projectId}/files/FILE-DEL-1`, {
        value: new Blob(['hello'], { type: 'text/plain' }),
      });
      failingR2.storage.set(`projects/${projectId}/files/FILE-DEL-2`, {
        value: new Blob(['img'], { type: 'image/png' }),
      });

      const response = await authFetch(`http://localhost/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      // Should still return 204 even with partial failures
      expect(response.status).toBe(204);

      // Project should still be soft deleted
      const project = await testEnv.DB.prepare(
        'SELECT deleted_at FROM projects WHERE project_id = ?'
      )
        .bind(projectId)
        .first<{ deleted_at: string }>();
      expect(project?.deleted_at).toBeDefined();

      // First file should be archived successfully
      expect(failingR2.storage.has(`projects/${projectId}/archive/FILE-DEL-1`)).toBe(true);
      expect(failingR2.storage.has(`projects/${projectId}/files/FILE-DEL-1`)).toBe(false);
    });

    it('handles case where file exists in DB but not in R2', async () => {
      // Don't seed R2 objects, only DB records exist
      const response = await authFetch(`http://localhost/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(204);

      // Files should still be soft deleted in DB
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
        // Create project
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(projectId, '통계 테스트', '진행중', now, now),

        // Create work notes
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', '업무1', '내용1', now, now),

        // Associate work note
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind(projectId, 'WORK-001', now),

        // Create todos
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('TODO-001', 'WORK-001', '할일1', '완료', now, now),
        testEnv.DB.prepare(
          `INSERT INTO todos (todo_id, work_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('TODO-002', 'WORK-001', '할일2', '진행중', now, now),
        // Files for metrics
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
      // Act
      const response = await authFetch(`http://localhost/api/projects/${projectId}/stats`);

      // Assert
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
      // Act
      const response = await authFetch('http://localhost/api/projects/NONEXISTENT/stats');

      // Assert
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/projects/:projectId/participants', () => {
    let projectId: string;

    beforeEach(async () => {
      const now = new Date().toISOString();
      projectId = 'PROJECT-PART-001';
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-001', '홍길동', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(projectId, '참여자 테스트', '진행중', now, now),
      ]);
    });

    it('should add participant to project', async () => {
      // Arrange
      const data = {
        personId: 'PERSON-001',
        role: '검토자',
      };

      // Act
      const response = await authFetch(`http://localhost/api/projects/${projectId}/participants`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      // Assert
      expect(response.status).toBe(201);

      // Verify participant was added
      const participant = await testEnv.DB.prepare(
        'SELECT * FROM project_participants WHERE project_id = ? AND person_id = ?'
      )
        .bind(projectId, 'PERSON-001')
        .first<{ role: string }>();
      expect(participant?.role).toBe('검토자');
    });

    it('should return 404 for non-existent project', async () => {
      // Act
      const response = await authFetch('http://localhost/api/projects/NONEXISTENT/participants', {
        method: 'POST',
        body: JSON.stringify({ personId: 'PERSON-001' }),
      });

      // Assert
      expect(response.status).toBe(404);
    });

    it('should return 409 when adding duplicate participant', async () => {
      // Arrange - Add participant first
      await testEnv.DB.prepare(
        `INSERT INTO project_participants (project_id, person_id, role, joined_at) VALUES (?, ?, ?, ?)`
      )
        .bind(projectId, 'PERSON-001', '참여자', new Date().toISOString())
        .run();

      // Act
      const response = await authFetch(`http://localhost/api/projects/${projectId}/participants`, {
        method: 'POST',
        body: JSON.stringify({ personId: 'PERSON-001' }),
      });

      // Assert
      expect(response.status).toBe(409);
    });
  });

  describe('DELETE /api/projects/:projectId/participants/:personId', () => {
    let projectId: string;

    beforeEach(async () => {
      const now = new Date().toISOString();
      projectId = 'PROJECT-RM-PART';
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO persons (person_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind('PERSON-001', '홍길동', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(projectId, '참여자 제거', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_participants (project_id, person_id, role, joined_at) VALUES (?, ?, ?, ?)`
        ).bind(projectId, 'PERSON-001', '참여자', now),
      ]);
    });

    it('should remove participant from project', async () => {
      // Act
      const response = await authFetch(
        `http://localhost/api/projects/${projectId}/participants/PERSON-001`,
        {
          method: 'DELETE',
        }
      );

      // Assert
      expect(response.status).toBe(204);

      // Verify participant was removed
      const participant = await testEnv.DB.prepare(
        'SELECT * FROM project_participants WHERE project_id = ? AND person_id = ?'
      )
        .bind(projectId, 'PERSON-001')
        .first();
      expect(participant).toBeNull();
    });
  });

  describe('POST /api/projects/:projectId/work-notes', () => {
    let projectId: string;

    beforeEach(async () => {
      const now = new Date().toISOString();
      projectId = 'PROJECT-WORK-001';
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(projectId, '업무 할당 테스트', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', '업무1', '내용1', now, now),
      ]);
    });

    it('should assign work note to project', async () => {
      // Act
      const response = await authFetch(`http://localhost/api/projects/${projectId}/work-notes`, {
        method: 'POST',
        body: JSON.stringify({ workId: 'WORK-001' }),
      });

      // Assert
      expect(response.status).toBe(201);

      // Verify association
      const association = await testEnv.DB.prepare(
        'SELECT * FROM project_work_notes WHERE project_id = ? AND work_id = ?'
      )
        .bind(projectId, 'WORK-001')
        .first();
      expect(association).toBeDefined();
    });

    it('should return 409 when work note already assigned to another project', async () => {
      // Arrange - Create another project and assign the work note
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-OTHER', '다른 프로젝트', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind('PROJECT-OTHER', 'WORK-001', now),
      ]);

      // Act
      const response = await authFetch(`http://localhost/api/projects/${projectId}/work-notes`, {
        method: 'POST',
        body: JSON.stringify({ workId: 'WORK-001' }),
      });

      // Assert
      expect(response.status).toBe(409);
    });
  });

  describe('DELETE /api/projects/:projectId/work-notes/:workId', () => {
    let projectId: string;

    beforeEach(async () => {
      const now = new Date().toISOString();
      projectId = 'PROJECT-WORK-RM';
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(projectId, '업무 제거 테스트', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', '업무1', '내용1', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind(projectId, 'WORK-001', now),
      ]);
    });

    it('should remove work note from project', async () => {
      // Act
      const response = await authFetch(
        `http://localhost/api/projects/${projectId}/work-notes/WORK-001`,
        {
          method: 'DELETE',
        }
      );

      // Assert
      expect(response.status).toBe(204);

      // Verify association removed
      const association = await testEnv.DB.prepare(
        'SELECT * FROM project_work_notes WHERE project_id = ? AND work_id = ?'
      )
        .bind(projectId, 'WORK-001')
        .first();
      expect(association).toBeNull();
    });
  });

  describe('GET /api/projects/:projectId/work-notes', () => {
    let projectId: string;

    beforeEach(async () => {
      const now = new Date().toISOString();
      projectId = 'PROJECT-LIST-WORK';
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(projectId, '업무 목록 테스트', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', '업무1', '내용1', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-002', '업무2', '내용2', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind(projectId, 'WORK-001', now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind(projectId, 'WORK-002', now),
      ]);
    });

    it('should list project work notes', async () => {
      // Act
      const response = await authFetch(`http://localhost/api/projects/${projectId}/work-notes`);

      // Assert
      expect(response.status).toBe(200);
      const workNotes = await response.json();
      expect(workNotes).toHaveLength(2);
    });
  });
});
