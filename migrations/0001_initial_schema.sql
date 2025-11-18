-- Migration: 0001_initial_schema
-- Description: Initial database schema for work note management system
-- Trace: TASK-002, SPEC-worknote-1, SPEC-person-1, SPEC-dept-1, SPEC-todo-1, SPEC-pdf-1

-- ============================================================================
-- Core Entity Tables
-- ============================================================================

-- Persons (colleagues/contacts)
CREATE TABLE IF NOT EXISTS persons (
  person_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  current_dept TEXT,
  current_position TEXT,
  current_role_desc TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  dept_name TEXT PRIMARY KEY,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Person department assignment history
CREATE TABLE IF NOT EXISTS person_dept_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id TEXT NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
  dept_name TEXT NOT NULL REFERENCES departments(dept_name) ON DELETE CASCADE,
  position TEXT,
  role_desc TEXT,
  start_date TEXT NOT NULL DEFAULT (datetime('now')),
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

-- Work notes
CREATE TABLE IF NOT EXISTS work_notes (
  work_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content_raw TEXT NOT NULL,
  category TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Work note to person associations
CREATE TABLE IF NOT EXISTS work_note_person (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'RELATED'))
);

-- Work note relations (related work notes)
CREATE TABLE IF NOT EXISTS work_note_relation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  related_work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  UNIQUE(work_id, related_work_id)
);

-- Work note versions (keep max 5)
CREATE TABLE IF NOT EXISTS work_note_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  content_raw TEXT NOT NULL,
  category TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(work_id, version_no)
);

-- Todos with recurrence support
CREATE TABLE IF NOT EXISTS todos (
  todo_id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  due_date TEXT,
  wait_until TEXT,
  status TEXT NOT NULL DEFAULT '진행중' CHECK (status IN ('진행중', '완료', '보류', '중단')),
  repeat_rule TEXT NOT NULL DEFAULT 'NONE' CHECK (repeat_rule IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY')),
  recurrence_type TEXT CHECK (recurrence_type IN ('DUE_DATE', 'COMPLETION_DATE'))
);

-- PDF processing jobs
CREATE TABLE IF NOT EXISTS pdf_jobs (
  job_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'READY', 'ERROR')),
  r2_key TEXT,
  extracted_text TEXT,
  draft_json TEXT,
  error_message TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- Full-Text Search (FTS5 with trigram tokenizer)
-- ============================================================================

-- FTS5 virtual table for work notes
-- Uses trigram tokenizer for Korean partial matching
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title,
  content_raw,
  category,
  tokenize='trigram',
  content='work_notes',
  content_rowid='rowid'
);

-- ============================================================================
-- FTS Synchronization Triggers
-- ============================================================================

-- Trigger: Sync FTS on INSERT
CREATE TRIGGER IF NOT EXISTS notes_fts_ai
AFTER INSERT ON work_notes
BEGIN
  INSERT INTO notes_fts(rowid, title, content_raw, category)
  VALUES (new.rowid, new.title, new.content_raw, new.category);
END;

-- Trigger: Sync FTS on UPDATE
CREATE TRIGGER IF NOT EXISTS notes_fts_au
AFTER UPDATE ON work_notes
BEGIN
  UPDATE notes_fts
  SET title = new.title,
      content_raw = new.content_raw,
      category = new.category
  WHERE rowid = new.rowid;
END;

-- Trigger: Sync FTS on DELETE
CREATE TRIGGER IF NOT EXISTS notes_fts_ad
AFTER DELETE ON work_notes
BEGIN
  DELETE FROM notes_fts WHERE rowid = old.rowid;
END;

-- ============================================================================
-- Indexes for Query Optimization
-- ============================================================================

-- Person indexes
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);
CREATE INDEX IF NOT EXISTS idx_persons_current_dept ON persons(current_dept);

-- Person department history indexes
CREATE INDEX IF NOT EXISTS idx_person_dept_history_person_id ON person_dept_history(person_id);
CREATE INDEX IF NOT EXISTS idx_person_dept_history_dept_name ON person_dept_history(dept_name);
CREATE INDEX IF NOT EXISTS idx_person_dept_history_is_active ON person_dept_history(is_active);
CREATE INDEX IF NOT EXISTS idx_person_dept_history_person_active ON person_dept_history(person_id, is_active);

-- Work note indexes
CREATE INDEX IF NOT EXISTS idx_work_notes_category ON work_notes(category);
CREATE INDEX IF NOT EXISTS idx_work_notes_created_at ON work_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_work_notes_updated_at ON work_notes(updated_at);

-- Work note person indexes
CREATE INDEX IF NOT EXISTS idx_work_note_person_work_id ON work_note_person(work_id);
CREATE INDEX IF NOT EXISTS idx_work_note_person_person_id ON work_note_person(person_id);
CREATE INDEX IF NOT EXISTS idx_work_note_person_role ON work_note_person(role);

-- Work note relation indexes
CREATE INDEX IF NOT EXISTS idx_work_note_relation_work_id ON work_note_relation(work_id);
CREATE INDEX IF NOT EXISTS idx_work_note_relation_related_work_id ON work_note_relation(related_work_id);

-- Work note versions indexes
CREATE INDEX IF NOT EXISTS idx_work_note_versions_work_id ON work_note_versions(work_id);
CREATE INDEX IF NOT EXISTS idx_work_note_versions_version_no ON work_note_versions(work_id, version_no);

-- Todo indexes
CREATE INDEX IF NOT EXISTS idx_todos_work_id ON todos(work_id);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_wait_until ON todos(wait_until);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);
CREATE INDEX IF NOT EXISTS idx_todos_status_due_date ON todos(status, due_date);

-- PDF job indexes
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_status ON pdf_jobs(status);
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_created_at ON pdf_jobs(created_at);

-- ============================================================================
-- Migration Complete
-- ============================================================================
