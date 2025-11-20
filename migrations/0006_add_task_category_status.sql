-- Migration: 0006_add_task_category_status
-- Description: Add is_active status to task_categories table for filtering suggestions
-- Trace: User request - task category active/inactive feature

-- Add is_active column to task_categories table
-- Default to 1 (active) for existing categories
ALTER TABLE task_categories ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

-- Create index for filtering by active status
CREATE INDEX IF NOT EXISTS idx_task_categories_is_active ON task_categories(is_active);

