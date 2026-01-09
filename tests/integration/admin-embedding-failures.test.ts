// Trace: SPEC-rag-2, TASK-069, TEST-rag-2-5, TEST-rag-2-6
/**
 * Integration tests for admin embedding failure management routes
 */

import { nanoid } from 'nanoid';
import { beforeEach, describe, expect, it } from 'vitest';

import { authFetch, testEnv } from '../test-setup';

const adminFetch = (path: string, options?: RequestInit) =>
  authFetch(path, {
    ...options,
    headers: {
      'Cf-Access-Authenticated-User-Email': 'admin@example.com',
      ...options?.headers,
    },
  });

describe('Admin Embedding Failure Routes', () => {
  beforeEach(async () => {
    // Clean up test data
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM embedding_retry_queue'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
    ]);
  });

  describe('GET /api/admin/embedding-failures', () => {
    it('should return empty list when no dead-letter items exist', async () => {
      // Act
      const response = await adminFetch('/api/admin/embedding-failures');

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.items).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('should list dead-letter embedding failures with work note titles', async () => {
      // Arrange - Create test work note
      const workId = nanoid();
      await testEnv.DB.prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `)
        .bind(workId, 'Failed Embedding Test', 'Test content')
        .run();

      // Create dead-letter retry item
      const retryId = nanoid();
      const now = new Date().toISOString();
      await testEnv.DB.prepare(`
        INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, max_attempts,
          status, error_message, created_at, updated_at, dead_letter_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(
          retryId,
          workId,
          'create',
          3,
          3,
          'dead_letter',
          'Vectorize service unavailable',
          now,
          now,
          now
        )
        .run();

      // Act
      const response = await adminFetch('/api/admin/embedding-failures');

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.total).toBe(1);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].id).toBe(retryId);
      expect(data.items[0].workId).toBe(workId);
      expect(data.items[0].workTitle).toBe('Failed Embedding Test');
      expect(data.items[0].operationType).toBe('create');
      expect(data.items[0].attemptCount).toBe(3);
      expect(data.items[0].errorMessage).toBe('Vectorize service unavailable');
    });

    it('should not include pending or retrying items in dead-letter list', async () => {
      // Arrange - Create work note
      const workId = nanoid();
      await testEnv.DB.prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
        .bind(workId, 'Test Work', 'Content')
        .run();

      const now = new Date().toISOString();

      // Create pending item
      await testEnv.DB.prepare(`
        INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(nanoid(), workId, 'create', 1, 'pending', now, now)
        .run();

      // Create retrying item
      await testEnv.DB.prepare(`
        INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(nanoid(), workId, 'update', 2, 'retrying', now, now)
        .run();

      // Act
      const response = await adminFetch('/api/admin/embedding-failures');

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.total).toBe(0);
      expect(data.items).toHaveLength(0);
    });

    it('should respect limit and offset query parameters', async () => {
      // Arrange - Create 5 dead-letter items
      const workId = nanoid();
      await testEnv.DB.prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
        .bind(workId, 'Test Work', 'Content')
        .run();

      const now = new Date().toISOString();
      for (let i = 0; i < 5; i++) {
        await testEnv.DB.prepare(`
          INSERT INTO embedding_retry_queue (
            id, work_id, operation_type, attempt_count, status,
            created_at, updated_at, dead_letter_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
          .bind(nanoid(), workId, 'create', 3, 'dead_letter', now, now, now)
          .run();
      }

      // Act
      const page1 = await adminFetch('/api/admin/embedding-failures?limit=2&offset=0');
      const page2 = await adminFetch('/api/admin/embedding-failures?limit=2&offset=2');

      // Assert
      expect(page1.status).toBe(200);
      expect(page2.status).toBe(200);

      const data1 = await page1.json();
      const data2 = await page2.json();

      expect(data1.total).toBe(5);
      expect(data1.items).toHaveLength(2);
      expect(data2.total).toBe(5);
      expect(data2.items).toHaveLength(2);
      expect(data1.items[0].id).not.toBe(data2.items[0].id);
    });
  });

  describe('POST /api/admin/embedding-failures/:id/retry', () => {
    it('should reset dead-letter item to pending status', async () => {
      // Arrange - Create work note and dead-letter item
      const workId = nanoid();
      await testEnv.DB.prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
        .bind(workId, 'Test Work', 'Content')
        .run();

      const retryId = nanoid();
      const now = new Date().toISOString();
      await testEnv.DB.prepare(`
        INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status,
          created_at, updated_at, dead_letter_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(retryId, workId, 'create', 3, 'dead_letter', now, now, now)
        .run();

      // Act
      const response = await adminFetch(`/api/admin/embedding-failures/${retryId}/retry`, {
        method: 'POST',
      });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('재시도 대기 상태로 초기화됨');
      expect(data.status).toBe('pending');

      // Verify database state changed
      const result = await testEnv.DB.prepare(`
        SELECT status, dead_letter_at FROM embedding_retry_queue WHERE id = ?
      `)
        .bind(retryId)
        .first<{ status: string; dead_letter_at: string | null }>();

      expect(result?.status).toBe('pending');
      expect(result?.dead_letter_at).toBeNull();
    });

    it('should return 404 when retry item does not exist', async () => {
      // Act
      const response = await adminFetch('/api/admin/embedding-failures/nonexistent-id/retry', {
        method: 'POST',
      });

      // Assert
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.code).toBe('NOT_FOUND');
    });

    it('should return 400 when item is not in dead_letter status', async () => {
      // Arrange - Create pending retry item
      const workId = nanoid();
      await testEnv.DB.prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
        .bind(workId, 'Test Work', 'Content')
        .run();

      const retryId = nanoid();
      const now = new Date().toISOString();
      await testEnv.DB.prepare(`
        INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(retryId, workId, 'create', 1, 'pending', now, now)
        .run();

      // Act
      const response = await adminFetch(`/api/admin/embedding-failures/${retryId}/retry`, {
        method: 'POST',
      });

      // Assert
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain('dead_letter 상태가 아닙니다');
      expect(data.status).toBe('pending');
    });

    it('should handle multiple dead-letter items independently', async () => {
      // Arrange - Create 3 dead-letter items
      const workId = nanoid();
      await testEnv.DB.prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
        .bind(workId, 'Test Work', 'Content')
        .run();

      const now = new Date().toISOString();
      const retryIds = [nanoid(), nanoid(), nanoid()];

      for (const id of retryIds) {
        await testEnv.DB.prepare(`
          INSERT INTO embedding_retry_queue (
            id, work_id, operation_type, attempt_count, status,
            created_at, updated_at, dead_letter_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
          .bind(id, workId, 'create', 3, 'dead_letter', now, now, now)
          .run();
      }

      // Act - Retry only the second item
      const response = await adminFetch(`/api/admin/embedding-failures/${retryIds[1]}/retry`, {
        method: 'POST',
      });

      // Assert
      expect(response.status).toBe(200);

      // Verify only second item was reset
      const results = await testEnv.DB.prepare(`
        SELECT id, status FROM embedding_retry_queue WHERE id IN (?, ?, ?)
        ORDER BY id
      `)
        .bind(retryIds[0], retryIds[1], retryIds[2])
        .all<{ id: string; status: string }>();

      const statusMap = new Map(results.results.map((r) => [r.id, r.status]));
      expect(statusMap.get(retryIds[0])).toBe('dead_letter');
      expect(statusMap.get(retryIds[1])).toBe('pending');
      expect(statusMap.get(retryIds[2])).toBe('dead_letter');
    });
  });
});
