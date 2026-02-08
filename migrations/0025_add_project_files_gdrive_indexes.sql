-- Migration: 0025_add_project_files_gdrive_indexes
-- Description: Add indexes for project_files Google Drive metadata
-- Trace: SPEC-project-1

CREATE INDEX IF NOT EXISTS idx_project_files_storage_type ON project_files(storage_type);
CREATE INDEX IF NOT EXISTS idx_project_files_gdrive_file_id ON project_files(gdrive_file_id);
