// Trace: SPEC-rag-2, TASK-069
/**
 * Repository for embedding retry queue management
 * Handles dead-letter queue queries and manual retry operations
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { EmbeddingFailure, EmbeddingRetryQueueItem } from '@shared/types/embedding-retry';

export class EmbeddingRetryQueueRepository {
  constructor(private db: D1Database) {}

  /**
   * Find all dead-letter embedding failures with work note details
   * Used by GET /admin/embedding-failures
   *
   * @param limit - Maximum number of items to return
   * @param offset - Number of items to skip
   * @returns List of dead-letter items with work note titles
   */
  async findDeadLetterItems(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ items: EmbeddingFailure[]; total: number }> {
    // Query dead-letter items with work note title
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
      LIMIT ? OFFSET ?
    `;

    // Query total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM embedding_retry_queue
      WHERE status = 'dead_letter'
    `;

    const [itemsResult, countResult] = await Promise.all([
      this.db.prepare(itemsQuery).bind(limit, offset).all<EmbeddingFailure>(),
      this.db.prepare(countQuery).first<{ count: number }>(),
    ]);

    return {
      items: itemsResult.results || [],
      total: countResult?.count || 0,
    };
  }

  /**
   * Find a single retry queue item by ID
   * Used for validating retry requests
   *
   * @param id - Retry queue item ID
   * @returns Retry queue item or null if not found
   */
  async findById(id: string): Promise<EmbeddingRetryQueueItem | null> {
    const query = `
      SELECT
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
      WHERE id = ?
    `;

    const result = await this.db.prepare(query).bind(id).first<EmbeddingRetryQueueItem>();

    return result || null;
  }

  /**
   * Reset a dead-letter item to pending status for manual retry
   * Used by POST /admin/embedding-failures/{id}/retry
   *
   * @param id - Retry queue item ID
   * @returns Success boolean
   */
  async resetToPending(id: string): Promise<boolean> {
    const now = new Date().toISOString();

    const query = `
      UPDATE embedding_retry_queue
      SET
        status = 'pending',
        next_retry_at = ?,
        updated_at = ?,
        dead_letter_at = NULL
      WHERE id = ? AND status = 'dead_letter'
    `;

    const result = await this.db.prepare(query).bind(now, now, id).run();

    return (result.meta.changes || 0) > 0;
  }

  /**
   * Update retry item status
   * Used for tracking retry progress
   *
   * @param id - Retry queue item ID
   * @param status - New status
   */
  async updateStatus(id: string, status: 'pending' | 'retrying' | 'dead_letter'): Promise<void> {
    const now = new Date().toISOString();

    const query = `
      UPDATE embedding_retry_queue
      SET status = ?, updated_at = ?
      WHERE id = ?
    `;

    await this.db.prepare(query).bind(status, now, id).run();
  }

  /**
   * Delete a retry queue item
   * Used when retry succeeds
   *
   * @param id - Retry queue item ID
   */
  async delete(id: string): Promise<void> {
    const query = `DELETE FROM embedding_retry_queue WHERE id = ?`;
    await this.db.prepare(query).bind(id).run();
  }
}
