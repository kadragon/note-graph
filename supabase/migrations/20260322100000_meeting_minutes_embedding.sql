-- Add embedded_at column to meeting_minutes for vector embedding tracking
ALTER TABLE meeting_minutes ADD COLUMN embedded_at TIMESTAMPTZ;

-- Drop unused embedding_retry_queue table (replaced by cron-based embed-pending)
DROP TABLE IF EXISTS embedding_retry_queue;
DROP TYPE IF EXISTS embedding_retry_status_enum;
