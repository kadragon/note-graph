-- Add priority column to todos table
-- Priority: 1=긴급, 2=높음, 3=보통(default), 4=낮음
ALTER TABLE todos
  ADD COLUMN priority SMALLINT NOT NULL DEFAULT 3
    CHECK (priority >= 1 AND priority <= 4);

-- Composite index for work-note-level priority sorting
CREATE INDEX idx_todos_work_priority ON todos(work_id, priority, created_at DESC);
