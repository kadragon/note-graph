// Trace: SPEC-project-1, TASK-038
// Integration tests for work note to project association

import type { WorkNote, WorkNoteDetail } from '@shared/types/work-note';
import { beforeEach, describe, expect, it } from 'vitest';

import { authFetch, testEnv } from '../test-setup';

describe('Work Note Project Association', () => {
  beforeEach(async () => {
    // Clean up test data
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM project_files'),
      testEnv.DB.prepare('DELETE FROM project_work_notes'),
      testEnv.DB.prepare('DELETE FROM project_participants'),
      testEnv.DB.prepare('DELETE FROM projects'),
      testEnv.DB.prepare('DELETE FROM todos'),
      testEnv.DB.prepare('DELETE FROM work_note_person'),
      testEnv.DB.prepare('DELETE FROM work_note_relation'),
      testEnv.DB.prepare('DELETE FROM work_note_task_category'),
      testEnv.DB.prepare('DELETE FROM work_note_versions'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
      testEnv.DB.prepare('DELETE FROM person_dept_history'),
      testEnv.DB.prepare('DELETE FROM persons'),
      testEnv.DB.prepare('DELETE FROM departments'),
    ]);
  });

  describe('POST /work-notes with projectId', () => {
    it('should create work note with project assignment', async () => {
      // Arrange - Create project first
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
        .bind('PROJECT-001', '테스트 프로젝트', '진행중', now, now)
        .run();

      const workNoteData = {
        title: '프로젝트 업무',
        contentRaw: '프로젝트 관련 업무 내용',
        projectId: 'PROJECT-001',
      };

      // Act
      const response = await authFetch('http://localhost/api/work-notes', {
        method: 'POST',
        body: JSON.stringify(workNoteData),
      });

      // Assert
      expect(response.status).toBe(201);
      const workNote = await response.json<WorkNote>();
      expect(workNote.workId).toBeDefined();
      expect(workNote.projectId).toBe('PROJECT-001');

      // Verify project_work_notes association was created
      const association = await testEnv.DB.prepare(
        'SELECT * FROM project_work_notes WHERE work_id = ? AND project_id = ?'
      )
        .bind(workNote.workId, 'PROJECT-001')
        .first();
      expect(association).toBeDefined();
    });

    it('should create work note without project assignment', async () => {
      // Arrange
      const workNoteData = {
        title: '일반 업무',
        contentRaw: '프로젝트 없는 업무',
      };

      // Act
      const response = await authFetch('http://localhost/api/work-notes', {
        method: 'POST',
        body: JSON.stringify(workNoteData),
      });

      // Assert
      expect(response.status).toBe(201);
      const workNote = await response.json<WorkNote>();
      expect(workNote.projectId).toBeNull();
    });
  });

  describe('GET /work-notes/:workId with projectId', () => {
    it('should return work note with projectId in detail', async () => {
      // Arrange - Create project and work note
      const now = new Date().toISOString();
      const workId = 'WORK-TEST-001';
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-001', '테스트 프로젝트', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(workId, '업무1', '내용1', 'PROJECT-001', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_note_versions (work_id, version_no, title, content_raw, created_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(workId, 1, '업무1', '내용1', now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind('PROJECT-001', workId, now),
      ]);

      // Act
      const response = await authFetch(`http://localhost/api/work-notes/${workId}`);

      // Assert
      expect(response.status).toBe(200);
      const workNote = await response.json<WorkNoteDetail>();
      expect(workNote.projectId).toBe('PROJECT-001');
    });
  });

  describe('PUT /work-notes/:workId with projectId', () => {
    let workId: string;

    beforeEach(async () => {
      const now = new Date().toISOString();
      workId = 'WORK-UPDATE-001';
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(workId, '업무1', '내용1', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_note_versions (work_id, version_no, title, content_raw, created_at) VALUES (?, ?, ?, ?, ?)`
        ).bind(workId, 1, '업무1', '내용1', now),
      ]);
    });

    it('should assign work note to project via update', async () => {
      // Arrange - Create project
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
        .bind('PROJECT-001', '테스트 프로젝트', '진행중', now, now)
        .run();

      const updateData = {
        projectId: 'PROJECT-001',
      };

      // Act
      const response = await authFetch(`http://localhost/api/work-notes/${workId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      // Assert
      expect(response.status).toBe(200);
      const workNote = await response.json<WorkNote>();
      expect(workNote.projectId).toBe('PROJECT-001');

      // Verify association created
      const association = await testEnv.DB.prepare(
        'SELECT * FROM project_work_notes WHERE work_id = ? AND project_id = ?'
      )
        .bind(workId, 'PROJECT-001')
        .first();
      expect(association).toBeDefined();

      // Verify work_notes.project_id updated
      const workNote_db = await testEnv.DB.prepare(
        'SELECT project_id FROM work_notes WHERE work_id = ?'
      )
        .bind(workId)
        .first<{ project_id: string }>();
      expect(workNote_db?.project_id).toBe('PROJECT-001');
    });

    it('should change work note project assignment', async () => {
      // Arrange - Create two projects and initially assign to PROJECT-A
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-A', '프로젝트 A', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-B', '프로젝트 B', '진행중', now, now),
        testEnv.DB.prepare(`UPDATE work_notes SET project_id = ? WHERE work_id = ?`).bind(
          'PROJECT-A',
          workId
        ),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind('PROJECT-A', workId, now),
      ]);

      const updateData = {
        projectId: 'PROJECT-B',
      };

      // Act
      const response = await authFetch(`http://localhost/api/work-notes/${workId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      // Assert
      expect(response.status).toBe(200);
      const workNote = await response.json<WorkNote>();
      expect(workNote.projectId).toBe('PROJECT-B');

      // Verify old association removed and new one created
      const oldAssoc = await testEnv.DB.prepare(
        'SELECT * FROM project_work_notes WHERE work_id = ? AND project_id = ?'
      )
        .bind(workId, 'PROJECT-A')
        .first();
      expect(oldAssoc).toBeNull();

      const newAssoc = await testEnv.DB.prepare(
        'SELECT * FROM project_work_notes WHERE work_id = ? AND project_id = ?'
      )
        .bind(workId, 'PROJECT-B')
        .first();
      expect(newAssoc).toBeDefined();
    });

    it('should unassign work note from project', async () => {
      // Arrange - Assign to project first
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-001', '테스트 프로젝트', '진행중', now, now),
        testEnv.DB.prepare(`UPDATE work_notes SET project_id = ? WHERE work_id = ?`).bind(
          'PROJECT-001',
          workId
        ),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind('PROJECT-001', workId, now),
      ]);

      const updateData = {
        projectId: null,
      };

      // Act
      const response = await authFetch(`http://localhost/api/work-notes/${workId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      // Assert
      expect(response.status).toBe(200);
      const workNote = await response.json<WorkNote>();
      expect(workNote.projectId).toBeNull();

      // Verify association removed
      const association = await testEnv.DB.prepare(
        'SELECT * FROM project_work_notes WHERE work_id = ?'
      )
        .bind(workId)
        .first();
      expect(association).toBeNull();
    });
  });

  describe('1:N Relationship Constraint', () => {
    it('should prevent assigning work note to second project via POST endpoint', async () => {
      // Arrange - Create two projects and work note assigned to first
      const now = new Date().toISOString();
      await testEnv.DB.batch([
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-A', '프로젝트 A', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('PROJECT-B', '프로젝트 B', '진행중', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_notes (work_id, title, content_raw, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind('WORK-001', '업무1', '내용1', 'PROJECT-A', now, now),
        testEnv.DB.prepare(
          `INSERT INTO work_note_versions (work_id, version_no, title, content_raw, created_at) VALUES (?, ?, ?, ?, ?)`
        ).bind('WORK-001', 1, '업무1', '내용1', now),
        testEnv.DB.prepare(
          `INSERT INTO project_work_notes (project_id, work_id, assigned_at) VALUES (?, ?, ?)`
        ).bind('PROJECT-A', 'WORK-001', now),
      ]);

      // Act - Try to assign to second project via POST endpoint
      const response = await authFetch('http://localhost/api/projects/PROJECT-B/work-notes', {
        method: 'POST',
        body: JSON.stringify({ workId: 'WORK-001' }),
      });

      // Assert
      expect(response.status).toBe(409); // Conflict
      const error = await response.json<{ message: string }>();
      expect(error.message).toContain('PROJECT-A'); // Error message should mention existing project
    });
  });

  describe('Project Association Endpoints Consistency', () => {
    it('should maintain consistency between POST work-note and POST project/:id/work-notes', async () => {
      // Test 1: Create work note with projectId via work-notes endpoint
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        `INSERT INTO projects (project_id, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
        .bind('PROJECT-001', '테스트 프로젝트', '진행중', now, now)
        .run();

      const createResponse = await authFetch('http://localhost/api/work-notes', {
        method: 'POST',
        body: JSON.stringify({
          title: '업무1',
          contentRaw: '내용1',
          projectId: 'PROJECT-001',
        }),
      });

      expect(createResponse.status).toBe(201);
      const workNote1 = await createResponse.json<WorkNote>();

      // Verify work note appears in project's work notes list
      const listResponse = await authFetch('http://localhost/api/projects/PROJECT-001/work-notes');
      expect(listResponse.status).toBe(200);
      const workNotes = await listResponse.json();
      expect(workNotes.some((wn: { workId: string }) => wn.workId === workNote1.workId)).toBe(true);
    });
  });
});
