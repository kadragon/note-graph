// Trace: spec_id=SPEC-testing-migration-001 task_id=TASK-MIGRATE-001

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { D1Database } from '@cloudflare/workers-types';
import { glob } from 'glob';
import { Miniflare } from 'miniflare';

// Global Miniflare instance
let miniflare: Miniflare;

// Load migration files from disk
async function loadMigrationStatements(): Promise<string[]> {
  const migrationFiles = await glob('../migrations/*.sql', {
    cwd: __dirname,
    absolute: true,
  });

  migrationFiles.sort(); // Ensure correct order

  const statements: string[] = [];

  for (const filePath of migrationFiles) {
    const sql = readFileSync(filePath, 'utf-8');

    // Remove comments first to avoid false positives
    const cleanedSql = sql.replace(/--.*$/gm, '');

    // Split by semicolon
    const rawStatements = cleanedSql.split(';');

    let currentStatement = '';

    for (const raw of rawStatements) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      if (currentStatement) {
        currentStatement += `;${raw}`;
      } else {
        currentStatement = raw;
      }

      // Check if the statement is complete
      // For triggers, we need to ensure we have a matching END
      const isTrigger = /CREATE\s+TRIGGER/i.test(currentStatement);
      if (isTrigger) {
        const beginCount = (currentStatement.match(/\bBEGIN\b/gi) || []).length;
        const endCount = (currentStatement.match(/\bEND\b/gi) || []).length;
        if (beginCount > endCount) {
          // Incomplete trigger, continue accumulating
          continue;
        }
      }

      statements.push(`${currentStatement.trim()};`);
      currentStatement = '';
    }
  }

  return statements;
}

// Manual DDL fallback (mirrors tests/setup.ts)
const manualSchemaStatements: string[] = [
  `CREATE TABLE IF NOT EXISTS persons (
     person_id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     phone_ext TEXT CHECK(phone_ext IS NULL OR (length(phone_ext) <= 15 AND NOT phone_ext GLOB '*[^0-9-]*')),
     current_dept TEXT,
     current_position TEXT,
     current_role_desc TEXT,
     employment_status TEXT DEFAULT '재직' CHECK (employment_status IN ('재직', '휴직', '퇴직')),
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name)`,
  `CREATE INDEX IF NOT EXISTS idx_persons_current_dept ON persons(current_dept)`,
  `CREATE INDEX IF NOT EXISTS idx_persons_phone_ext ON persons(phone_ext)`,
  `CREATE INDEX IF NOT EXISTS idx_persons_employment_status ON persons(employment_status)`,

  `CREATE TABLE IF NOT EXISTS departments (
     dept_name TEXT PRIMARY KEY,
     description TEXT,
     is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,

  `CREATE TABLE IF NOT EXISTS person_dept_history (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     person_id TEXT NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
     dept_name TEXT NOT NULL REFERENCES departments(dept_name) ON DELETE CASCADE,
     position TEXT,
     role_desc TEXT,
     start_date TEXT NOT NULL DEFAULT (datetime('now')),
     end_date TEXT,
     is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_person_dept_history_person_id ON person_dept_history(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_person_dept_history_dept_name ON person_dept_history(dept_name)`,
  `CREATE INDEX IF NOT EXISTS idx_person_dept_history_is_active ON person_dept_history(is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_person_dept_history_person_active ON person_dept_history(person_id, is_active)`,

  `CREATE TABLE IF NOT EXISTS projects (
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
   )`,
  `CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_projects_leader ON projects(leader_person_id) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_projects_dept ON projects(dept_name) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_projects_dates ON projects(start_date, target_end_date) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at)`,

  `CREATE TABLE IF NOT EXISTS work_notes (
     work_id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     content_raw TEXT NOT NULL,
     category TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now')),
     embedded_at TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_work_notes_category ON work_notes(category)`,
  `CREATE INDEX IF NOT EXISTS idx_work_notes_created_at ON work_notes(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_work_notes_updated_at ON work_notes(updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_work_notes_embedded_at ON work_notes(embedded_at)`,

  `ALTER TABLE work_notes ADD COLUMN project_id TEXT REFERENCES projects(project_id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_work_notes_project_id ON work_notes(project_id)`,

  `CREATE TABLE IF NOT EXISTS work_note_person (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
     person_id TEXT NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
     role TEXT NOT NULL CHECK (role IN ('OWNER', 'RELATED', 'PARTICIPANT')),
     dept_at_time TEXT,
     position_at_time TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_work_note_person_work_id ON work_note_person(work_id)`,
  `CREATE INDEX IF NOT EXISTS idx_work_note_person_person_id ON work_note_person(person_id)`,
  `CREATE INDEX IF NOT EXISTS idx_work_note_person_role ON work_note_person(role)`,
  `CREATE INDEX IF NOT EXISTS idx_work_note_person_dept_at_time ON work_note_person(dept_at_time)`,

  `CREATE TABLE IF NOT EXISTS work_note_relation (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
     related_work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
     UNIQUE(work_id, related_work_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_work_note_relation_work_id ON work_note_relation(work_id)`,
  `CREATE INDEX IF NOT EXISTS idx_work_note_relation_related_work_id ON work_note_relation(related_work_id)`,

  `CREATE TABLE IF NOT EXISTS work_note_versions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
     version_no INTEGER NOT NULL,
     title TEXT NOT NULL,
     content_raw TEXT NOT NULL,
     category TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     UNIQUE(work_id, version_no)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_work_note_versions_work_id ON work_note_versions(work_id)`,
  `CREATE INDEX IF NOT EXISTS idx_work_note_versions_version_no ON work_note_versions(work_id, version_no)`,

  `CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
     title,
     content_raw,
     category,
     tokenize='unicode61 remove_diacritics 0',
     content='work_notes',
     content_rowid='rowid'
   )`,
  `CREATE TRIGGER IF NOT EXISTS notes_fts_ai
   AFTER INSERT ON work_notes
   BEGIN
     INSERT INTO notes_fts(rowid, title, content_raw, category)
     VALUES (new.rowid, new.title, new.content_raw, new.category);
   END`,
  `CREATE TRIGGER IF NOT EXISTS notes_fts_au
   AFTER UPDATE ON work_notes
   BEGIN
     INSERT INTO notes_fts(notes_fts, rowid, title, content_raw, category)
     VALUES ('delete', old.rowid, old.title, old.content_raw, old.category);
     INSERT INTO notes_fts(rowid, title, content_raw, category)
     VALUES (new.rowid, new.title, new.content_raw, new.category);
   END`,
  `CREATE TRIGGER IF NOT EXISTS notes_fts_ad
   AFTER DELETE ON work_notes
   BEGIN
     INSERT INTO notes_fts(notes_fts, rowid, title, content_raw, category)
     VALUES ('delete', old.rowid, old.title, old.content_raw, old.category);
   END`,

  `CREATE TABLE IF NOT EXISTS todos (
     todo_id TEXT PRIMARY KEY,
     work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     description TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT,
     due_date TEXT,
     wait_until TEXT,
     status TEXT NOT NULL DEFAULT '진행중' CHECK (status IN ('진행중', '완료', '보류', '중단')),
     repeat_rule TEXT NOT NULL DEFAULT 'NONE' CHECK (repeat_rule IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')),
     recurrence_type TEXT CHECK (recurrence_type IN ('DUE_DATE', 'COMPLETION_DATE')),
     custom_interval INTEGER,
     custom_unit TEXT,
     skip_weekends INTEGER DEFAULT 0
   )`,
  `CREATE INDEX IF NOT EXISTS idx_todos_work_id ON todos(work_id)`,
  `CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status)`,
  `CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date)`,
  `CREATE INDEX IF NOT EXISTS idx_todos_wait_until ON todos(wait_until)`,
  `CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_todos_status_due_date ON todos(status, due_date)`,

  `CREATE TABLE IF NOT EXISTS pdf_jobs (
     job_id TEXT PRIMARY KEY,
     status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'READY', 'ERROR')),
     r2_key TEXT,
     extracted_text TEXT,
     draft_json TEXT,
     error_message TEXT,
     metadata_json TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,

  `CREATE TABLE IF NOT EXISTS project_participants (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
     person_id TEXT NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
     role TEXT NOT NULL DEFAULT '참여자',
     joined_at TEXT NOT NULL DEFAULT (datetime('now')),
     UNIQUE(project_id, person_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_project_participants_project ON project_participants(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_project_participants_person ON project_participants(person_id)`,

  `CREATE TABLE IF NOT EXISTS project_work_notes (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
     work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
     assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
     UNIQUE(work_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_project_work_notes_project ON project_work_notes(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_project_work_notes_work ON project_work_notes(work_id)`,

  `CREATE TABLE IF NOT EXISTS project_files (
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
   )`,
  `CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_project_files_r2_key ON project_files(r2_key)`,
  `CREATE INDEX IF NOT EXISTS idx_project_files_deleted_at ON project_files(deleted_at)`,

  `CREATE TABLE IF NOT EXISTS task_categories (
     category_id TEXT PRIMARY KEY,
     name TEXT NOT NULL UNIQUE,
     is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS work_note_task_category (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
     category_id TEXT NOT NULL REFERENCES task_categories(category_id) ON DELETE CASCADE,
     UNIQUE(work_id, category_id)
   )`,

  `CREATE INDEX IF NOT EXISTS idx_persons_sort
   ON persons(current_dept, name, current_position, person_id, phone_ext, created_at)`,

  `CREATE TABLE IF NOT EXISTS embedding_retry_queue (
     id TEXT PRIMARY KEY,
     work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
     operation_type TEXT NOT NULL CHECK (operation_type IN ('create', 'update', 'delete')),
     attempt_count INTEGER DEFAULT 0,
     max_attempts INTEGER DEFAULT 3,
     next_retry_at TEXT,
     status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'dead_letter')),
     error_message TEXT,
     error_details TEXT,
     created_at TEXT DEFAULT (datetime('now')),
     updated_at TEXT DEFAULT (datetime('now')),
     dead_letter_at TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_retry_queue_next_retry
   ON embedding_retry_queue(status, next_retry_at) WHERE status = 'pending'`,
  `CREATE INDEX IF NOT EXISTS idx_retry_queue_status
   ON embedding_retry_queue(status)`,
  `CREATE INDEX IF NOT EXISTS idx_retry_queue_work_id
   ON embedding_retry_queue(work_id)`,
  `CREATE INDEX IF NOT EXISTS idx_retry_queue_dead_letter
   ON embedding_retry_queue(dead_letter_at) WHERE status = 'dead_letter'`,

  `CREATE TABLE IF NOT EXISTS work_note_files (
     file_id TEXT PRIMARY KEY,
     work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
     r2_key TEXT NOT NULL,
     original_name TEXT NOT NULL,
     file_type TEXT NOT NULL,
     file_size INTEGER NOT NULL,
     uploaded_by TEXT NOT NULL,
     uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
     deleted_at TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS idx_work_note_files_work ON work_note_files(work_id) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_work_note_files_r2_key ON work_note_files(r2_key)`,
  `CREATE INDEX IF NOT EXISTS idx_work_note_files_deleted_at ON work_note_files(deleted_at)`,
];

async function applyManualSchema(db: D1Database): Promise<void> {
  await db.batch(manualSchemaStatements.map((statement) => db.prepare(statement)));
}

async function applyMigrationsOrFallback(db: D1Database): Promise<void> {
  try {
    const stmts = await loadMigrationStatements();

    if (stmts.length === 0) {
      console.warn('[Jest Setup] No migration statements found, falling back to manual DDL');
      await applyManualSchema(db);
      return;
    }

    await db.batch(stmts.map((s) => db.prepare(s)));
  } catch (error) {
    console.warn('[Jest Setup] Migration exec failed, falling back to manual DDL', error);
    await applyManualSchema(db);
  }
}

// Clear persisted D1 state to ensure clean test runs
function clearPersistedD1State(): void {
  const d1Dir = join(process.cwd(), '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
  if (existsSync(d1Dir)) {
    rmSync(d1Dir, { recursive: true, force: true });
  }
}

// Initialize Miniflare before all tests
beforeAll(async () => {
  clearPersistedD1State();

  miniflare = new Miniflare({
    modules: true,
    script: '',
    compatibilityDate: '2024-01-01',
    compatibilityFlags: [
      'nodejs_compat',
      'enable_nodejs_tty_module',
      'enable_nodejs_fs_module',
      'enable_nodejs_http_modules',
      'enable_nodejs_perf_hooks_module',
    ],
    d1Databases: { DB: 'worknote-db' },
    d1Persist: false,
    bindings: {
      ENVIRONMENT: 'production',
    },
  });

  // Get D1 database and apply migrations
  const db = await miniflare.getD1Database('DB');
  await applyMigrationsOrFallback(db);

  // Make bindings globally available for tests
  (global as any).getMiniflare = () => miniflare;
  (global as any).getDB = async () => await miniflare.getD1Database('DB');
});

// Clean up Miniflare after all tests
afterAll(async () => {
  if (miniflare) {
    await miniflare.dispose();
  }
}, 30000); // Increase timeout to 30 seconds for cleanup
