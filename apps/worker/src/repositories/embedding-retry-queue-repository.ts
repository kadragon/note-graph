// Trace: SPEC-rag-2, TASK-069
/**
 * Repository for embedding retry queue management
 * Handles dead-letter queue queries and manual retry operations
 */

import type { EmbeddingFailure, EmbeddingRetryQueueItem } from '@shared/types/embedding-retry';
import type { DatabaseClient } from '../types/database';

export class EmbeddingRetryQueueRepository {
  constructor(private db: DatabaseClient) {}

  /**
   * Find all dead-letter embedding failures with work note details
   * Used by GET /admin/embedding-failures
   */
  async findDeadLetterItems(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ items: EmbeddingFailure[]; total: number }> {
    const itemsQuery = `
      SELECT
        erq.id,
        erq.work_id as workId,
        wn.title as workTitle,
        erq.operation_type as operationType,
        erq.attempt_count as attemptCount,
        erq.error_message as errorMessage,
        erq.created_at as createdAt,
        erq.dead_letter_at as deadLetterAt
      FROM embedding_retry_queue erq
      LEFT JOIN work_notes wn ON erq.work_id = wn.work_id
      WHERE erq.status = 'dead_letter'
      ORDER BY erq.dead_letter_at DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = `
      SELECT COUNT(*) as count
      FROM embedding_retry_queue
      WHERE status = 'dead_letter'
    `;

    const [itemsResult, countResult] = await Promise.all([
      this.db.query<EmbeddingFailure>(itemsQuery, [limit, offset]),
      this.db.queryOne<{ count: number }>(countQuery),
    ]);

    return {
      items: itemsResult.rows,
      total: countResult?.count || 0,
    };
  }

  /**
   * Find a single retry queue item by ID
   */
  async findById(id: string): Promise<EmbeddingRetryQueueItem | null> {
    return this.db.queryOne<EmbeddingRetryQueueItem>(
      `SELECT
        id,
        work_id as workId,
        operation_type as operationType,
        attempt_count as attemptCount,
        max_attempts as maxAttempts,
        next_retry_at as nextRetryAt,
        status,
        error_message as errorMessage,
        error_details as errorDetails,
        created_at as createdAt,
        updated_at as updatedAt,
        dead_letter_at as deadLetterAt
      FROM embedding_retry_queue
      WHERE id = $1`,
      [id]
    );
  }

  /**
   * Reset a dead-letter item to pending status for manual retry
   */
  async resetToPending(id: string): Promise<boolean> {
    const now = new Date().toISOString();

    const result = await this.db.execute(
      `UPDATE embedding_retry_queue
       SET
         status = 'pending',
         next_retry_at = $1,
         updated_at = $2,
         dead_letter_at = NULL
       WHERE id = $3 AND status = 'dead_letter'`,
      [now, now, id]
    );

    return result.rowCount > 0;
  }

  /**
   * Update retry item status
   */
  async updateStatus(id: string, status: 'pending' | 'retrying' | 'dead_letter'): Promise<void> {
    const now = new Date().toISOString();

    await this.db.execute(
      `UPDATE embedding_retry_queue
       SET status = $1, updated_at = $2
       WHERE id = $3`,
      [status, now, id]
    );
  }

  /**
   * Delete a retry queue item
   */
  async delete(id: string): Promise<void> {
    await this.db.execute(`DELETE FROM embedding_retry_queue WHERE id = $1`, [id]);
  }
}
