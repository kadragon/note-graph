import { env } from 'cloudflare:test';
import type { WorkNoteGroup, WorkNoteGroupWorkNote } from '@shared/types/work-note-group';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it } from 'vitest';

import { authFetch } from '../test-setup';

const testEnv = env as unknown as Env;

describe('Work Note Groups API', () => {
  beforeEach(async () => {
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_group_items'),
      testEnv.DB.prepare('DELETE FROM work_note_groups'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
    ]);
  });

  describe('POST /api/work-note-groups', () => {
    it('should create a new group', async () => {
      const response = await authFetch('/api/work-note-groups', {
        method: 'POST',
        body: JSON.stringify({ name: '신규그룹' }),
      });

      expect(response.status).toBe(201);
      const data = await response.json<WorkNoteGroup>();
      expect(data.groupId).toMatch(/^GRP-/);
      expect(data.name).toBe('신규그룹');
      expect(data.isActive).toBe(true);
    });

    it('should return 409 for duplicate name', async () => {
      await authFetch('/api/work-note-groups', {
        method: 'POST',
        body: JSON.stringify({ name: '중복그룹' }),
      });

      const response = await authFetch('/api/work-note-groups', {
        method: 'POST',
        body: JSON.stringify({ name: '중복그룹' }),
      });

      expect(response.status).toBe(409);
    });

    it('should return 400 for missing name', async () => {
      const response = await authFetch('/api/work-note-groups', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/work-note-groups', () => {
    it('should return all groups', async () => {
      await authFetch('/api/work-note-groups', {
        method: 'POST',
        body: JSON.stringify({ name: '그룹A' }),
      });
      await authFetch('/api/work-note-groups', {
        method: 'POST',
        body: JSON.stringify({ name: '그룹B' }),
      });

      const response = await authFetch('/api/work-note-groups');

      expect(response.status).toBe(200);
      const data = await response.json<WorkNoteGroup[]>();
      expect(data).toHaveLength(2);
    });

    it('should filter by search query', async () => {
      await authFetch('/api/work-note-groups', {
        method: 'POST',
        body: JSON.stringify({ name: '개발그룹' }),
      });
      await authFetch('/api/work-note-groups', {
        method: 'POST',
        body: JSON.stringify({ name: '디자인팀' }),
      });

      const response = await authFetch('/api/work-note-groups?q=개발');

      expect(response.status).toBe(200);
      const data = await response.json<WorkNoteGroup[]>();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('개발그룹');
    });
  });

  describe('GET /api/work-note-groups/:groupId', () => {
    it('should return group by ID', async () => {
      const createRes = await authFetch('/api/work-note-groups', {
        method: 'POST',
        body: JSON.stringify({ name: '조회그룹' }),
      });
      const created = await createRes.json<WorkNoteGroup>();

      const response = await authFetch(`/api/work-note-groups/${created.groupId}`);

      expect(response.status).toBe(200);
      const data = await response.json<WorkNoteGroup>();
      expect(data.name).toBe('조회그룹');
    });

    it('should return 404 for nonexistent group', async () => {
      const response = await authFetch('/api/work-note-groups/nonexistent');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/work-note-groups/:groupId', () => {
    it('should update group name', async () => {
      const createRes = await authFetch('/api/work-note-groups', {
        method: 'POST',
        body: JSON.stringify({ name: '원래이름' }),
      });
      const created = await createRes.json<WorkNoteGroup>();

      const response = await authFetch(`/api/work-note-groups/${created.groupId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: '새이름' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json<WorkNoteGroup>();
      expect(data.name).toBe('새이름');
    });
  });

  describe('PATCH /api/work-note-groups/:groupId/toggle-active', () => {
    it('should toggle active status', async () => {
      const createRes = await authFetch('/api/work-note-groups', {
        method: 'POST',
        body: JSON.stringify({ name: '토글그룹' }),
      });
      const created = await createRes.json<WorkNoteGroup>();

      const response = await authFetch(`/api/work-note-groups/${created.groupId}/toggle-active`, {
        method: 'PATCH',
      });

      expect(response.status).toBe(200);
      const data = await response.json<WorkNoteGroup>();
      expect(data.isActive).toBe(false);
    });
  });

  describe('DELETE /api/work-note-groups/:groupId', () => {
    it('should delete group', async () => {
      const createRes = await authFetch('/api/work-note-groups', {
        method: 'POST',
        body: JSON.stringify({ name: '삭제그룹' }),
      });
      const created = await createRes.json<WorkNoteGroup>();

      const response = await authFetch(`/api/work-note-groups/${created.groupId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);

      const getRes = await authFetch(`/api/work-note-groups/${created.groupId}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('Work note association endpoints', () => {
    let groupId: string;
    const workId = 'WORK-INT-001';

    beforeEach(async () => {
      const now = new Date().toISOString();
      await testEnv.DB.prepare(
        'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(workId, '통합테스트노트', 'Content', now, now)
        .run();

      const createRes = await authFetch('/api/work-note-groups', {
        method: 'POST',
        body: JSON.stringify({ name: '연결그룹' }),
      });
      const created = await createRes.json<WorkNoteGroup>();
      groupId = created.groupId;
    });

    it('POST /:groupId/work-notes/:workId should add work note to group', async () => {
      const response = await authFetch(`/api/work-note-groups/${groupId}/work-notes/${workId}`, {
        method: 'POST',
      });

      expect(response.status).toBe(201);
    });

    it('GET /:groupId/work-notes should return linked work notes', async () => {
      await authFetch(`/api/work-note-groups/${groupId}/work-notes/${workId}`, {
        method: 'POST',
      });

      const response = await authFetch(`/api/work-note-groups/${groupId}/work-notes`);

      expect(response.status).toBe(200);
      const data = await response.json<WorkNoteGroupWorkNote[]>();
      expect(data).toHaveLength(1);
      expect(data[0].workId).toBe(workId);
    });

    it('DELETE /:groupId/work-notes/:workId should remove work note from group', async () => {
      await authFetch(`/api/work-note-groups/${groupId}/work-notes/${workId}`, {
        method: 'POST',
      });

      const response = await authFetch(`/api/work-note-groups/${groupId}/work-notes/${workId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);

      const listRes = await authFetch(`/api/work-note-groups/${groupId}/work-notes`);
      const data = await listRes.json<WorkNoteGroupWorkNote[]>();
      expect(data).toHaveLength(0);
    });
  });
});
