-- Migration: 0005_add_person_phone_ext
-- Description: Add phone extension column to persons table
-- Trace: SPEC-person-3, TASK-027

-- Add phone extension column (4-digit internal phone number)
-- CHECK constraint ensures only 4-digit numbers are stored
ALTER TABLE persons ADD COLUMN phone_ext TEXT CHECK(phone_ext IS NULL OR (length(phone_ext) = 4 AND NOT phone_ext GLOB '*[^0-9]*'));

-- Create index for phone extension lookup
CREATE INDEX IF NOT EXISTS idx_persons_phone_ext ON persons(phone_ext);
