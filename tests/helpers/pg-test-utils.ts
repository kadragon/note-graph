/**
 * Utility helpers for PGlite-based tests.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

/**
 * Load and apply all migration SQL files to PGlite.
 * PGlite doesn't include pg_trgm, so we strip that extension and
 * any indexes using gin_trgm_ops.
 *
 * Applies migrations one file at a time so errors identify the failing file.
 */
export async function loadAndApplyMigrations(pglite: PGlite): Promise<void> {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error(
      `No .sql migration files found in ${migrationsDir}. Check your working directory.`
    );
  }

  for (const f of files) {
    let sql = readFileSync(join(migrationsDir, f), 'utf-8');
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pg_trgm;/g, '');
    sql = sql.replace(/CREATE INDEX.*USING GIN\s*\([^)]*gin_trgm_ops\);/g, '');
    sql = sql.replace(/ALTER EXTENSION pg_trgm SET SCHEMA \w+;/g, '');
    try {
      await pglite.exec(sql);
    } catch (err) {
      throw new Error(`Migration ${f} failed: ${(err as Error).message}`);
    }
  }
}

/**
 * Delete all rows from the given tables (in order) using TRUNCATE CASCADE.
 * Use in beforeEach/afterEach to isolate tests.
 */
export async function pgCleanup(pglite: PGlite, tables: string[]): Promise<void> {
  if (tables.length === 0) return;
  await pglite.exec(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}

/**
 * Truncate ALL application tables dynamically.
 * Queries pg_tables for the public schema so no hardcoded list is needed.
 */
export async function pgCleanupAll(pglite: PGlite): Promise<void> {
  const result = await pglite.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  const tables = result.rows.map((row) => `"${row.tablename}"`).join(', ');
  if (tables) {
    await pglite.exec(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  }
}

/**
 * Seed a single row into a table.
 * Columns and values are derived from the data object keys.
 */
export async function pgInsert(
  pglite: PGlite,
  table: string,
  data: Record<string, unknown>
): Promise<void> {
  const keys = Object.keys(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.join(', ');
  await pglite.query(
    `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
    Object.values(data)
  );
}
