// Trace: SPEC-rag-2, TASK-069, TEST-rag-2-5, TEST-rag-2-6
/**
 * Integration tests for admin embedding failure management routes
 */

import { nanoid } from 'nanoid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDatabaseFactory } from '../helpers/test-app';

vi.mock('@worker/adapters/database-factory', () => mockDatabaseFactory());

import worker from '@worker/index';
import { pgCleanupAll } from '../helpers/pg-test-utils';
import { createAuthFetch } from '../helpers/test-app';
import { pglite } from '../pg-setup';

const baseAuthFetch = createAuthFetch(worker);

const adminFetch = baseAuthFetch;

describe('Admin Embedding Failure Routes', () => {
  beforeEach(async () => {
    await pgCleanupAll(pglite);
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
      const now = new Date().toISOString();
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)`,
        [workId, 'Failed Embedding Test', 'Test content', now, now]
      );

      // Create dead-letter retry item
      const retryId = nanoid();
      await pglite.query(
        `INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, max_attempts,
          status, error_message, created_at, updated_at, dead_letter_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          retryId,
          workId,
          'create',
          3,
          3,
          'dead_letter',
          'Vectorize service unavailable',
          now,
          now,
          now,
        ]
      );

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
      const now = new Date().toISOString();
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)`,
        [workId, 'Test Work', 'Content', now, now]
      );

      // Create pending item
      await pglite.query(
        `INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [nanoid(), workId, 'create', 1, 'pending', now, now]
      );

      // Create retrying item
      await pglite.query(
        `INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [nanoid(), workId, 'update', 2, 'retrying', now, now]
      );

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
      const now = new Date().toISOString();
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)`,
        [workId, 'Test Work', 'Content', now, now]
      );

      for (let i = 0; i < 5; i++) {
        await pglite.query(
          `INSERT INTO embedding_retry_queue (
            id, work_id, operation_type, attempt_count, status,
            created_at, updated_at, dead_letter_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [nanoid(), workId, 'create', 3, 'dead_letter', now, now, now]
        );
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
      const now = new Date().toISOString();
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)`,
        [workId, 'Test Work', 'Content', now, now]
      );

      const retryId = nanoid();
      await pglite.query(
        `INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status,
          created_at, updated_at, dead_letter_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [retryId, workId, 'create', 3, 'dead_letter', now, now, now]
      );

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
      const result = await pglite.query<{ status: string; dead_letter_at: string | null }>(
        `SELECT status, dead_letter_at FROM embedding_retry_queue WHERE id = $1`,
        [retryId]
      );

      expect(result.rows[0]?.status).toBe('pending');
      expect(result.rows[0]?.dead_letter_at).toBeNull();
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
      const now = new Date().toISOString();
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)`,
        [workId, 'Test Work', 'Content', now, now]
      );

      const retryId = nanoid();
      await pglite.query(
        `INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [retryId, workId, 'create', 1, 'pending', now, now]
      );

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
      const now = new Date().toISOString();
      await pglite.query(
        `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5)`,
        [workId, 'Test Work', 'Content', now, now]
      );

      const retryIds = [nanoid(), nanoid(), nanoid()];

      for (const id of retryIds) {
        await pglite.query(
          `INSERT INTO embedding_retry_queue (
            id, work_id, operation_type, attempt_count, status,
            created_at, updated_at, dead_letter_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [id, workId, 'create', 3, 'dead_letter', now, now, now]
        );
      }

      // Act - Retry only the second item
      const response = await adminFetch(`/api/admin/embedding-failures/${retryIds[1]}/retry`, {
        method: 'POST',
      });

      // Assert
      expect(response.status).toBe(200);

      // Verify only second item was reset
      const results = await pglite.query<{ id: string; status: string }>(
        `SELECT id, status FROM embedding_retry_queue WHERE id IN ($1, $2, $3)
        ORDER BY id`,
        [retryIds[0], retryIds[1], retryIds[2]]
      );

      const statusMap = new Map(results.rows.map((r) => [r.id, r.status]));
      expect(statusMap.get(retryIds[0])).toBe('dead_letter');
      expect(statusMap.get(retryIds[1])).toBe('pending');
      expect(statusMap.get(retryIds[2])).toBe('dead_letter');
    });
  });
});
