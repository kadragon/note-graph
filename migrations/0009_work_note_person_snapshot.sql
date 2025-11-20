-- Migration: 0007_work_note_person_snapshot
-- Description: Add department/position snapshot fields to work_note_person for historical accuracy
-- Trace: TASK-LLM-IMPORT

-- Add snapshot fields to capture department and position at the time of work note creation
ALTER TABLE work_note_person ADD COLUMN dept_at_time TEXT;
ALTER TABLE work_note_person ADD COLUMN position_at_time TEXT;

-- Create index for department lookup
CREATE INDEX IF NOT EXISTS idx_work_note_person_dept_at_time ON work_note_person(dept_at_time);
