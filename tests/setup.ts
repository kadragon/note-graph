/// <reference types="cloudflare/test" />

// Trace: SPEC-devx-1, TASK-028
import { beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../src/types/env';

const migrationModules = import.meta.glob('../migrations/*.sql', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

// Manual DDL fallback mirrors migrations 0001-0009 (kept in sync when migrations change)
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

  `CREATE TABLE IF NOT EXISTS work_notes (
     work_id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     content_raw TEXT NOT NULL,
     category TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_work_notes_category ON work_notes(category)`,
  `CREATE INDEX IF NOT EXISTS idx_work_notes_created_at ON work_notes(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_work_notes_updated_at ON work_notes(updated_at)`,

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

  `CREATE TABLE IF NOT EXISTS todos (
     todo_id TEXT PRIMARY KEY,
     work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     description TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now')),
     updated_at TEXT NOT NULL DEFAULT (datetime('now')),
     due_date TEXT,
     wait_until TEXT,
     status TEXT NOT NULL DEFAULT '진행중' CHECK (status IN ('진행중', '완료', '보류', '중단')),
     repeat_rule TEXT NOT NULL DEFAULT 'NONE' CHECK (repeat_rule IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY')),
     recurrence_type TEXT CHECK (recurrence_type IN ('DUE_DATE', 'COMPLETION_DATE'))
   )`,
  `CREATE INDEX IF NOT EXISTS idx_todos_work_id ON todos(work_id)`,
  `CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status)`,
  `CREATE INDEX IF NOT EXISTS idx_todos_updated_at ON todos(updated_at)`,

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

  `CREATE TABLE IF NOT EXISTS embedding_retry_queue (
     id TEXT PRIMARY KEY,
     work_id TEXT NOT NULL,
     operation_type TEXT NOT NULL,
     attempt_count INTEGER DEFAULT 0,
     max_attempts INTEGER DEFAULT 3,
     next_retry_at TEXT,
     status TEXT DEFAULT 'pending',
     error_message TEXT,
     error_details TEXT,
     created_at TEXT DEFAULT (datetime('now')),
     updated_at TEXT DEFAULT (datetime('now')),
     dead_letter_at TEXT,
     FOREIGN KEY (work_id) REFERENCES work_notes(work_id) ON DELETE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS idx_retry_queue_next_retry ON embedding_retry_queue(status, next_retry_at) WHERE status = 'pending'`,
  `CREATE INDEX IF NOT EXISTS idx_retry_queue_status ON embedding_retry_queue(status)`,
  `CREATE INDEX IF NOT EXISTS idx_retry_queue_work_id ON embedding_retry_queue(work_id)`,
  `CREATE INDEX IF NOT EXISTS idx_retry_queue_dead_letter ON embedding_retry_queue(dead_letter_at) WHERE status = 'dead_letter'`,

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
];

async function applyManualSchema(db: D1Database): Promise<void> {
  await db.batch(manualSchemaStatements.map((statement) => db.prepare(statement)));
}

async function applyMigrationsOrFallback(db: D1Database): Promise<void> {
  try {
    const entries = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b));
    for (const [, sql] of entries) {
      await db.exec(sql);
    }
  } catch (error) {
    console.warn('[Test Setup] Migration exec failed, falling back to manual DDL', error);
    await applyManualSchema(db);
  }
}

beforeAll(async () => {
  const db = (env as unknown as Env).DB;
  if (!db) {
    console.error('[Test Setup] DB binding is missing. Current bindings:', env);
    throw new Error('DB binding not available in test environment');
  }

  await applyMigrationsOrFallback(db);

  console.log('[Test Setup] Cloudflare Workers test environment initialized (migrations or fallback applied)');
});
