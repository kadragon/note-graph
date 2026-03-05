/**
 * Factory functions for creating the correct database client and FTS dialect
 * based on environment bindings. Uses Hyperdrive binding presence as the selector.
 */

import type { DatabaseClient } from '../types/database';
import type { Env } from '../types/env';
import type { FtsDialect } from '../types/fts-dialect';
import { D1DatabaseClient } from './d1-database-client';
import { D1FtsDialect } from './d1-fts-dialect';
import { PostgresFtsDialect } from './postgres-fts-dialect';
import { createSupabaseConnection } from './supabase-connection';
import { SupabaseDatabaseClient } from './supabase-database-client';

export function createDatabaseClient(env: Env): DatabaseClient {
  if (env.HYPERDRIVE) {
    const conn = createSupabaseConnection(env.HYPERDRIVE.connectionString);
    return new SupabaseDatabaseClient(conn);
  }
  return new D1DatabaseClient(env.DB);
}

export function createFtsDialect(env: Env): FtsDialect {
  if (env.HYPERDRIVE) {
    return new PostgresFtsDialect();
  }
  return new D1FtsDialect();
}
