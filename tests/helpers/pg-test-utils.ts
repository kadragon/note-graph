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
