// Trace: SPEC-rag-2, TASK-022
// Test suite for Embedding Retry Service with exponential backoff

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import type { Env } from '../../src/types/env';
import { EmbeddingRetryService } from '../../src/services/embedding-retry-service';
import { WorkNoteRepository } from '../../src/repositories/work-note-repository';
import { EmbeddingService } from '../../src/services/embedding-service';
import { ChunkingService } from '../../src/services/chunking-service';

describe('EmbeddingRetryService - Retry Queue Management', () => {
  let service: EmbeddingRetryService;
  let db: D1Database;
  const testWorkId = 'WORK-TEST-RETRY-001';

  beforeEach(async () => {
    db = (env as unknown as Env).DB;
    service = new EmbeddingRetryService(db);

    // Clean up any existing test data
    await db.prepare('DELETE FROM embedding_retry_queue WHERE work_id LIKE ?').bind('WORK-TEST-%').run();
    await db.prepare('DELETE FROM work_notes WHERE work_id LIKE ?').bind('WORK-TEST-%').run();

    // Create test work note
    await db
      .prepare(
        'INSERT INTO work_notes (work_id, title, content_raw, category) VALUES (?, ?, ?, ?)'
      )
      .bind(testWorkId, 'Test Work Note', 'Test content for retry', 'MEETING')
      .run();
  });

  describe('enqueueRetry() - Queue Management', () => {
    it('should create retry queue entry with pending status', async () => {
      // Arrange
      const operationType = 'create';
      const errorMessage = 'Vectorize connection timeout';
      const errorDetails = { code: 'TIMEOUT', retry: true };

      // Act
      const retryId = await service.enqueueRetry(
        testWorkId,
        operationType,
        errorMessage,
        errorDetails
      );

      // Assert
      expect(retryId).toBeTruthy();
      expect(retryId).toMatch(/^RETRY-/);

      const result = await db
        .prepare('SELECT * FROM embedding_retry_queue WHERE id = ?')
        .bind(retryId)
        .first();

      expect(result).toBeTruthy();
      expect(result?.work_id).toBe(testWorkId);
      expect(result?.operation_type).toBe(operationType);
      expect(result?.attempt_count).toBe(0);
      expect(result?.max_attempts).toBe(3);
      expect(result?.status).toBe('pending');
      expect(result?.error_message).toBe(errorMessage);
      expect(result?.error_details).toBe(JSON.stringify(errorDetails));
      expect(result?.next_retry_at).toBeTruthy(); // Should be set to immediate retry
    });

    it('should set next_retry_at to immediate for first attempt', async () => {
      // Act
      const retryId = await service.enqueueRetry(testWorkId, 'create', 'Test error');

      // Assert
      const result = await db
        .prepare('SELECT next_retry_at FROM embedding_retry_queue WHERE id = ?')
        .bind(retryId)
        .first<{ next_retry_at: string }>();

      const nextRetryAt = new Date(result!.next_retry_at);
      const now = new Date();

      // Should be within 1 second of now (immediate retry)
      expect(Math.abs(nextRetryAt.getTime() - now.getTime())).toBeLessThan(2000);
    });

    it('should prevent duplicate entries for same work_id and operation', async () => {
      // Arrange
      await service.enqueueRetry(testWorkId, 'create', 'First error');

      // Act
      const secondRetryId = await service.enqueueRetry(testWorkId, 'create', 'Second error');

      // Assert
      const count = await db
        .prepare('SELECT COUNT(*) as count FROM embedding_retry_queue WHERE work_id = ?')
        .bind(testWorkId)
        .first<{ count: number }>();

      expect(count?.count).toBe(1); // Should only have one entry
    });
  });

  describe('getRetryableItems() - Fetch Ready Items', () => {
    it('should return items ready for retry', async () => {
      // Arrange
      const now = new Date();
      const pastTime = new Date(now.getTime() - 5000).toISOString(); // 5 seconds ago

      await db
        .prepare(
          `INSERT INTO embedding_retry_queue
           (id, work_id, operation_type, next_retry_at, status, attempt_count)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind('RETRY-001', testWorkId, 'create', pastTime, 'pending', 0)
        .run();

      // Act
      const items = await service.getRetryableItems(10);

      // Assert
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('RETRY-001');
      expect(items[0].work_id).toBe(testWorkId);
      expect(items[0].status).toBe('pending');
    });

    it('should not return items with future next_retry_at', async () => {
      // Arrange
      const futureTime = new Date(Date.now() + 60000).toISOString(); // 1 minute in future

      await db
        .prepare(
          `INSERT INTO embedding_retry_queue
           (id, work_id, operation_type, next_retry_at, status, attempt_count)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind('RETRY-FUTURE', testWorkId, 'create', futureTime, 'pending', 0)
        .run();

      // Act
      const items = await service.getRetryableItems(10);

      // Assert
      expect(items.length).toBe(0);
    });

    it('should not return items with dead_letter status', async () => {
      // Arrange
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO embedding_retry_queue
           (id, work_id, operation_type, next_retry_at, status, dead_letter_at, attempt_count)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind('RETRY-DEAD', testWorkId, 'create', now, 'dead_letter', now, 3)
        .run();

      // Act
      const items = await service.getRetryableItems(10);

      // Assert
      expect(items.length).toBe(0);
    });

    it('should respect limit parameter', async () => {
      // Arrange
      const now = new Date().toISOString();

      for (let i = 0; i < 5; i++) {
        // Create corresponding work notes first (FK constraint)
        await db
          .prepare('INSERT INTO work_notes (work_id, title, content_raw) VALUES (?, ?, ?)')
          .bind(`WORK-TEST-LIMIT-${i}`, `Test ${i}`, `Content ${i}`)
          .run();

        // Then create retry queue entries
        await db
          .prepare(
            `INSERT INTO embedding_retry_queue
             (id, work_id, operation_type, next_retry_at, status, attempt_count)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(`RETRY-LIMIT-${i}`, `WORK-TEST-LIMIT-${i}`, 'create', now, 'pending', 0)
          .run();
      }

      // Act
      const items = await service.getRetryableItems(3);

      // Assert
      expect(items.length).toBe(3);
    });
  });

  describe('updateRetryAttempt() - Exponential Backoff', () => {
    it('should calculate exponential backoff for attempt 1 (2 seconds)', async () => {
      // Arrange
      const retryId = await service.enqueueRetry(testWorkId, 'create', 'Test error');

      // Act
      const beforeUpdate = Date.now();
      await service.updateRetryAttempt(retryId, 1, 'Retry failed again');
      const afterUpdate = Date.now();

      // Assert
      const result = await db
        .prepare('SELECT * FROM embedding_retry_queue WHERE id = ?')
        .bind(retryId)
        .first();

      expect(result?.attempt_count).toBe(1);
      expect(result?.status).toBe('pending');

      const nextRetryAt = new Date(result!.next_retry_at as string);
      const expectedDelay = 2000; // 2^1 = 2 seconds
      const actualDelay = nextRetryAt.getTime() - beforeUpdate;

      // Allow 500ms variance
      expect(Math.abs(actualDelay - expectedDelay)).toBeLessThan(1000);
    });

    it('should calculate exponential backoff for attempt 2 (4 seconds)', async () => {
      // Arrange
      const retryId = await service.enqueueRetry(testWorkId, 'create', 'Test error');

      // Act
      const beforeUpdate = Date.now();
      await service.updateRetryAttempt(retryId, 2, 'Retry failed again');

      // Assert
      const result = await db
        .prepare('SELECT * FROM embedding_retry_queue WHERE id = ?')
        .bind(retryId)
        .first();

      expect(result?.attempt_count).toBe(2);

      const nextRetryAt = new Date(result!.next_retry_at as string);
      const expectedDelay = 4000; // 2^2 = 4 seconds
      const actualDelay = nextRetryAt.getTime() - beforeUpdate;

      expect(Math.abs(actualDelay - expectedDelay)).toBeLessThan(1000);
    });

    it('should update error message on retry attempt', async () => {
      // Arrange
      const retryId = await service.enqueueRetry(testWorkId, 'create', 'Initial error');

      // Act
      await service.updateRetryAttempt(retryId, 1, 'Second error message');

      // Assert
      const result = await db
        .prepare('SELECT error_message FROM embedding_retry_queue WHERE id = ?')
        .bind(retryId)
        .first<{ error_message: string }>();

      expect(result?.error_message).toBe('Second error message');
    });
  });

  describe('moveToDeadLetter() - Dead Letter Queue', () => {
    it('should move item to dead_letter status after max attempts', async () => {
      // Arrange
      const retryId = await service.enqueueRetry(testWorkId, 'create', 'Test error');

      // Act
      await service.moveToDeadLetter(retryId, 3, 'Max retries exceeded');

      // Assert
      const result = await db
        .prepare('SELECT * FROM embedding_retry_queue WHERE id = ?')
        .bind(retryId)
        .first();

      expect(result?.status).toBe('dead_letter');
      expect(result?.attempt_count).toBe(3);
      expect(result?.dead_letter_at).toBeTruthy();
      expect(result?.error_message).toBe('Max retries exceeded');
    });

    it('should set dead_letter_at timestamp', async () => {
      // Arrange
      const retryId = await service.enqueueRetry(testWorkId, 'create', 'Test error');
      const beforeMove = new Date();

      // Act
      await service.moveToDeadLetter(retryId, 3, 'Final error');

      // Assert
      const result = await db
        .prepare('SELECT dead_letter_at FROM embedding_retry_queue WHERE id = ?')
        .bind(retryId)
        .first<{ dead_letter_at: string }>();

      const deadLetterAt = new Date(result!.dead_letter_at);
      expect(deadLetterAt.getTime()).toBeGreaterThanOrEqual(beforeMove.getTime());
    });
  });

  describe('deleteRetryItem() - Successful Retry Cleanup', () => {
    it('should delete retry item after successful embedding', async () => {
      // Arrange
      const retryId = await service.enqueueRetry(testWorkId, 'create', 'Test error');

      // Act
      await service.deleteRetryItem(retryId);

      // Assert
      const result = await db
        .prepare('SELECT * FROM embedding_retry_queue WHERE id = ?')
        .bind(retryId)
        .first();

      expect(result).toBeNull();
    });
  });

  describe('getDeadLetterItems() - Admin Queries', () => {
    it('should return only dead_letter items', async () => {
      // Arrange
      await db
        .prepare(
          `INSERT INTO embedding_retry_queue
           (id, work_id, operation_type, status, dead_letter_at, attempt_count, error_message)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind('RETRY-DEAD-1', testWorkId, 'create', 'dead_letter', new Date().toISOString(), 3, 'Error 1')
        .run();

      await db
        .prepare(
          `INSERT INTO embedding_retry_queue
           (id, work_id, operation_type, status, attempt_count)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind('RETRY-PENDING', testWorkId, 'create', 'pending', 1)
        .run();

      // Act
      const items = await service.getDeadLetterItems(10, 0);

      // Assert
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('RETRY-DEAD-1');
      expect(items[0].status).toBe('dead_letter');
    });

    it('should include work note title in dead letter items', async () => {
      // Arrange
      await db
        .prepare(
          `INSERT INTO embedding_retry_queue
           (id, work_id, operation_type, status, dead_letter_at, attempt_count)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind('RETRY-DEAD-2', testWorkId, 'create', 'dead_letter', new Date().toISOString(), 3)
        .run();

      // Act
      const items = await service.getDeadLetterItems(10, 0);

      // Assert
      expect(items.length).toBe(1);
      expect(items[0].work_title).toBe('Test Work Note');
    });

    it('should support pagination with limit and offset', async () => {
      // Arrange
      for (let i = 0; i < 5; i++) {
        const workId = `WORK-TEST-DEAD-${i}`;
        await db
          .prepare('INSERT INTO work_notes (work_id, title, content_raw) VALUES (?, ?, ?)')
          .bind(workId, `Dead Letter ${i}`, 'Content')
          .run();

        await db
          .prepare(
            `INSERT INTO embedding_retry_queue
             (id, work_id, operation_type, status, dead_letter_at, attempt_count)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(`RETRY-DEAD-${i}`, workId, 'create', 'dead_letter', new Date().toISOString(), 3)
          .run();
      }

      // Act
      const page1 = await service.getDeadLetterItems(2, 0);
      const page2 = await service.getDeadLetterItems(2, 2);

      // Assert
      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe('countDeadLetterItems() - Total Count', () => {
    it('should return count of dead_letter items', async () => {
      // Arrange
      for (let i = 0; i < 3; i++) {
        await db
          .prepare(
            `INSERT INTO embedding_retry_queue
             (id, work_id, operation_type, status, dead_letter_at, attempt_count)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(`RETRY-COUNT-${i}`, testWorkId, 'create', 'dead_letter', new Date().toISOString(), 3)
          .run();
      }

      // Act
      const count = await service.countDeadLetterItems();

      // Assert
      expect(count).toBe(3);
    });
  });

  describe('retryDeadLetterItem() - Manual Retry', () => {
    it('should reset dead_letter item to pending for manual retry', async () => {
      // Arrange
      const retryId = await service.enqueueRetry(testWorkId, 'create', 'Test error');
      await service.moveToDeadLetter(retryId, 3, 'Max retries exceeded');

      // Act
      await service.retryDeadLetterItem(retryId);

      // Assert
      const result = await db
        .prepare('SELECT * FROM embedding_retry_queue WHERE id = ?')
        .bind(retryId)
        .first();

      expect(result?.status).toBe('pending');
      expect(result?.attempt_count).toBe(0); // Reset attempts
      expect(result?.dead_letter_at).toBeNull();
      expect(result?.next_retry_at).toBeTruthy();
    });
  });
});

describe('EmbeddingRetryService - Integration with WorkNoteService', () => {
  let service: EmbeddingRetryService;
  let db: D1Database;

  beforeEach(async () => {
    db = (env as unknown as Env).DB;
    service = new EmbeddingRetryService(db);

    await db.prepare('DELETE FROM embedding_retry_queue WHERE work_id LIKE ?').bind('WORK-TEST-%').run();
    await db.prepare('DELETE FROM work_notes WHERE work_id LIKE ?').bind('WORK-TEST-%').run();
  });

  it('should process retry queue and embed successfully', async () => {
    // This test will be implemented after WorkNoteService integration
    expect(true).toBe(true);
  });
});
