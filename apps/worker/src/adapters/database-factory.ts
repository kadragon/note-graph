/**
 * Factory functions for the PostgreSQL-only runtime path.
 *
 * A new postgres.js client is created per request. Hyperdrive manages TCP
 * connection pooling at the infrastructure level, so there is no performance
 * penalty. Caching the client at module level causes "Cannot perform I/O on
 * behalf of a different request" errors because postgres.js internal streams
 * are bound to the request context that created them.
 */

import type { DatabaseClient } from '../types/database';
import type { Env } from '../types/env';
import type { FtsDialect } from '../types/fts-dialect';
import { PostgresFtsDialect } from './postgres-fts-dialect';
import { createSupabaseConnection } from './supabase-connection';
import { SupabaseDatabaseClient } from './supabase-database-client';

function requireHyperdrive(env: Env): Hyperdrive {
  if (!env.HYPERDRIVE) {
    throw new Error('HYPERDRIVE binding is required');
  }

  return env.HYPERDRIVE;
}

export function createDatabaseClient(env: Env): DatabaseClient {
  const hyperdrive = requireHyperdrive(env);
  const conn = createSupabaseConnection(hyperdrive.connectionString);
  return new SupabaseDatabaseClient(conn);
}

export function createFtsDialect(env: Env): FtsDialect {
  requireHyperdrive(env);
  return new PostgresFtsDialect();
}
