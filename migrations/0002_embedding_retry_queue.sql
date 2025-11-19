-- Migration: 0002_embedding_retry_queue
-- Purpose: Add embedding retry queue for eventual consistency between D1 and Vectorize
-- Spec: SPEC-rag-2
-- Task: TASK-022

-- ============================================================================
-- Embedding Retry Queue Table
-- ============================================================================
-- Stores failed embedding operations for automatic retry with exponential backoff
-- Ensures eventual consistency when Vectorize operations fail temporarily

CREATE TABLE IF NOT EXISTS embedding_retry_queue (
  id TEXT PRIMARY KEY,                      -- Unique retry job ID (nanoid)
  work_id TEXT NOT NULL,                    -- Foreign key to work_notes
  operation_type TEXT NOT NULL,             -- 'create', 'update', 'delete'
  attempt_count INTEGER DEFAULT 0,          -- Current retry attempt number
  max_attempts INTEGER DEFAULT 3,           -- Maximum retry attempts before dead-letter
  next_retry_at TEXT,                       -- ISO datetime for next retry (NULL if in dead-letter)
  status TEXT DEFAULT 'pending',            -- 'pending', 'retrying', 'dead_letter'
  error_message TEXT,                       -- Last error message
  error_details TEXT,                       -- Last error details (JSON serialized)
  created_at TEXT DEFAULT (datetime('now')),-- When first failure occurred
  updated_at TEXT DEFAULT (datetime('now')),-- Last status update
  dead_letter_at TEXT,                      -- When moved to dead-letter (NULL if not)

  FOREIGN KEY (work_id) REFERENCES work_notes(work_id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes for Retry Queue Operations
-- ============================================================================

-- Index for finding items ready for retry (most common query)
CREATE INDEX idx_retry_queue_next_retry
ON embedding_retry_queue(status, next_retry_at)
WHERE status = 'pending';

-- Index for filtering by status (admin queries)
CREATE INDEX idx_retry_queue_status
ON embedding_retry_queue(status);

-- Index for work_id lookups and cascading deletes
CREATE INDEX idx_retry_queue_work_id
ON embedding_retry_queue(work_id);

-- Index for dead-letter items (admin queries)
CREATE INDEX idx_retry_queue_dead_letter
ON embedding_retry_queue(dead_letter_at)
WHERE status = 'dead_letter';

-- ============================================================================
-- Comments
-- ============================================================================
--
-- Retry Logic:
-- 1. When embedding fails, create entry with status='pending', attempt_count=0
-- 2. Background processor queries for status='pending' AND next_retry_at <= NOW()
-- 3. On retry failure: increment attempt_count, update next_retry_at with exponential backoff
-- 4. On retry success: delete entry from queue
-- 5. When attempt_count >= max_attempts: set status='dead_letter', set dead_letter_at
--
-- Exponential Backoff Schedule:
-- - Attempt 1: immediate (next_retry_at = now)
-- - Attempt 2: 2 seconds later
-- - Attempt 3: 4 seconds later
-- - Attempt 4+: 8 seconds later (if max_attempts increased)
--
-- Dead Letter Queue:
-- - Items with status='dead_letter' require manual intervention
-- - Admin can view via GET /admin/embedding-failures
-- - Admin can retry via POST /admin/embedding-failures/{id}/retry
-- - Preserved indefinitely for audit and debugging
--
-- Trace: SPEC-rag-2, TASK-022
