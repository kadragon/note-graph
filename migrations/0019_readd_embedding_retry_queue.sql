-- Migration: 0019_readd_embedding_retry_queue
-- Purpose: Re-add embedding retry queue for dead-letter management and admin visibility
-- Spec: SPEC-rag-2
-- Task: TASK-069
-- Context: Originally added in 0003, dropped in 0013, now re-added for admin monitoring

-- ============================================================================
-- Embedding Retry Queue Table
-- ============================================================================
-- Stores failed embedding operations for automatic retry with exponential backoff
-- Ensures eventual consistency when Vectorize operations fail temporarily
-- Provides admin interface for viewing and manually retrying dead-letter items

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
CREATE INDEX IF NOT EXISTS idx_retry_queue_next_retry
ON embedding_retry_queue(status, next_retry_at)
WHERE status = 'pending';

-- Index for filtering by status (admin queries)
CREATE INDEX IF NOT EXISTS idx_retry_queue_status
ON embedding_retry_queue(status);

-- Index for work_id lookups and cascading deletes
CREATE INDEX IF NOT EXISTS idx_retry_queue_work_id
ON embedding_retry_queue(work_id);

-- Index for dead-letter items (admin queries)
CREATE INDEX IF NOT EXISTS idx_retry_queue_dead_letter
ON embedding_retry_queue(dead_letter_at)
WHERE status = 'dead_letter';

-- Trace: SPEC-rag-2, TASK-069
