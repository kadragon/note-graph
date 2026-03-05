/**
 * Factory functions for creating the correct database client and FTS dialect
 * based on environment bindings. Uses Hyperdrive binding presence as the selector.
 *
 * The Supabase client is cached per isolate to avoid creating a new postgres.js
 * connection pool on every request. Hyperdrive manages TCP connection pooling
 * underneath, so a single postgres.js instance per isolate is sufficient.
 */

import type { DatabaseClient } from '../types/database';
import type { Env } from '../types/env';
import type { FtsDialect } from '../types/fts-dialect';
import { D1DatabaseClient } from './d1-database-client';
import { D1FtsDialect } from './d1-fts-dialect';
import { PostgresFtsDialect } from './postgres-fts-dialect';
import { createSupabaseConnection } from './supabase-connection';
import { SupabaseDatabaseClient } from './supabase-database-client';

let cachedSupabase: { connStr: string; client: SupabaseDatabaseClient } | null = null;

export function createDatabaseClient(env: Env): DatabaseClient {
  if (env.HYPERDRIVE) {
    const connStr = env.HYPERDRIVE.connectionString;
    if (cachedSupabase && cachedSupabase.connStr === connStr) {
      return cachedSupabase.client;
    }
    const conn = createSupabaseConnection(connStr);
    const client = new SupabaseDatabaseClient(conn);
    cachedSupabase = { connStr, client };
    return client;
  }
  return new D1DatabaseClient(env.DB);
}

export function createFtsDialect(env: Env): FtsDialect {
  if (env.HYPERDRIVE) {
    return new PostgresFtsDialect();
  }
  return new D1FtsDialect();
}

/** Reset cached client (for testing only). */
export function resetCachedSupabaseClient(): void {
  cachedSupabase = null;
}
