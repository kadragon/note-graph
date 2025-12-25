// Trace: SPEC-rag-2, TASK-069
/**
 * Types for embedding retry queue and dead-letter management
 */

export type EmbeddingOperationType = 'create' | 'update' | 'delete';
export type EmbeddingRetryStatus = 'pending' | 'retrying' | 'dead_letter';

/**
 * Embedding retry queue entry
 * Stores failed embedding operations for automatic retry with exponential backoff
 */
export interface EmbeddingRetryQueueItem {
  id: string;
  workId: string;
  operationType: EmbeddingOperationType;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  status: EmbeddingRetryStatus;
  errorMessage: string | null;
  errorDetails: string | null; // JSON serialized
  createdAt: string;
  updatedAt: string;
  deadLetterAt: string | null;
}

/**
 * Embedding failure for admin dead-letter queue view
 * Includes work note title for better UX
 */
export interface EmbeddingFailure {
  id: string;
  workId: string;
  workTitle: string;
  operationType: EmbeddingOperationType;
  attemptCount: number;
  errorMessage: string | null;
  createdAt: string;
  deadLetterAt: string;
}

/**
 * Response for listing dead-letter embedding failures
 */
export interface EmbeddingFailuresResponse {
  items: EmbeddingFailure[];
  total: number;
}

/**
 * Response for manually retrying a dead-letter item
 */
export interface RetryEmbeddingFailureResponse {
  success: boolean;
  message: string;
  status: EmbeddingRetryStatus;
}
