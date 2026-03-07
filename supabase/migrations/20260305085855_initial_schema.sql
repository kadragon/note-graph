-- Migration: initial_schema (PostgreSQL / Supabase)
-- Description: Complete PostgreSQL schema for work note management system
-- Converted from D1 (SQLite) migrations 0001-0031
-- Tables: 23 (D1 had 25; 2 FTS5 virtual tables replaced by tsvector generated columns)

-- ============================================================================
-- 1. Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 2. ENUM Types
-- ============================================================================

CREATE TYPE employment_status_enum AS ENUM ('재직', '휴직', '퇴직');
CREATE TYPE work_note_person_role_enum AS ENUM ('OWNER', 'RELATED', 'PARTICIPANT');
CREATE TYPE todo_status_enum AS ENUM ('진행중', '완료', '보류', '중단');
CREATE TYPE repeat_rule_enum AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');
CREATE TYPE recurrence_type_enum AS ENUM ('DUE_DATE', 'COMPLETION_DATE');
CREATE TYPE custom_unit_enum AS ENUM ('DAY', 'WEEK', 'MONTH');
CREATE TYPE pdf_job_status_enum AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');
CREATE TYPE embedding_retry_status_enum AS ENUM ('pending', 'retrying', 'dead_letter');

-- ============================================================================
-- 3. Shared Trigger Function: set_updated_at()
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Tables
-- ============================================================================

-- --------------------------------------------------------------------------
-- 4.1 departments
-- --------------------------------------------------------------------------
CREATE TABLE departments (
  dept_name TEXT PRIMARY KEY,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_departments_is_active ON departments(is_active);

-- --------------------------------------------------------------------------
-- 4.2 persons
-- --------------------------------------------------------------------------
CREATE TABLE persons (
  person_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_ext TEXT CHECK (phone_ext IS NULL OR phone_ext ~ '^[0-9-]+$'),
  current_dept TEXT,
  current_position TEXT,
  current_role_desc TEXT,
  employment_status employment_status_enum NOT NULL DEFAULT '재직',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_persons_name ON persons(name);
CREATE INDEX idx_persons_current_dept ON persons(current_dept);
CREATE INDEX idx_persons_phone_ext ON persons(phone_ext);
CREATE INDEX idx_persons_employment_status ON persons(employment_status);
CREATE INDEX idx_persons_sort
  ON persons(current_dept, name, current_position, person_id, phone_ext, created_at);

CREATE TRIGGER trg_persons_updated_at
  BEFORE UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- 4.3 person_dept_history
-- --------------------------------------------------------------------------
CREATE TABLE person_dept_history (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
  dept_name TEXT NOT NULL REFERENCES departments(dept_name) ON DELETE CASCADE,
  position TEXT,
  role_desc TEXT,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_person_dept_history_person_id ON person_dept_history(person_id);
CREATE INDEX idx_person_dept_history_dept_name ON person_dept_history(dept_name);
CREATE INDEX idx_person_dept_history_is_active ON person_dept_history(is_active);
CREATE INDEX idx_person_dept_history_person_active ON person_dept_history(person_id, is_active);

-- --------------------------------------------------------------------------
-- 4.4 work_notes
-- --------------------------------------------------------------------------
CREATE TABLE work_notes (
  work_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content_raw TEXT NOT NULL,
  category TEXT,
  embedded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- FTS: weighted tsvector generated column (replaces notes_fts virtual table)
  fts_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(content_raw, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'C')
  ) STORED
);

CREATE INDEX idx_work_notes_category ON work_notes(category);
CREATE INDEX idx_work_notes_created_at ON work_notes(created_at);
CREATE INDEX idx_work_notes_updated_at ON work_notes(updated_at);
CREATE INDEX idx_work_notes_embedded_at ON work_notes(embedded_at);
CREATE INDEX idx_work_notes_fts ON work_notes USING GIN (fts_vector);
CREATE INDEX idx_work_notes_title_trgm ON work_notes USING GIN (title gin_trgm_ops);

CREATE TRIGGER trg_work_notes_updated_at
  BEFORE UPDATE ON work_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- 4.5 work_note_person
-- --------------------------------------------------------------------------
CREATE TABLE work_note_person (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
  role work_note_person_role_enum NOT NULL,
  dept_at_time TEXT,
  position_at_time TEXT,
  UNIQUE(work_id, person_id)
);

CREATE INDEX idx_work_note_person_work_id ON work_note_person(work_id);
CREATE INDEX idx_work_note_person_person_id ON work_note_person(person_id);
CREATE INDEX idx_work_note_person_role ON work_note_person(role);
CREATE INDEX idx_work_note_person_dept_at_time ON work_note_person(dept_at_time);
CREATE INDEX idx_work_note_person_work_role ON work_note_person(work_id, role);

-- --------------------------------------------------------------------------
-- 4.6 work_note_relation
-- --------------------------------------------------------------------------
CREATE TABLE work_note_relation (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  related_work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  UNIQUE(work_id, related_work_id)
);

CREATE INDEX idx_work_note_relation_work_id ON work_note_relation(work_id);
CREATE INDEX idx_work_note_relation_related_work_id ON work_note_relation(related_work_id);

-- --------------------------------------------------------------------------
-- 4.7 work_note_versions
-- --------------------------------------------------------------------------
CREATE TABLE work_note_versions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL,
  title TEXT NOT NULL,
  content_raw TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(work_id, version_no)
);

CREATE INDEX idx_work_note_versions_work_id ON work_note_versions(work_id);
CREATE INDEX idx_work_note_versions_version_no ON work_note_versions(work_id, version_no);

-- Trigger: enforce max 5 versions per work note
CREATE OR REPLACE FUNCTION enforce_work_note_versions_limit()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM work_note_versions
  WHERE work_id = NEW.work_id
    AND id NOT IN (
      SELECT id FROM work_note_versions
      WHERE work_id = NEW.work_id
      ORDER BY version_no DESC
      LIMIT 5
    );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_work_note_versions_limit
  AFTER INSERT ON work_note_versions
  FOR EACH ROW EXECUTE FUNCTION enforce_work_note_versions_limit();

-- --------------------------------------------------------------------------
-- 4.8 task_categories
-- --------------------------------------------------------------------------
CREATE TABLE task_categories (
  category_id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_categories_name ON task_categories(name);
CREATE INDEX idx_task_categories_is_active ON task_categories(is_active);

-- --------------------------------------------------------------------------
-- 4.9 work_note_task_category
-- --------------------------------------------------------------------------
CREATE TABLE work_note_task_category (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES task_categories(category_id) ON DELETE CASCADE,
  UNIQUE(work_id, category_id)
);

CREATE INDEX idx_work_note_task_category_work_id ON work_note_task_category(work_id);
CREATE INDEX idx_work_note_task_category_category_id ON work_note_task_category(category_id);

-- --------------------------------------------------------------------------
-- 4.10 todos
-- --------------------------------------------------------------------------
CREATE TABLE todos (
  todo_id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date DATE,
  wait_until DATE,
  status todo_status_enum NOT NULL DEFAULT '진행중',
  repeat_rule repeat_rule_enum NOT NULL DEFAULT 'NONE',
  recurrence_type recurrence_type_enum,
  custom_interval INTEGER,
  custom_unit custom_unit_enum,
  skip_weekends BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_todos_work_id ON todos(work_id);
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_wait_until ON todos(wait_until);
CREATE INDEX idx_todos_created_at ON todos(created_at);
CREATE INDEX idx_todos_updated_at ON todos(updated_at);
CREATE INDEX idx_todos_status_due_date ON todos(status, due_date);
CREATE INDEX idx_todos_status_due_created ON todos(status, due_date, created_at DESC);

CREATE TRIGGER trg_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- 4.11 pdf_jobs
-- --------------------------------------------------------------------------
CREATE TABLE pdf_jobs (
  job_id TEXT PRIMARY KEY,
  status pdf_job_status_enum NOT NULL DEFAULT 'PENDING',
  r2_key TEXT,
  extracted_text TEXT,
  draft_json JSONB,
  error_message TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pdf_jobs_status ON pdf_jobs(status);
CREATE INDEX idx_pdf_jobs_created_at ON pdf_jobs(created_at);

CREATE TRIGGER trg_pdf_jobs_updated_at
  BEFORE UPDATE ON pdf_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- 4.12 embedding_retry_queue
-- --------------------------------------------------------------------------
CREATE TABLE embedding_retry_queue (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('create', 'update', 'delete')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  status embedding_retry_status_enum NOT NULL DEFAULT 'pending',
  error_message TEXT,
  error_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dead_letter_at TIMESTAMPTZ
);

CREATE INDEX idx_retry_queue_next_retry
  ON embedding_retry_queue(status, next_retry_at)
  WHERE status = 'pending';
CREATE INDEX idx_retry_queue_status ON embedding_retry_queue(status);
CREATE INDEX idx_retry_queue_work_id ON embedding_retry_queue(work_id);
CREATE INDEX idx_retry_queue_dead_letter
  ON embedding_retry_queue(dead_letter_at)
  WHERE status = 'dead_letter';

CREATE TRIGGER trg_embedding_retry_queue_updated_at
  BEFORE UPDATE ON embedding_retry_queue
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- 4.13 work_note_files
-- --------------------------------------------------------------------------
CREATE TABLE work_note_files (
  file_id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  gdrive_file_id TEXT,
  gdrive_folder_id TEXT,
  gdrive_web_view_link TEXT,
  storage_type TEXT NOT NULL DEFAULT 'R2'
);

CREATE INDEX idx_work_note_files_work ON work_note_files(work_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_note_files_r2_key ON work_note_files(r2_key);
CREATE INDEX idx_work_note_files_deleted_at ON work_note_files(deleted_at);
CREATE INDEX idx_work_note_files_storage_type ON work_note_files(storage_type);
CREATE INDEX idx_work_note_files_gdrive_file_id ON work_note_files(gdrive_file_id);
CREATE INDEX idx_work_note_files_work_uploaded_live
  ON work_note_files(work_id, uploaded_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_work_note_files_work_storage_live
  ON work_note_files(work_id, storage_type)
  WHERE deleted_at IS NULL;

-- --------------------------------------------------------------------------
-- 4.14 google_oauth_tokens
-- --------------------------------------------------------------------------
CREATE TABLE google_oauth_tokens (
  user_email TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_google_oauth_tokens_updated_at
  BEFORE UPDATE ON google_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- 4.15 work_note_gdrive_folders
-- --------------------------------------------------------------------------
CREATE TABLE work_note_gdrive_folders (
  work_id TEXT PRIMARY KEY REFERENCES work_notes(work_id) ON DELETE CASCADE,
  gdrive_folder_id TEXT NOT NULL,
  gdrive_folder_link TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 4.16 meeting_minutes
-- --------------------------------------------------------------------------
CREATE TABLE meeting_minutes (
  meeting_id TEXT PRIMARY KEY,
  meeting_date DATE NOT NULL,
  topic TEXT NOT NULL,
  details_raw TEXT NOT NULL,
  keywords_json JSONB NOT NULL DEFAULT '[]',
  keywords_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- FTS: weighted tsvector generated column (replaces meeting_minutes_fts virtual table)
  fts_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(topic, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(details_raw, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(keywords_text, '')), 'C')
  ) STORED
);

CREATE INDEX idx_meeting_minutes_meeting_date ON meeting_minutes(meeting_date);
CREATE INDEX idx_meeting_minutes_sort
  ON meeting_minutes(meeting_date DESC, updated_at DESC, meeting_id DESC);
CREATE INDEX idx_meeting_minutes_fts ON meeting_minutes USING GIN (fts_vector);

CREATE TRIGGER trg_meeting_minutes_updated_at
  BEFORE UPDATE ON meeting_minutes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --------------------------------------------------------------------------
-- 4.17 meeting_minute_person
-- --------------------------------------------------------------------------
CREATE TABLE meeting_minute_person (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meeting_minutes(meeting_id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
  UNIQUE(meeting_id, person_id)
);

CREATE INDEX idx_meeting_minute_person_meeting_id ON meeting_minute_person(meeting_id);
CREATE INDEX idx_meeting_minute_person_person_id ON meeting_minute_person(person_id);

-- --------------------------------------------------------------------------
-- 4.18 meeting_minute_task_category
-- --------------------------------------------------------------------------
CREATE TABLE meeting_minute_task_category (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meeting_minutes(meeting_id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES task_categories(category_id) ON DELETE CASCADE,
  UNIQUE(meeting_id, category_id)
);

CREATE INDEX idx_meeting_minute_task_category_meeting_id ON meeting_minute_task_category(meeting_id);
CREATE INDEX idx_meeting_minute_task_category_category_id ON meeting_minute_task_category(category_id);

-- --------------------------------------------------------------------------
-- 4.19 work_note_meeting_minute
-- --------------------------------------------------------------------------
CREATE TABLE work_note_meeting_minute (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  meeting_id TEXT NOT NULL REFERENCES meeting_minutes(meeting_id) ON DELETE CASCADE,
  referenced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(work_id, meeting_id)
);

CREATE INDEX idx_work_note_meeting_minute_work_id ON work_note_meeting_minute(work_id);
CREATE INDEX idx_work_note_meeting_minute_meeting_id ON work_note_meeting_minute(meeting_id);

-- --------------------------------------------------------------------------
-- 4.20 work_note_groups
-- --------------------------------------------------------------------------
CREATE TABLE work_note_groups (
  group_id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_work_note_groups_name ON work_note_groups(name);
CREATE INDEX idx_work_note_groups_is_active ON work_note_groups(is_active);

-- --------------------------------------------------------------------------
-- 4.21 work_note_group_items
-- --------------------------------------------------------------------------
CREATE TABLE work_note_group_items (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES work_note_groups(group_id) ON DELETE CASCADE,
  UNIQUE(work_id, group_id)
);

CREATE INDEX idx_work_note_group_items_work_id ON work_note_group_items(work_id);
CREATE INDEX idx_work_note_group_items_group_id ON work_note_group_items(group_id);

-- --------------------------------------------------------------------------
-- 4.22 meeting_minute_group
-- --------------------------------------------------------------------------
CREATE TABLE meeting_minute_group (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meeting_minutes(meeting_id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES work_note_groups(group_id) ON DELETE CASCADE,
  UNIQUE(meeting_id, group_id)
);

CREATE INDEX idx_meeting_minute_group_meeting_id ON meeting_minute_group(meeting_id);
CREATE INDEX idx_meeting_minute_group_group_id ON meeting_minute_group(group_id);

-- --------------------------------------------------------------------------
-- 4.23 app_settings
-- --------------------------------------------------------------------------
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  default_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_settings_category ON app_settings(category);

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- 23 tables created (D1 had 25; 2 FTS5 virtual tables replaced by tsvector columns)
-- 8 ENUM types
-- 1 shared trigger function (set_updated_at) used by 8 tables
-- 1 version-limit trigger function (enforce_work_note_versions_limit)
-- 2 FTS generated columns with GIN indexes (work_notes, meeting_minutes)
-- 1 trigram GIN index on work_notes.title for partial matching
