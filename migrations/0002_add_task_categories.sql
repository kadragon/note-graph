-- Migration: 0002_add_task_categories
-- Description: Add task categories table and N:M relationship with work notes
-- Trace: TASK-003, SPEC-taskcategory-1

-- ============================================================================
-- Task Categories Table
-- ============================================================================

-- Task categories (업무 구분)
CREATE TABLE IF NOT EXISTS task_categories (
  category_id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Work note to task category associations (N:M relationship)
CREATE TABLE IF NOT EXISTS work_note_task_category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES task_categories(category_id) ON DELETE CASCADE,
  UNIQUE(work_id, category_id)
);

-- ============================================================================
-- Indexes for Query Optimization
-- ============================================================================

-- Task category indexes
CREATE INDEX IF NOT EXISTS idx_task_categories_name ON task_categories(name);

-- Work note task category indexes
CREATE INDEX IF NOT EXISTS idx_work_note_task_category_work_id ON work_note_task_category(work_id);
CREATE INDEX IF NOT EXISTS idx_work_note_task_category_category_id ON work_note_task_category(category_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================
