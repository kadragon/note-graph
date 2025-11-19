// Trace: TASK-016, TASK-018
// Test setup and global configuration

import { beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import type { Env } from '../src/types/env';

beforeAll(async () => {
  const db = (env as unknown as Env).DB;
  if (!db) {
    console.error('[Test Setup] DB binding is missing. Current bindings:', env);
    throw new Error('DB binding not available in test environment');
  }

  // Minimal schema needed for person tests
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS persons (
      person_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      current_dept TEXT,
      current_position TEXT,
      current_role_desc TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS departments (
      dept_name TEXT PRIMARY KEY,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS person_dept_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id TEXT NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
      dept_name TEXT NOT NULL REFERENCES departments(dept_name) ON DELETE CASCADE,
      position TEXT,
      role_desc TEXT,
      start_date TEXT NOT NULL DEFAULT (datetime('now')),
      end_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS work_notes (
      work_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content_raw TEXT NOT NULL,
      category TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS work_note_person (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
      person_id TEXT NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('OWNER', 'PARTICIPANT'))
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS work_note_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
      version_no INTEGER NOT NULL,
      title TEXT NOT NULL,
      content_raw TEXT NOT NULL,
      category TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(work_id, version_no)
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS work_note_relation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
      related_work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS todos (
      todo_id TEXT PRIMARY KEY,
      work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      due_date TEXT,
      wait_until TEXT,
      status TEXT NOT NULL DEFAULT '진행중' CHECK (status IN ('진행중', '완료', '보류')),
      repeat_rule TEXT NOT NULL DEFAULT 'NONE' CHECK (repeat_rule IN ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY')),
      recurrence_type TEXT CHECK (recurrence_type IN ('DUE_DATE', 'COMPLETION_DATE'))
    )`
  ).run();

  await db.prepare(
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
    )`
  ).run();

  await db.prepare(
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
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS task_categories (
      category_id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS work_note_task_category (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES task_categories(category_id) ON DELETE CASCADE,
      UNIQUE(work_id, category_id)
    )`
  ).run();

  console.log('[Test Setup] Cloudflare Workers test environment initialized with full D1 schema');
});
