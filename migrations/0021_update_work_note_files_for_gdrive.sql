-- Migration: 0021_update_work_note_files_for_gdrive
-- Description: Add Google Drive fields to work_note_files table

-- Google Drive 필드 추가
ALTER TABLE work_note_files ADD COLUMN gdrive_file_id TEXT;
ALTER TABLE work_note_files ADD COLUMN gdrive_folder_id TEXT;
ALTER TABLE work_note_files ADD COLUMN gdrive_web_view_link TEXT;
ALTER TABLE work_note_files ADD COLUMN storage_type TEXT NOT NULL DEFAULT 'R2';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_work_note_files_storage_type ON work_note_files(storage_type);
CREATE INDEX IF NOT EXISTS idx_work_note_files_gdrive_file_id ON work_note_files(gdrive_file_id);

-- 업무노트별 Google Drive 폴더 추적
CREATE TABLE IF NOT EXISTS work_note_gdrive_folders (
  work_id TEXT PRIMARY KEY REFERENCES work_notes(work_id) ON DELETE CASCADE,
  gdrive_folder_id TEXT NOT NULL,
  gdrive_folder_link TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
