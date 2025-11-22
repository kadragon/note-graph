-- Add embedded_at column to track embedding status
-- NULL = not embedded, timestamp = embedded successfully

ALTER TABLE work_notes ADD COLUMN embedded_at TEXT;

-- Create index for efficient queries on unembedded notes
CREATE INDEX idx_work_notes_embedded_at ON work_notes(embedded_at);
