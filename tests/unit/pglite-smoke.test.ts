/**
 * Smoke test: PGlite infrastructure works end-to-end.
 * Validates schema loading, CRUD, transactions, and cleanup utilities.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createPgliteConnection } from '@worker/adapters/pglite-connection';
import { SupabaseDatabaseClient } from '@worker/adapters/supabase-database-client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pgCleanup, pgInsert } from '../helpers/pg-test-utils';

describe('PGlite smoke test', () => {
  let pglite: PGlite;
  let db: SupabaseDatabaseClient;

  beforeAll(async () => {
    pglite = new PGlite();
    const migrationPath = join(
      process.cwd(),
      'supabase',
      'migrations',
      '20260305085855_initial_schema.sql'
    );
    let sql = readFileSync(migrationPath, 'utf-8');
    // PGlite doesn't include pg_trgm; strip extension and trgm-dependent indexes
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pg_trgm;/g, '');
    sql = sql.replace(/CREATE INDEX.*USING GIN\s*\([^)]*gin_trgm_ops\);/g, '');
    await pglite.exec(sql);
    const conn = createPgliteConnection(pglite);
    db = new SupabaseDatabaseClient(conn);
  });

  afterAll(async () => {
    await pglite.close();
  });

  beforeEach(async () => {
    await pgCleanup(pglite, ['app_settings', 'departments']);
  });

  it('applies schema and lists tables', async () => {
    const result = await pglite.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const tableNames = result.rows.map((r) => r.tablename);
    expect(tableNames).toContain('app_settings');
    expect(tableNames).toContain('work_notes');
    expect(tableNames).toContain('todos');
    expect(tableNames).toContain('departments');
    expect(tableNames).toContain('persons');
  });

  it('CRUD via SupabaseDatabaseClient', async () => {
    await db.execute(
      `INSERT INTO app_settings (key, value, category, label, default_value) VALUES ($1, $2, $3, $4, $5)`,
      ['test-key', 'test-value', 'general', 'Test', 'default']
    );

    const row = await db.queryOne<{ key: string; value: string }>(
      `SELECT key, value FROM app_settings WHERE key = $1`,
      ['test-key']
    );
    expect(row).toEqual({ key: 'test-key', value: 'test-value' });

    await db.execute(`UPDATE app_settings SET value = $1 WHERE key = $2`, ['updated', 'test-key']);

    const updated = await db.queryOne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = $1`,
      ['test-key']
    );
    expect(updated?.value).toBe('updated');

    const { rowCount } = await db.execute(`DELETE FROM app_settings WHERE key = $1`, ['test-key']);
    expect(rowCount).toBe(1);
  });

  it('transaction commits on success', async () => {
    await db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO app_settings (key, value, category, label, default_value) VALUES ($1, $2, $3, $4, $5)`,
        ['tx-key', 'tx-value', 'general', 'TX', 'default']
      );
    });

    const row = await db.queryOne<{ key: string }>(`SELECT key FROM app_settings WHERE key = $1`, [
      'tx-key',
    ]);
    expect(row).not.toBeNull();
  });

  it('transaction rolls back on error', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          `INSERT INTO app_settings (key, value, category, label, default_value) VALUES ($1, $2, $3, $4, $5)`,
          ['rollback-key', 'val', 'general', 'RB', 'default']
        );
        throw new Error('deliberate error');
      })
    ).rejects.toThrow('deliberate error');

    const row = await db.queryOne<{ key: string }>(`SELECT key FROM app_settings WHERE key = $1`, [
      'rollback-key',
    ]);
    expect(row).toBeNull();
  });

  it('boolean columns return native boolean', async () => {
    await db.execute(`INSERT INTO departments (dept_name, is_active) VALUES ($1, $2)`, [
      'test-dept',
      true,
    ]);

    const dept = await db.queryOne<{ dept_name: string; is_active: boolean }>(
      `SELECT dept_name, is_active FROM departments WHERE dept_name = $1`,
      ['test-dept']
    );
    expect(dept?.is_active).toBe(true);
    expect(typeof dept?.is_active).toBe('boolean');
  });

  it('pgCleanup truncates tables', async () => {
    await db.execute(
      `INSERT INTO app_settings (key, value, category, label, default_value) VALUES ($1, $2, $3, $4, $5)`,
      ['cleanup-key', 'val', 'general', 'CL', 'default']
    );

    await pgCleanup(pglite, ['app_settings']);

    const { rows } = await db.query<{ key: string }>(`SELECT key FROM app_settings`);
    expect(rows).toHaveLength(0);
  });

  it('pgInsert seeds a row', async () => {
    await pgInsert(pglite, 'departments', {
      dept_name: 'seed-dept',
      description: 'seeded',
      is_active: true,
    });

    const row = await db.queryOne<{ dept_name: string; description: string }>(
      `SELECT dept_name, description FROM departments WHERE dept_name = $1`,
      ['seed-dept']
    );
    expect(row).toEqual({ dept_name: 'seed-dept', description: 'seeded' });
  });

  it('ENUM types work correctly', async () => {
    await pgInsert(pglite, 'persons', {
      person_id: 'p-enum-test',
      name: 'Test Person',
      employment_status: '재직',
    });

    const person = await db.queryOne<{ employment_status: string }>(
      `SELECT employment_status FROM persons WHERE person_id = $1`,
      ['p-enum-test']
    );
    expect(person?.employment_status).toBe('재직');
    await pgCleanup(pglite, ['persons']);
  });

  it('FTS generated columns work', async () => {
    await pgInsert(pglite, 'work_notes', {
      work_id: 'wn-fts-test',
      title: 'FTS 테스트 제목',
      content_raw: '본문 내용입니다',
    });

    const result = await pglite.query<{ work_id: string }>(
      `SELECT work_id FROM work_notes WHERE fts_vector @@ to_tsquery('simple', $1)`,
      ['테스트']
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].work_id).toBe('wn-fts-test');
    await pgCleanup(pglite, ['work_notes']);
  });

  it('executeBatch runs multiple statements atomically', async () => {
    await db.executeBatch([
      {
        sql: `INSERT INTO departments (dept_name, is_active) VALUES ($1, $2)`,
        params: ['batch-dept-1', true],
      },
      {
        sql: `INSERT INTO departments (dept_name, is_active) VALUES ($1, $2)`,
        params: ['batch-dept-2', false],
      },
    ]);

    const { rows } = await db.query<{ dept_name: string }>(
      `SELECT dept_name FROM departments ORDER BY dept_name`
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.dept_name)).toEqual(['batch-dept-1', 'batch-dept-2']);
  });
});
