// Trace: SPEC-rag-2, TASK-022
// Type definitions for embedding retry mechanism

export interface EmbeddingRetryQueueItem {
  id: string; // RETRY-{nanoid}
  work_id: string;
  operation_type: 'create' | 'update' | 'delete';
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null; // ISO datetime
  status: 'pending' | 'retrying' | 'dead_letter';
  error_message: string | null;
  error_details: string | null; // JSON serialized
  created_at: string;
  updated_at: string;
  dead_letter_at: string | null;
}

export interface EmbeddingRetryQueueItemWithWorkNote extends EmbeddingRetryQueueItem {
  work_title: string; // Joined from work_notes
}

export interface CreateRetryQueueItemInput {
  work_id: string;
  operation_type: 'create' | 'update' | 'delete';
  error_message: string;
  error_details?: unknown;
}

export interface DeadLetterItem {
  id: string;
  work_id: string;
  work_title: string;
  operation_type: string;
  attempt_count: number;
  status: string; // Always 'dead_letter' for these items
  error_message: string | null;
  error_details: string | null;
  created_at: string;
  dead_letter_at: string;
}

export interface RetryProcessorConfig {
  maxAttempts: number; // Default: 3
  batchSize: number; // Default: 10
  exponentialBackoffBase: number; // Default: 2 (seconds)
}
