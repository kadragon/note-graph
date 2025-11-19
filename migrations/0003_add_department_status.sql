-- Migration: 0003_add_department_status
-- Description: Add is_active status to departments table to track closed/disbanded departments
-- Trace: User request - issue #6

-- Add is_active column to departments table
-- Default to 1 (active) for existing departments
ALTER TABLE departments ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

-- Create index for filtering by active status
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);
