-- Migration: 0005_add_todos_updated_at
-- Description: Add updated_at column to todos table for tracking modification timestamps
-- Trace: PR-30 review feedback

-- ============================================================================
-- Add updated_at column to todos table
-- ============================================================================

-- Add updated_at column with default value
-- Note: SQLite doesn't support DEFAULT (datetime('now')) for ALTER TABLE,
-- so we set default to empty string first, then update existing rows
ALTER TABLE todos ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

-- Update existing rows to set updated_at = created_at
UPDATE todos SET updated_at = created_at WHERE updated_at = '';

-- ============================================================================
-- Add index for updated_at column
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_todos_updated_at ON todos(updated_at);

-- ============================================================================
-- Migration Complete
-- ============================================================================
