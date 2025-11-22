-- Migration: Add CUSTOM to repeat_rule CHECK constraint
-- This fixes the constraint to include CUSTOM as a valid repeat_rule value

-- SQLite doesn't support ALTER TABLE to modify CHECK constraints
-- So we need to recreate the table with the updated constraint

-- Wrap in transaction for atomicity - prevents data loss on partial failure
BEGIN TRANSACTION;

-- Step 1: Create new table with updated CHECK constraint
CREATE TABLE todos_new (
  todo_id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  due_date TEXT,
  wait_until TEXT,
  status TEXT NOT NULL DEFAULT '진행중' CHECK (status IN ('진행중', '완료', '보류', '중단')),
  repeat_rule TEXT NOT NULL DEFAULT 'NONE' CHECK (repeat_rule IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')),
  recurrence_type TEXT CHECK (recurrence_type IN ('DUE_DATE', 'COMPLETION_DATE')),
  custom_interval INTEGER,
  custom_unit TEXT,
  skip_weekends INTEGER DEFAULT 0
);

-- Step 2: Copy data from old table to new table
INSERT INTO todos_new (
  todo_id, work_id, title, description, created_at, updated_at,
  due_date, wait_until, status, repeat_rule, recurrence_type,
  custom_interval, custom_unit, skip_weekends
)
SELECT
  todo_id, work_id, title, description, created_at, updated_at,
  due_date, wait_until, status, repeat_rule, recurrence_type,
  custom_interval, custom_unit, skip_weekends
FROM todos;

-- Step 3: Drop old table
DROP TABLE todos;

-- Step 4: Rename new table to original name
ALTER TABLE todos_new RENAME TO todos;

-- Step 5: Recreate indexes
CREATE INDEX idx_todos_work_id ON todos(work_id);
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_wait_until ON todos(wait_until);
CREATE INDEX idx_todos_created_at ON todos(created_at);
CREATE INDEX idx_todos_status_due_date ON todos(status, due_date);

COMMIT;
