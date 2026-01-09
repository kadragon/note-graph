// Trace: SPEC-project-1, TASK-037, TASK-065
// Integration tests for Project work note association routes

import { beforeEach, describe, expect, it } from 'vitest';

import { authFetch, testEnv } from '../test-setup';

describe('Project API Routes', () => {
  beforeEach(async () => {
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM project_work_notes'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM projects'),
    ]);
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
      const response = await authFetch(`http://localhost/api/projects/${projectId}/work-notes`, {
        method: 'POST',
        body: JSON.stringify({ workId: 'WORK-001' }),
      });

      expect(response.status).toBe(201);

      const association = await testEnv.DB.prepare(
        'SELECT * FROM project_work_notes WHERE project_id = ? AND work_id = ?'
      )
        .bind(projectId, 'WORK-001')
        .first();
      expect(association).toBeDefined();
    });

    it('should return 409 when work note already assigned to another project', async () => {
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-OTHER', '다른 프로젝트', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind('PROJECT-OTHER', 'WORK-001', now),
      ]);

      const response = await authFetch(`http://localhost/api/projects/${projectId}/work-notes`, {
        method: 'POST',
        body: JSON.stringify({ workId: 'WORK-001' }),
      });

      expect(response.status).toBe(409);
    });

    it('should allow assignment when existing link points to soft-deleted project', async () => {
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('PROJECT-DELETED', '삭제된 프로젝트', '진행중', now, now, now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind('PROJECT-DELETED', 'WORK-001', now),
        testEnv.DB.prepare(`UPDATE work_notes SET project_id = ? WHERE work_id = ?`).bind(
          'PROJECT-DELETED',
          'WORK-001'
        ),
      ]);

      const response = await authFetch(`http://localhost/api/projects/${projectId}/work-notes`, {
        method: 'POST',
        body: JSON.stringify({ workId: 'WORK-001' }),
      });

      expect(response.status).toBe(201);

      const association = await testEnv.DB.prepare(
        'SELECT project_id FROM project_work_notes WHERE work_id = ?'
      )
        .bind('WORK-001')
        .first<{ project_id: string }>();
      expect(association?.project_id).toBe(projectId);

      const workNote = await testEnv.DB.prepare(
        'SELECT project_id FROM work_notes WHERE work_id = ?'
      )
        .bind('WORK-001')
        .first<{ project_id: string | null }>();
      expect(workNote?.project_id).toBe(projectId);
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
      const response = await authFetch(
        `http://localhost/api/projects/${projectId}/work-notes/WORK-001`,
        {
          method: 'DELETE',
        }
      );

      expect(response.status).toBe(204);

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
      const response = await authFetch(`http://localhost/api/projects/${projectId}/work-notes`);

      expect(response.status).toBe(200);
      const workNotes = await response.json();
      expect(workNotes).toHaveLength(2);
    });
  });
});
