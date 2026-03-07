-- Partial index for finding work notes with pending embeddings.
-- Covers the WHERE embedded_at IS NULL query used by findPendingEmbedding().
CREATE INDEX IF NOT EXISTS idx_work_notes_pending_embedding
  ON work_notes(created_at ASC)
  WHERE embedded_at IS NULL;
