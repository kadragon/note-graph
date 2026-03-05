import { afterEach, describe, expect, it } from 'vitest';
import { D1DatabaseClient } from '../../apps/worker/src/adapters/d1-database-client';
import { D1FtsDialect } from '../../apps/worker/src/adapters/d1-fts-dialect';
import {
  createDatabaseClient,
  createFtsDialect,
  resetCachedSupabaseClient,
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
  afterEach(() => {
    resetCachedSupabaseClient();
  });

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

  it('caches SupabaseDatabaseClient for the same connectionString', () => {
    const env = { DB: createMockD1(), HYPERDRIVE: createMockHyperdrive() } as any;
    const first = createDatabaseClient(env);
    const second = createDatabaseClient(env);
    expect(first).toBe(second);
  });

  it('creates new SupabaseDatabaseClient when connectionString changes', () => {
    const env1 = { DB: createMockD1(), HYPERDRIVE: createMockHyperdrive() } as any;
    const first = createDatabaseClient(env1);
    const env2 = {
      DB: createMockD1(),
      HYPERDRIVE: {
        ...createMockHyperdrive(),
        connectionString: 'postgresql://other:pass@host:5432/db',
      },
    } as any;
    const second = createDatabaseClient(env2);
    expect(first).not.toBe(second);
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
