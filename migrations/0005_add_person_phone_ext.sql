-- Migration: 0005_add_person_phone_ext
-- Description: Add phone extension column to persons table
-- Trace: SPEC-person-3, TASK-027

-- Add phone extension column (4-digit internal phone number)
ALTER TABLE persons ADD COLUMN phone_ext TEXT;

-- Create index for phone extension lookup
CREATE INDEX IF NOT EXISTS idx_persons_phone_ext ON persons(phone_ext);
