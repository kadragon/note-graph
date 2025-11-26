-- Migration: 0014_add_project_management
-- Description: Add project management feature with file attachments and RAG integration
-- Trace: TASK-035, SPEC-project-1

-- ============================================================================
-- Project Management Tables
-- ============================================================================

-- Projects (main entity)
-- Note: updated_at must be set explicitly in application code on UPDATE operations
CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT '진행중' CHECK (status IN ('진행중', '완료', '보류', '중단')),
  tags TEXT,
  priority TEXT CHECK (priority IN ('높음', '중간', '낮음')),
  start_date TEXT,
  target_end_date TEXT,
  actual_end_date TEXT,
  leader_person_id TEXT REFERENCES persons(person_id) ON DELETE SET NULL,
  dept_name TEXT REFERENCES departments(dept_name) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

-- Project participants (team members)
CREATE TABLE IF NOT EXISTS project_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT '참여자',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, person_id)
);

-- Project work note associations (1:N relationship - work note belongs to at most one project)
CREATE TABLE IF NOT EXISTS project_work_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(work_id)
);

-- Project files (R2 attachments)
-- Note: updated_at must be set explicitly in application code on UPDATE operations
CREATE TABLE IF NOT EXISTS project_files (
  file_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  embedded_at TEXT,
  deleted_at TEXT
);

-- ============================================================================
-- Extend Existing Tables
-- ============================================================================

-- Add project_id to work_notes for optional project association
ALTER TABLE work_notes ADD COLUMN project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL;

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_leader ON projects(leader_person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_dept ON projects(dept_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, target_end_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);

-- Project participants indexes
CREATE INDEX IF NOT EXISTS idx_project_participants_project ON project_participants(project_id);
CREATE INDEX IF NOT EXISTS idx_project_participants_person ON project_participants(person_id);

-- Project work notes indexes
CREATE INDEX IF NOT EXISTS idx_project_work_notes_project ON project_work_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_work_notes_work ON project_work_notes(work_id);

-- Project files indexes
CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_files_r2_key ON project_files(r2_key);
CREATE INDEX IF NOT EXISTS idx_project_files_deleted_at ON project_files(deleted_at);

-- Work notes project_id index
CREATE INDEX IF NOT EXISTS idx_work_notes_project_id ON work_notes(project_id);
