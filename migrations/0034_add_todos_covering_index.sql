-- Covering index for active todos view
-- Covers common query pattern: list active todos with due_date ordering
CREATE INDEX IF NOT EXISTS idx_todos_active_view
  ON todos(due_date, created_at DESC)
  INCLUDE (wait_until, work_id, title)
  WHERE status = '진행중';
