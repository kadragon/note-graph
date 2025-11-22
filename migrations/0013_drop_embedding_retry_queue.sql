-- Drop embedding retry queue table
-- The retry queue is no longer needed since we use embedded_at tracking

DROP TABLE IF EXISTS embedding_retry_queue;
