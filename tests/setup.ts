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

  console.log('[Test Setup] Cloudflare Workers test environment initialized with minimal D1 schema');
});
