/**
 * PGlite-based test setup for PostgreSQL-native testing.
 * Creates an in-process PGlite instance and applies the Supabase migration schema.
 *
 * This is the primary test setup file - used by all worker tests.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createPgliteConnection } from '@worker/adapters/pglite-connection';
import { PostgresFtsDialect } from '@worker/adapters/postgres-fts-dialect';
import { SupabaseDatabaseClient } from '@worker/adapters/supabase-database-client';
import { afterAll, beforeAll } from 'vitest';

let pglite: PGlite;
let testPgDb: SupabaseDatabaseClient;

/**
 * Load and adapt migration SQL for PGlite.
 * PGlite doesn't include pg_trgm, so we strip that extension and
 * any indexes using gin_trgm_ops.
 */
function loadMigrationSql(): string {
  const migrationPath = join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260305085855_initial_schema.sql'
  );
  let sql = readFileSync(migrationPath, 'utf-8');
  sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pg_trgm;/g, '');
  sql = sql.replace(/CREATE INDEX.*USING GIN\s*\([^)]*gin_trgm_ops\);/g, '');
  return sql;
}

beforeAll(async () => {
  pglite = new PGlite();
  const migrationSql = loadMigrationSql();
  await pglite.exec(migrationSql);
  const conn = createPgliteConnection(pglite);
  testPgDb = new SupabaseDatabaseClient(conn);

  // Expose on globalThis for vi.mock factories (which can't use module imports)
  (globalThis as Record<string, unknown>).__testPgDb = testPgDb;
  (globalThis as Record<string, unknown>).__testFtsDialect = new PostgresFtsDialect();
});

afterAll(async () => {
  await pglite.close();
});

export { testPgDb, pglite };
