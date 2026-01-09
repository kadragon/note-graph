// Trace: SPEC-project-1, TASK-037, TASK-065
// Integration tests for Project participants API routes

import { beforeEach, describe, expect, it } from 'vitest';

import { authFetch, testEnv } from '../test-setup';

describe('Project API Routes', () => {
  beforeEach(async () => {
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM project_participants'),
      testEnv.DB.prepare('DELETE FROM projects'),
      testEnv.DB.prepare('DELETE FROM persons'),
    ]);
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
      const data = {
        personId: 'PERSON-001',
        role: '검토자',
      };

      const response = await authFetch(`http://localhost/api/projects/${projectId}/participants`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      expect(response.status).toBe(201);

      const participant = await testEnv.DB.prepare(
        'SELECT * FROM project_participants WHERE project_id = ? AND person_id = ?'
      )
        .bind(projectId, 'PERSON-001')
        .first<{ role: string }>();
      expect(participant?.role).toBe('검토자');
    });

    it('should return 404 for non-existent project', async () => {
      const response = await authFetch('http://localhost/api/projects/NONEXISTENT/participants', {
        method: 'POST',
        body: JSON.stringify({ personId: 'PERSON-001' }),
      });

      expect(response.status).toBe(404);
    });

    it('should return 409 when adding duplicate participant', async () => {
      await testEnv.DB.prepare(
        `INSERT INTO project_participants (project_id, person_id, role, joined_at) VALUES (?, ?, ?, ?)`
      )
        .bind(projectId, 'PERSON-001', '참여자', new Date().toISOString())
        .run();

      const response = await authFetch(`http://localhost/api/projects/${projectId}/participants`, {
        method: 'POST',
        body: JSON.stringify({ personId: 'PERSON-001' }),
      });

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
      const response = await authFetch(
        `http://localhost/api/projects/${projectId}/participants/PERSON-001`,
        {
          method: 'DELETE',
        }
      );

      expect(response.status).toBe(204);

      const participant = await testEnv.DB.prepare(
        'SELECT * FROM project_participants WHERE project_id = ? AND person_id = ?'
      )
        .bind(projectId, 'PERSON-001')
        .first();
      expect(participant).toBeNull();
    });
  });
});
