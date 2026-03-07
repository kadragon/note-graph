/**
 * Integration smoke test for SupabaseDatabaseClient.
 *
 * Requires local Supabase running: `supabase start`
 * Run with: bun vitest --run --config vitest.config.supabase.ts tests/integration/supabase-smoke.test.ts
 *
 * Skipped automatically if connection fails.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildMeetingMinuteFtsCte,
  buildWorkNoteFtsCte,
} from '../../apps/worker/src/adapters/postgres-fts-dialect';
import { createSupabaseConnection } from '../../apps/worker/src/adapters/supabase-connection';
import { SupabaseDatabaseClient } from '../../apps/worker/src/adapters/supabase-database-client';
import { SettingRepository } from '../../apps/worker/src/repositories/setting-repository';

const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const REQUIRE_SUPABASE =
  process.env.SUPABASE_REQUIRED === '1' || process.env.SUPABASE_REQUIRED === 'true';

let available = false;

try {
  const probe = createSupabaseConnection(DB_URL);
  const res = await probe.query<{ ok: number }>('SELECT 1 as ok');
  available = res.rows.length > 0;
  await probe.close();
} catch (err) {
  if (REQUIRE_SUPABASE) {
    throw new Error(
      `Supabase smoke tests require a running database at ${DB_URL}: ${(err as Error).message}`
    );
  }
  console.error('Supabase not available, skipping integration tests:', (err as Error).message);
}

describe.skipIf(!available)('SupabaseDatabaseClient integration', () => {
  let conn: ReturnType<typeof createSupabaseConnection>;
  let db: SupabaseDatabaseClient;

  beforeAll(async () => {
    conn = createSupabaseConnection(DB_URL);
    db = new SupabaseDatabaseClient(conn);
    await db.execute('DELETE FROM app_settings WHERE key LIKE $1', ['test.smoke.%']);
  });

  afterAll(async () => {
    if (db) {
      await db.execute('DELETE FROM app_settings WHERE key LIKE $1', ['test.smoke.%']);
    }
    if (conn) {
      await conn.close();
    }
  });

  it('uses the current PostgreSQL migration schema', async () => {
    const { rows } = await db.query<{ tableName: string; columnName: string }>(
      `SELECT table_name AS "tableName", column_name AS "columnName"
       FROM information_schema.columns
       WHERE (table_name = 'app_settings' AND column_name = 'key')
          OR (table_name = 'work_notes' AND column_name = 'fts_vector')
          OR (table_name = 'meeting_minutes' AND column_name = 'fts_vector')
       ORDER BY table_name, column_name`
    );

    expect(rows).toEqual([
      { tableName: 'app_settings', columnName: 'key' },
      { tableName: 'meeting_minutes', columnName: 'fts_vector' },
      { tableName: 'work_notes', columnName: 'fts_vector' },
    ]);
  });

  it('executes basic CRUD via SettingRepository', async () => {
    const repo = new SettingRepository(db);

    // ensureDefaults inserts rows
    await repo.ensureDefaults([
      {
        key: 'test.smoke.key1',
        value: 'original',
        category: 'config',
        label: 'Smoke Test Key',
        description: 'Integration test setting',
      },
    ]);

    // findByKey retrieves the row
    const found = await repo.findByKey('test.smoke.key1');
    expect(found).not.toBeNull();
    expect(found?.value).toBe('original');
    expect(found?.category).toBe('config');

    // upsert updates the value
    const updated = await repo.upsert('test.smoke.key1', 'modified');
    expect(updated.value).toBe('modified');

    // resetToDefault restores original
    const reset = await repo.resetToDefault('test.smoke.key1');
    expect(reset.value).toBe('original');
  });

  it('transaction commits on success', async () => {
    await db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO app_settings (key, value, category, label, default_value)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        ['test.smoke.tx1', 'txval', 'config', 'TX Test', 'txval']
      );
    });

    const row = await db.queryOne<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = $1',
      ['test.smoke.tx1']
    );
    expect(row?.value).toBe('txval');
  });

  it('transaction rolls back on error', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          `INSERT INTO app_settings (key, value, category, label, default_value)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
          ['test.smoke.tx2', 'should_not_persist', 'config', 'Rollback Test', 'val']
        );
        throw new Error('intentional rollback');
      })
    ).rejects.toThrow('intentional rollback');

    const row = await db.queryOne<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = $1',
      ['test.smoke.tx2']
    );
    expect(row).toBeNull();
  });

  it('FTS query works with buildWorkNoteFtsCte on work_notes', async () => {
    const testWorkId = `test-smoke-fts-${Date.now()}`;

    await db.execute(
      `INSERT INTO work_notes (work_id, title, content_raw, category)
       VALUES ($1, $2, $3, $4)`,
      [
        testWorkId,
        'Smoke FTS Test Title',
        'Integration test content for full text search',
        'general',
      ]
    );

    try {
      const cte = buildWorkNoteFtsCte();

      const { rows } = await db.query<{ id: string; rank: number }>(
        `${cte.sql} SELECT id, ${cte.rankColumn} FROM fts_matches`,
        ['smoke & test']
      );
      const match = rows.find((row) => row.id === testWorkId);

      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(match).toBeDefined();
      // Negated ts_rank: lower (more negative) = better match
      if (!match) {
        throw new Error(`Expected work note ${testWorkId} in FTS results`);
      }
      expect(match.rank).toBeLessThan(0);
    } finally {
      await db.execute('DELETE FROM work_notes WHERE work_id = $1', [testWorkId]);
    }
  });

  it('FTS query works with buildMeetingMinuteFtsCte on meeting_minutes', async () => {
    const testMeetingId = `test-smoke-fts-mm-${Date.now()}`;

    await db.execute(
      `INSERT INTO meeting_minutes (meeting_id, meeting_date, topic, details_raw)
       VALUES ($1, $2, $3, $4)`,
      [
        testMeetingId,
        '2026-01-01',
        'Smoke FTS Meeting Topic',
        'Discussion about integration testing',
      ]
    );

    try {
      const cte = buildMeetingMinuteFtsCte();

      const { rows } = await db.query<{ id: string; rank: number }>(
        `${cte.sql} SELECT id, ${cte.rankColumn} FROM fts_matches`,
        ['smoke & meeting']
      );
      const match = rows.find((row) => row.id === testMeetingId);

      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(match).toBeDefined();
      if (!match) {
        throw new Error(`Expected meeting minute ${testMeetingId} in FTS results`);
      }
      expect(match.rank).toBeLessThan(0);
    } finally {
      await db.execute('DELETE FROM meeting_minutes WHERE meeting_id = $1', [testMeetingId]);
    }
  });
});
