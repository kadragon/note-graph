-- Migration: Remove project feature
-- Drop all project-related tables and columns

-- Drop index on work_notes.project_id first
DROP INDEX IF EXISTS idx_work_notes_project_id;

-- Drop project-related tables (order matters for foreign keys)
DROP TABLE IF EXISTS project_gdrive_folders;
DROP TABLE IF EXISTS project_files;
DROP TABLE IF EXISTS project_work_notes;
DROP TABLE IF EXISTS project_participants;
DROP TABLE IF EXISTS projects;

-- Remove project_id column from work_notes
ALTER TABLE work_notes DROP COLUMN project_id;
