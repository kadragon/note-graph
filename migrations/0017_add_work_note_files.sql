-- Migration: 0017_add_work_note_files
-- Description: Add file attachment feature for work notes with R2 storage
-- Trace: TASK-057, SPEC-worknote-attachments-1

-- ============================================================================
-- Work Note File Attachments
-- ============================================================================

-- Work note files (R2 attachments)
CREATE TABLE IF NOT EXISTS work_note_files (
  file_id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Work note files indexes
CREATE INDEX IF NOT EXISTS idx_work_note_files_work ON work_note_files(work_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_note_files_r2_key ON work_note_files(r2_key);
CREATE INDEX IF NOT EXISTS idx_work_note_files_deleted_at ON work_note_files(deleted_at);
