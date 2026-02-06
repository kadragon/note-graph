-- Migration: 0022_remove_unused_project_fields
-- Description: Remove unused project fields (priority, target_end_date, leader_person_id)
-- Trace: TASK-066

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS projects_new (
  project_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT '진행중' CHECK (status IN ('진행중', '완료', '보류', '중단')),
  tags TEXT,
  start_date TEXT,
  actual_end_date TEXT,
  dept_name TEXT REFERENCES departments(dept_name) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

INSERT INTO projects_new (
  project_id,
  name,
  description,
  status,
  tags,
  start_date,
  actual_end_date,
  dept_name,
  created_at,
  updated_at,
  deleted_at
)
SELECT
  project_id,
  name,
  description,
  status,
  tags,
  start_date,
  actual_end_date,
  dept_name,
  created_at,
  updated_at,
  deleted_at
FROM projects;

DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_dept ON projects(dept_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON projects(start_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);

PRAGMA foreign_keys = ON;
