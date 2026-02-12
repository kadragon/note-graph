-- Migration: 0027_add_work_note_groups
-- Description: Add work note groups table and N:M relationship with work notes

-- ============================================================================
-- Work Note Groups Table
-- ============================================================================

-- Work note groups (업무 그룹)
CREATE TABLE IF NOT EXISTS work_note_groups (
  group_id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Work note to group associations (N:M relationship)
CREATE TABLE IF NOT EXISTS work_note_group_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES work_note_groups(group_id) ON DELETE CASCADE,
  UNIQUE(work_id, group_id)
);

-- ============================================================================
-- Indexes for Query Optimization
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_work_note_groups_name ON work_note_groups(name);
CREATE INDEX IF NOT EXISTS idx_work_note_groups_is_active ON work_note_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_work_note_group_items_work_id ON work_note_group_items(work_id);
CREATE INDEX IF NOT EXISTS idx_work_note_group_items_group_id ON work_note_group_items(group_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================
