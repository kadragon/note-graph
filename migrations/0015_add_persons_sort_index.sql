-- Migration: Add composite index for person list sorting
-- Trace: SPEC-person-3, TASK-045
-- Date: 2025-11-28
-- Description: Add index to optimize person list sorting by dept → name → position → personId → phoneExt → createdAt

-- Create composite index for person list default sort order
-- This index optimizes the query: ORDER BY current_dept ASC NULLS LAST, name ASC, current_position ASC NULLS LAST, person_id ASC, phone_ext ASC NULLS LAST, created_at ASC
CREATE INDEX IF NOT EXISTS idx_persons_sort
ON persons(current_dept, name, current_position, person_id, phone_ext, created_at);
