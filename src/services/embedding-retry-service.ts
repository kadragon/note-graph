// Trace: SPEC-rag-2, TASK-022
// Embedding Retry Service with exponential backoff

import { nanoid } from 'nanoid';
import type {
  EmbeddingRetryQueueItem,
  EmbeddingRetryQueueItemWithWorkNote,
  DeadLetterItem,
  RetryProcessorConfig,
} from '../types/embedding-retry';

export class EmbeddingRetryService {
  private config: RetryProcessorConfig;

  constructor(
    private db: D1Database,
    config?: Partial<RetryProcessorConfig>
  ) {
    this.config = {
      maxAttempts: 3,
      batchSize: 10,
      exponentialBackoffBase: 2,
      ...config,
    };
  }

  /**
   * Generate retry queue item ID in format RETRY-{nanoid}
   */
  private generateRetryId(): string {
    return `RETRY-${nanoid()}`;
  }

  /**
   * Calculate exponential backoff delay
   * Formula: delay = 2^attempt_count seconds
   * Attempt 0: immediate (0s)
   * Attempt 1: 2s
   * Attempt 2: 4s
   * Attempt 3: 8s
   */
  private calculateBackoffDelay(attemptCount: number): number {
    if (attemptCount === 0) return 0; // Immediate retry for first attempt
    return Math.pow(this.config.exponentialBackoffBase, attemptCount) * 1000; // milliseconds
  }

  /**
   * Enqueue a failed embedding operation for retry
   * Creates a new retry queue entry with status='pending' and immediate retry
   */
  async enqueueRetry(
    workId: string,
    operationType: 'create' | 'update' | 'delete',
    errorMessage: string,
    errorDetails?: unknown
  ): Promise<string> {
    const retryId = this.generateRetryId();
    const now = new Date().toISOString();
    const nextRetryAt = new Date(Date.now() + this.calculateBackoffDelay(0)).toISOString();

    // Check if retry entry already exists for this work_id and operation
    const existing = await this.db
      .prepare(
        `SELECT id FROM embedding_retry_queue
         WHERE work_id = ? AND operation_type = ? AND status != 'dead_letter'
         LIMIT 1`
      )
      .bind(workId, operationType)
      .first<{ id: string }>();

    if (existing) {
      // Return existing retry ID instead of creating duplicate
      return existing.id;
    }

    await this.db
      .prepare(
        `INSERT INTO embedding_retry_queue
         (id, work_id, operation_type, attempt_count, max_attempts, next_retry_at, status,
          error_message, error_details, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        retryId,
        workId,
        operationType,
        0,
        this.config.maxAttempts,
        nextRetryAt,
        'pending',
        errorMessage,
        errorDetails ? JSON.stringify(errorDetails) : null,
        now,
        now
      )
      .run();

    return retryId;
  }

  /**
   * Get retry queue items ready for processing
   * Returns items with status='pending' and next_retry_at <= now
   */
  async getRetryableItems(limit: number = 10): Promise<EmbeddingRetryQueueItemWithWorkNote[]> {
    const now = new Date().toISOString();

    const results = await this.db
      .prepare(
        `SELECT
           r.*,
           w.title as work_title
         FROM embedding_retry_queue r
         LEFT JOIN work_notes w ON r.work_id = w.work_id
         WHERE r.status = 'pending'
         AND r.next_retry_at <= ?
         ORDER BY r.next_retry_at ASC
         LIMIT ?`
      )
      .bind(now, limit)
      .all<EmbeddingRetryQueueItemWithWorkNote>();

    return results.results || [];
  }

  /**
   * Update retry attempt with exponential backoff
   * Increments attempt_count and calculates next retry time
   */
  async updateRetryAttempt(
    retryId: string,
    newAttemptCount: number,
    errorMessage: string,
    errorDetails?: unknown
  ): Promise<void> {
    const delay = this.calculateBackoffDelay(newAttemptCount);
    const nextRetryAt = new Date(Date.now() + delay).toISOString();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE embedding_retry_queue
         SET attempt_count = ?,
             next_retry_at = ?,
             error_message = ?,
             error_details = ?,
             updated_at = ?,
             status = 'pending'
         WHERE id = ?`
      )
      .bind(
        newAttemptCount,
        nextRetryAt,
        errorMessage,
        errorDetails ? JSON.stringify(errorDetails) : null,
        now,
        retryId
      )
      .run();
  }

  /**
   * Move retry item to dead-letter queue after max attempts exceeded
   */
  async moveToDeadLetter(
    retryId: string,
    finalAttemptCount: number,
    errorMessage: string,
    errorDetails?: unknown
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE embedding_retry_queue
         SET status = 'dead_letter',
             attempt_count = ?,
             error_message = ?,
             error_details = ?,
             dead_letter_at = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(
        finalAttemptCount,
        errorMessage,
        errorDetails ? JSON.stringify(errorDetails) : null,
        now,
        now,
        retryId
      )
      .run();
  }

  /**
   * Delete retry item after successful embedding
   */
  async deleteRetryItem(retryId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM embedding_retry_queue WHERE id = ?')
      .bind(retryId)
      .run();
  }

  /**
   * Get dead-letter items for admin review
   * Returns items with status='dead_letter'
   */
  async getDeadLetterItems(limit: number = 50, offset: number = 0): Promise<DeadLetterItem[]> {
    const results = await this.db
      .prepare(
        `SELECT
           r.id,
           r.work_id,
           w.title as work_title,
           r.operation_type,
           r.attempt_count,
           r.status,
           r.error_message,
           r.error_details,
           r.created_at,
           r.dead_letter_at
         FROM embedding_retry_queue r
         LEFT JOIN work_notes w ON r.work_id = w.work_id
         WHERE r.status = 'dead_letter'
         ORDER BY r.dead_letter_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(limit, offset)
      .all<DeadLetterItem>();

    return results.results || [];
  }

  /**
   * Count total dead-letter items
   */
  async countDeadLetterItems(): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as count
         FROM embedding_retry_queue
         WHERE status = 'dead_letter'`
      )
      .first<{ count: number }>();

    return result?.count || 0;
  }

  /**
   * Manually retry a dead-letter item (admin action)
   * Resets the item to pending status with attempt_count=0
   */
  async retryDeadLetterItem(retryId: string): Promise<void> {
    const now = new Date().toISOString();
    const nextRetryAt = new Date(Date.now() + this.calculateBackoffDelay(0)).toISOString();

    await this.db
      .prepare(
        `UPDATE embedding_retry_queue
         SET status = 'pending',
             attempt_count = 0,
             next_retry_at = ?,
             dead_letter_at = NULL,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(nextRetryAt, now, retryId)
      .run();
  }

  /**
   * Get retry item by ID
   */
  async getRetryItem(retryId: string): Promise<EmbeddingRetryQueueItem | null> {
    const result = await this.db
      .prepare('SELECT * FROM embedding_retry_queue WHERE id = ?')
      .bind(retryId)
      .first<EmbeddingRetryQueueItem>();

    return result || null;
  }
}
