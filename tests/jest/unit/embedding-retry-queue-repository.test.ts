// Trace: SPEC-rag-2, TASK-069
// Unit tests for EmbeddingRetryQueueRepository (Jest version)

import type { D1Database } from '@cloudflare/workers-types';
import { EmbeddingRetryQueueRepository } from '@worker/repositories/embedding-retry-queue-repository';
import { nanoid } from 'nanoid';

let db: D1Database;

describe('EmbeddingRetryQueueRepository', () => {
  let repository: EmbeddingRetryQueueRepository;

  beforeEach(async () => {
    db = await globalThis.getDB();
    repository = new EmbeddingRetryQueueRepository(db);

    // Clean up test data
    await db.prepare('DELETE FROM embedding_retry_queue').run();
    await db.prepare('DELETE FROM work_notes').run();
  });

  describe('findDeadLetterItems()', () => {
    it('should return empty list when no dead-letter items exist', async () => {
      // Act
      const result = await repository.findDeadLetterItems(50, 0);

      // Assert
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should list dead-letter items with work note titles', async () => {
      // Arrange - Create a test work note
      const workId = nanoid();
      await db
        .prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
        .bind(workId, 'Test Work Note', 'Test content')
        .run();

      // Create dead-letter retry item
      const retryId = nanoid();
      const now = new Date().toISOString();
      await db
        .prepare(`
        INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, max_attempts,
          status, error_message, created_at, updated_at, dead_letter_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(retryId, workId, 'create', 3, 3, 'dead_letter', 'Max retries exceeded', now, now, now)
        .run();

      // Act
      const result = await repository.findDeadLetterItems(50, 0);

      // Assert
      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(retryId);
      expect(result.items[0].workId).toBe(workId);
      expect(result.items[0].workTitle).toBe('Test Work Note');
      expect(result.items[0].operationType).toBe('create');
      expect(result.items[0].attemptCount).toBe(3);
      expect(result.items[0].errorMessage).toBe('Max retries exceeded');
      expect(result.items[0].deadLetterAt).toBe(now);
    });

    it('should not include pending or retrying items', async () => {
      // Arrange
      const workId = nanoid();
      await db
        .prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
        .bind(workId, 'Test Work', 'Content')
        .run();

      const now = new Date().toISOString();

      // Create pending item
      await db
        .prepare(`
        INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(nanoid(), workId, 'create', 1, 'pending', now, now)
        .run();

      // Create retrying item
      await db
        .prepare(`
        INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(nanoid(), workId, 'create', 2, 'retrying', now, now)
        .run();

      // Act
      const result = await repository.findDeadLetterItems(50, 0);

      // Assert
      expect(result.total).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    it('should respect limit and offset parameters', async () => {
      // Arrange - Create 5 dead-letter items
      const workId = nanoid();
      await db
        .prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
        .bind(workId, 'Test Work', 'Content')
        .run();

      const now = new Date().toISOString();
      for (let i = 0; i < 5; i++) {
        await db
          .prepare(`
          INSERT INTO embedding_retry_queue (
            id, work_id, operation_type, attempt_count, status,
            created_at, updated_at, dead_letter_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
          .bind(nanoid(), workId, 'create', 3, 'dead_letter', now, now, now)
          .run();
      }

      // Act
      const page1 = await repository.findDeadLetterItems(2, 0);
      const page2 = await repository.findDeadLetterItems(2, 2);

      // Assert
      expect(page1.total).toBe(5);
      expect(page1.items).toHaveLength(2);
      expect(page2.total).toBe(5);
      expect(page2.items).toHaveLength(2);
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
    });
  });

  describe('findById()', () => {
    it('should return null when item does not exist', async () => {
      // Act
      const result = await repository.findById('nonexistent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should retrieve retry item by ID', async () => {
      // Arrange
      const workId = nanoid();
      await db
        .prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
        .bind(workId, 'Test Work', 'Content')
        .run();

      const retryId = nanoid();
      const now = new Date().toISOString();
      await db
        .prepare(`
        INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, max_attempts,
          next_retry_at, status, error_message, error_details,
          created_at, updated_at, dead_letter_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(
          retryId,
          workId,
          'update',
          2,
          3,
          now,
          'pending',
          'Network error',
          '{"code":"ECONNRESET"}',
          now,
          now,
          null
        )
        .run();

      // Act
      const result = await repository.findById(retryId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe(retryId);
      expect(result?.workId).toBe(workId);
      expect(result?.operationType).toBe('update');
      expect(result?.attemptCount).toBe(2);
      expect(result?.maxAttempts).toBe(3);
      expect(result?.status).toBe('pending');
      expect(result?.errorMessage).toBe('Network error');
      expect(result?.errorDetails).toBe('{"code":"ECONNRESET"}');
    });
  });

  describe('resetToPending()', () => {
    it('should reset dead-letter item to pending status', async () => {
      // Arrange
      const workId = nanoid();
      await db
        .prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
        .bind(workId, 'Test Work', 'Content')
        .run();

      const retryId = nanoid();
      const now = new Date().toISOString();
      await db
        .prepare(`
        INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status,
          created_at, updated_at, dead_letter_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(retryId, workId, 'create', 3, 'dead_letter', now, now, now)
        .run();

      // Act
      const success = await repository.resetToPending(retryId);

      // Assert
      expect(success).toBe(true);

      const updated = await repository.findById(retryId);
      expect(updated?.status).toBe('pending');
      expect(updated?.deadLetterAt).toBeNull();
      expect(updated?.nextRetryAt).toBeTruthy();
    });

    it('should return false when item does not exist', async () => {
      // Act
      const success = await repository.resetToPending('nonexistent-id');

      // Assert
      expect(success).toBe(false);
    });

    it('should return false when item is not in dead_letter status', async () => {
      // Arrange
      const workId = nanoid();
      await db
        .prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
        .bind(workId, 'Test Work', 'Content')
        .run();

      const retryId = nanoid();
      const now = new Date().toISOString();
      await db
        .prepare(`
        INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(retryId, workId, 'create', 1, 'pending', now, now)
        .run();

      // Act
      const success = await repository.resetToPending(retryId);

      // Assert
      expect(success).toBe(false);
    });
  });

  describe('updateStatus()', () => {
    it('should update retry item status', async () => {
      // Arrange
      const workId = nanoid();
      await db
        .prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
        .bind(workId, 'Test Work', 'Content')
        .run();

      const retryId = nanoid();
      const now = new Date().toISOString();
      await db
        .prepare(`
        INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(retryId, workId, 'create', 1, 'pending', now, now)
        .run();

      // Act
      await repository.updateStatus(retryId, 'retrying');

      // Assert
      const updated = await repository.findById(retryId);
      expect(updated?.status).toBe('retrying');
    });
  });

  describe('delete()', () => {
    it('should delete retry item', async () => {
      // Arrange
      const workId = nanoid();
      await db
        .prepare(`
        INSERT INTO work_notes (work_id, title, content_raw, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
        .bind(workId, 'Test Work', 'Content')
        .run();

      const retryId = nanoid();
      const now = new Date().toISOString();
      await db
        .prepare(`
        INSERT INTO embedding_retry_queue (
          id, work_id, operation_type, attempt_count, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(retryId, workId, 'create', 1, 'pending', now, now)
        .run();

      // Act
      await repository.delete(retryId);

      // Assert
      const deleted = await repository.findById(retryId);
      expect(deleted).toBeNull();
    });
  });
});
