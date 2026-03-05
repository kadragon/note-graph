import { describe, expect, it } from 'vitest';
import { D1DatabaseClient } from '../../apps/worker/src/adapters/d1-database-client';
import { D1FtsDialect } from '../../apps/worker/src/adapters/d1-fts-dialect';
import {
  createDatabaseClient,
  createFtsDialect,
} from '../../apps/worker/src/adapters/database-factory';
import { PostgresFtsDialect } from '../../apps/worker/src/adapters/postgres-fts-dialect';
import { SupabaseDatabaseClient } from '../../apps/worker/src/adapters/supabase-database-client';

function createMockD1(): D1Database {
  return {
    prepare: () => ({}),
    batch: () => Promise.resolve([]),
    dump: () => Promise.resolve(new ArrayBuffer(0)),
    exec: () => Promise.resolve({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

function createMockHyperdrive(): Hyperdrive {
  return {
    connectionString: 'postgresql://user:pass@host:5432/db',
    host: 'host',
    port: 5432,
    user: 'user',
    password: 'pass',
    database: 'db',
  } as unknown as Hyperdrive;
}

describe('createDatabaseClient', () => {
  it('returns D1DatabaseClient when HYPERDRIVE is absent', () => {
    const env = { DB: createMockD1() } as any;
    const client = createDatabaseClient(env);
    expect(client).toBeInstanceOf(D1DatabaseClient);
  });

  it('returns SupabaseDatabaseClient when HYPERDRIVE is present', () => {
    const env = { DB: createMockD1(), HYPERDRIVE: createMockHyperdrive() } as any;
    const client = createDatabaseClient(env);
    expect(client).toBeInstanceOf(SupabaseDatabaseClient);
  });
});

describe('createFtsDialect', () => {
  it('returns D1FtsDialect when HYPERDRIVE is absent', () => {
    const env = { DB: createMockD1() } as any;
    const dialect = createFtsDialect(env);
    expect(dialect).toBeInstanceOf(D1FtsDialect);
  });

  it('returns PostgresFtsDialect when HYPERDRIVE is present', () => {
    const env = { DB: createMockD1(), HYPERDRIVE: createMockHyperdrive() } as any;
    const dialect = createFtsDialect(env);
    expect(dialect).toBeInstanceOf(PostgresFtsDialect);
  });
});
