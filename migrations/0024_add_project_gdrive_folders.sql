-- Migration: 0024_add_project_gdrive_folders
-- Description: Add project Google Drive folder mapping table
-- Trace: SPEC-project-1

CREATE TABLE IF NOT EXISTS project_gdrive_folders (
  project_id TEXT PRIMARY KEY REFERENCES projects(project_id) ON DELETE CASCADE,
  gdrive_folder_id TEXT NOT NULL,
  gdrive_folder_link TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
