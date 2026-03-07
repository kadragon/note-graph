/**
 * PGlite-based test setup for PostgreSQL-native testing.
 * Creates an in-process PGlite instance and applies all Supabase migration files.
 *
 * This setup file is only used by the 'worker-db' project (tests that need DB).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createPgliteConnection } from '@worker/adapters/pglite-connection';
import { SupabaseDatabaseClient } from '@worker/adapters/supabase-database-client';
import { afterAll, beforeAll } from 'vitest';

let pglite: PGlite;
let testPgDb: SupabaseDatabaseClient;

/**
 * Load and adapt all migration SQL files for PGlite.
 * PGlite doesn't include pg_trgm, so we strip that extension and
 * any indexes using gin_trgm_ops.
 */
function loadMigrationSql(): string {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files
    .map((f) => {
      let sql = readFileSync(join(migrationsDir, f), 'utf-8');
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pg_trgm;/g, '');
      sql = sql.replace(/CREATE INDEX.*USING GIN\s*\([^)]*gin_trgm_ops\);/g, '');
      return sql;
    })
    .join('\n');
}

beforeAll(async () => {
  pglite = new PGlite();
  const migrationSql = loadMigrationSql();
  await pglite.exec(migrationSql);
  const conn = createPgliteConnection(pglite);
  testPgDb = new SupabaseDatabaseClient(conn);

  // Expose on globalThis for vi.mock factories (which can't use module imports)
  (globalThis as Record<string, unknown>).__testPgDb = testPgDb;
});

afterAll(async () => {
  await pglite.close();
});

export { testPgDb, pglite };
