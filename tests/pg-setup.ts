/**
 * PGlite-based test setup for PostgreSQL-native testing.
 * Creates an in-process PGlite instance and applies all Supabase migration files.
 *
 * This setup file is only used by the 'worker-db' project (tests that need DB).
 */

import { PGlite } from '@electric-sql/pglite';
import { createPgliteConnection } from '@worker/adapters/pglite-connection';
import { SupabaseDatabaseClient } from '@worker/adapters/supabase-database-client';
import { afterAll, beforeAll } from 'vitest';
import { loadAndApplyMigrations } from './helpers/pg-test-utils';

let pglite: PGlite;
let testPgDb: SupabaseDatabaseClient;

beforeAll(async () => {
  pglite = new PGlite();
  await loadAndApplyMigrations(pglite);
  const conn = createPgliteConnection(pglite);
  testPgDb = new SupabaseDatabaseClient(conn);

  // Expose on globalThis for vi.mock factories (which can't use module imports)
  (globalThis as Record<string, unknown>).__testPgDb = testPgDb;
});

afterAll(async () => {
  try {
    await pglite.close();
  } catch (err) {
    console.error('PGlite close failed (non-fatal):', (err as Error).message);
  }
});

export { testPgDb, pglite };
