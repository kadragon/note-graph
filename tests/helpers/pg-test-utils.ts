/**
 * Utility helpers for PGlite-based tests.
 */

import type { PGlite } from '@electric-sql/pglite';

/**
 * Delete all rows from the given tables (in order) using TRUNCATE CASCADE.
 * Use in beforeEach/afterEach to isolate tests.
 */
export async function pgCleanup(pglite: PGlite, tables: string[]): Promise<void> {
  if (tables.length === 0) return;
  await pglite.exec(`TRUNCATE ${tables.join(', ')} CASCADE`);
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

/**
 * Execute a parameterized query directly against PGlite.
 * Convenience wrapper matching the D1 `prepare().bind().run()` pattern.
 */
export async function pgExec(pglite: PGlite, sql: string, params?: unknown[]): Promise<void> {
  await pglite.query(sql, params);
}

/**
 * Execute a parameterized query and return one column value from first row.
 */
export async function pgQueryOne<T = unknown>(
  pglite: PGlite,
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await pglite.query(sql, params);
  if (result.rows.length === 0) return null;
  return result.rows[0] as T;
}
