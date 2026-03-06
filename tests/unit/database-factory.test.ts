import { describe, expect, it } from 'vitest';
import { createDatabaseClient } from '../../apps/worker/src/adapters/database-factory';
import { SupabaseDatabaseClient } from '../../apps/worker/src/adapters/supabase-database-client';
import { buildMockEnv } from '../helpers/test-app';

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
  it('uses PostgreSQL bindings from buildMockEnv by default', () => {
    const env = buildMockEnv();

    expect(createDatabaseClient(env)).toBeInstanceOf(SupabaseDatabaseClient);
  });

  it('returns SupabaseDatabaseClient when HYPERDRIVE is present', () => {
    const env = { HYPERDRIVE: createMockHyperdrive() } as any;
    const client = createDatabaseClient(env);
    expect(client).toBeInstanceOf(SupabaseDatabaseClient);
  });

  it('throws when HYPERDRIVE is absent', () => {
    expect(() => createDatabaseClient({} as any)).toThrow('HYPERDRIVE binding is required');
  });

  it('creates a new SupabaseDatabaseClient per call', () => {
    const env = { HYPERDRIVE: createMockHyperdrive() } as any;
    const first = createDatabaseClient(env);
    const second = createDatabaseClient(env);
    expect(first).not.toBe(second);
  });
});
