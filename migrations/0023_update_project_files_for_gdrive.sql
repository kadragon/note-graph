-- Migration: 0023_update_project_files_for_gdrive
-- Description: Add Google Drive metadata columns to project_files
-- Trace: SPEC-project-1

ALTER TABLE project_files ADD COLUMN storage_type TEXT NOT NULL DEFAULT 'R2';
ALTER TABLE project_files ADD COLUMN gdrive_file_id TEXT;
ALTER TABLE project_files ADD COLUMN gdrive_folder_id TEXT;
ALTER TABLE project_files ADD COLUMN gdrive_web_view_link TEXT;
