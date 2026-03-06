import type { SupabaseConnection } from '@worker/adapters/supabase-database-client';
import {
  buildAliasMap,
  SupabaseDatabaseClient,
  translatePlaceholders,
  translateSqliteFunctions,
} from '@worker/adapters/supabase-database-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SupabaseDatabaseClient', () => {
  describe('translatePlaceholders', () => {
    it('returns sql unchanged when no params', () => {
      expect(translatePlaceholders('SELECT 1')).toBe('SELECT 1');
    });

    it('translates single ? to $1', () => {
      expect(translatePlaceholders('SELECT * FROM t WHERE id = ?')).toBe(
        'SELECT * FROM t WHERE id = $1'
      );
    });

    it('translates multiple ? to $1, $2, $N', () => {
      const sql = 'INSERT INTO t (a, b, c) VALUES (?, ?, ?)';
      expect(translatePlaceholders(sql)).toBe('INSERT INTO t (a, b, c) VALUES ($1, $2, $3)');
    });

    it('does not translate ? inside single-quoted strings', () => {
      const sql = "SELECT * FROM t WHERE name = '?' AND id = ?";
      expect(translatePlaceholders(sql)).toBe("SELECT * FROM t WHERE name = '?' AND id = $1");
    });

    it('handles SQL-standard escaped single quotes (double-quote escape)', () => {
      const sql = "WHERE name = 'it''s' AND id = ?";
      expect(translatePlaceholders(sql)).toBe("WHERE name = 'it''s' AND id = $1");
    });

    it('handles consecutive escaped quotes with trailing placeholder', () => {
      const sql = "WHERE a = 'x''y''z' AND b = ?";
      expect(translatePlaceholders(sql)).toBe("WHERE a = 'x''y''z' AND b = $1");
    });

    it('does not translate ? inside double-quoted identifiers', () => {
      const sql = 'SELECT "column?" FROM t WHERE id = ?';
      expect(translatePlaceholders(sql)).toBe('SELECT "column?" FROM t WHERE id = $1');
    });

    it('does not translate ? inside line comments', () => {
      const sql = 'SELECT 1 -- is this a param?\nWHERE id = ?';
      expect(translatePlaceholders(sql)).toBe('SELECT 1 -- is this a param?\nWHERE id = $1');
    });

    it('handles double-quoted identifier followed by placeholder', () => {
      const sql = 'SELECT "col" FROM t WHERE a = ? AND "b?" = ?';
      expect(translatePlaceholders(sql)).toBe('SELECT "col" FROM t WHERE a = $1 AND "b?" = $2');
    });
  });

  describe('translateSqliteFunctions', () => {
    it('translates json_each to jsonb_array_elements_text', () => {
      const sql = 't.work_id IN (SELECT value FROM json_each(?))';
      expect(translateSqliteFunctions(sql)).toBe(
        't.work_id IN (SELECT jsonb_array_elements_text(?::jsonb))'
      );
    });

    it('handles case-insensitive json_each', () => {
      const sql = 'SELECT value FROM JSON_EACH(?)';
      expect(translateSqliteFunctions(sql)).toBe('SELECT jsonb_array_elements_text(?::jsonb)');
    });

    it('preserves sql without json_each', () => {
      const sql = 'SELECT * FROM todos WHERE id = ?';
      expect(translateSqliteFunctions(sql)).toBe(sql);
    });

    it('logs error for untranslated json_each patterns', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const sql = 'SELECT 1 FROM json_each(some_column)';
      translateSqliteFunctions(sql);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('untranslated json_each()'));
      consoleSpy.mockRestore();
    });

    it('works with TodoRepository findAll workIds pattern', () => {
      const sql = `
      SELECT t.todo_id as todoId, t.work_id as workId
      FROM todos t
      WHERE t.work_id IN (SELECT value FROM json_each(?))
      ORDER BY t.due_date ASC`;
      const result = translateSqliteFunctions(sql);
      expect(result).toContain('jsonb_array_elements_text(?::jsonb)');
      expect(result).not.toContain('json_each');
    });
  });

  describe('buildAliasMap', () => {
    it('builds map for camelCase aliases', () => {
      const map = buildAliasMap('SELECT t.work_id as workId FROM todos t');
      expect(map).not.toBeNull();
      expect(map?.get('workid')).toBe('workId');
    });

    it('builds map for multiple camelCase aliases', () => {
      const sql =
        'SELECT t.todo_id as todoId, t.work_id as workId, w.title as workTitle FROM todos t';
      const map = buildAliasMap(sql);
      expect(map?.get('todoid')).toBe('todoId');
      expect(map?.get('workid')).toBe('workId');
      expect(map?.get('worktitle')).toBe('workTitle');
    });

    it('returns null for lowercase-only aliases', () => {
      expect(buildAliasMap('SELECT t.title as title FROM todos t')).toBeNull();
    });

    it('skips already-quoted aliases', () => {
      const map = buildAliasMap('SELECT t.work_id as "workId" FROM todos t');
      expect(map).toBeNull();
    });

    it('handles AS keyword in any case', () => {
      const map = buildAliasMap('SELECT t.work_id AS workId FROM todos t');
      expect(map?.get('workid')).toBe('workId');
    });

    it('handles aliases with numbers like bm25Score', () => {
      const map = buildAliasMap('SELECT score as bm25Score FROM fts');
      expect(map?.get('bm25score')).toBe('bm25Score');
    });

    it('does not match AS alias inside single-quoted string literals', () => {
      const map = buildAliasMap("SELECT 'save as workId' as label FROM t");
      expect(map).toBeNull();
    });

    it('does not match AS alias inside double-quoted identifiers', () => {
      const map = buildAliasMap('SELECT "as workId" FROM t');
      expect(map).toBeNull();
    });
  });

  describe('close', () => {
    it('calls close on the underlying connection', async () => {
      const mockClose = vi.fn().mockResolvedValue(undefined);
      const mockConn: SupabaseConnection = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
        close: mockClose,
      };
      const client = new SupabaseDatabaseClient(mockConn);

      await client.close();

      expect(mockClose).toHaveBeenCalledOnce();
    });

    it('does not throw when connection has no close method', async () => {
      const mockConn: SupabaseConnection = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      const client = new SupabaseDatabaseClient(mockConn);

      await expect(client.close()).resolves.toBeUndefined();
    });
  });

  describe('query', () => {
    it('translates placeholders and returns rows from connection', async () => {
      const mockConn: SupabaseConnection = {
        query: vi.fn().mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] }),
        execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      const client = new SupabaseDatabaseClient(mockConn);

      const result = await client.query('SELECT * FROM t WHERE a = ? AND b = ?', ['x', 'y']);

      expect(result.rows).toEqual([{ id: 1 }, { id: 2 }]);
      expect(mockConn.query).toHaveBeenCalledWith('SELECT * FROM t WHERE a = $1 AND b = $2', [
        'x',
        'y',
      ]);
    });

    it('translates json_each to jsonb_array_elements_text in query', async () => {
      const mockConn: SupabaseConnection = {
        query: vi.fn().mockResolvedValue({ rows: [{ todoid: 'T-1', workid: 'W-1' }] }),
        execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      const client = new SupabaseDatabaseClient(mockConn);

      await client.query(
        'SELECT t.todo_id as todoId, t.work_id as workId FROM todos t WHERE t.work_id IN (SELECT value FROM json_each(?))',
        [JSON.stringify(['W-1', 'W-2'])]
      );

      expect(mockConn.query).toHaveBeenCalledWith(
        'SELECT t.todo_id as todoId, t.work_id as workId FROM todos t WHERE t.work_id IN (SELECT jsonb_array_elements_text($1::jsonb))',
        [JSON.stringify(['W-1', 'W-2'])]
      );
    });

    it('remaps lowercased PostgreSQL keys back to camelCase aliases', async () => {
      const mockConn: SupabaseConnection = {
        query: vi.fn().mockResolvedValue({ rows: [{ workid: 'W-001', createdat: '2026-01-01' }] }),
        execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      const client = new SupabaseDatabaseClient(mockConn);

      const result = await client.query<{ workId: string; createdAt: string }>(
        'SELECT work_id as workId, created_at as createdAt FROM work_notes WHERE id = ?',
        [1]
      );

      expect(result.rows).toEqual([{ workId: 'W-001', createdAt: '2026-01-01' }]);
    });
  });

  describe('queryOne', () => {
    it('returns first row when rows exist', async () => {
      const mockConn: SupabaseConnection = {
        query: vi.fn().mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] }),
        execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      const client = new SupabaseDatabaseClient(mockConn);

      const result = await client.queryOne('SELECT * FROM t WHERE id = ?', [1]);

      expect(result).toEqual({ id: 1 });
      expect(mockConn.query).toHaveBeenCalledWith('SELECT * FROM t WHERE id = $1', [1]);
    });

    it('remaps lowercased keys for queryOne result', async () => {
      const mockConn: SupabaseConnection = {
        query: vi.fn().mockResolvedValue({ rows: [{ workid: 'W-001', dudate: '2026-03-01' }] }),
        execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      const client = new SupabaseDatabaseClient(mockConn);

      const result = await client.queryOne<{ workId: string }>(
        'SELECT work_id as workId FROM t WHERE id = ?',
        [1]
      );

      expect(result).toEqual({ workId: 'W-001', dudate: '2026-03-01' });
    });

    it('returns null when no rows', async () => {
      const mockConn: SupabaseConnection = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      const client = new SupabaseDatabaseClient(mockConn);

      const result = await client.queryOne('SELECT * FROM t WHERE id = ?', [999]);

      expect(result).toBeNull();
    });
  });

  describe('transaction', () => {
    let mockConn: SupabaseConnection;
    let client: SupabaseDatabaseClient;
    let executeCalls: Array<{ sql: string; params?: unknown[] }>;

    beforeEach(() => {
      executeCalls = [];
      mockConn = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        execute: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
          executeCalls.push({ sql, params });
          return Promise.resolve({ rowCount: 0 });
        }),
      };
      client = new SupabaseDatabaseClient(mockConn);
    });

    it('commits on success', async () => {
      const result = await client.transaction(async (tx) => {
        await tx.execute('INSERT INTO t (a) VALUES (?)', ['x']);
        return 'ok';
      });

      expect(result).toBe('ok');
      expect(executeCalls[0].sql).toBe('BEGIN');
      expect(executeCalls[executeCalls.length - 1].sql).toBe('COMMIT');
    });

    it('rolls back on error', async () => {
      await expect(
        client.transaction(async () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');

      expect(executeCalls[0].sql).toBe('BEGIN');
      expect(executeCalls[executeCalls.length - 1].sql).toBe('ROLLBACK');
    });

    it('preserves original error when ROLLBACK also fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockConn.execute = vi.fn().mockImplementation((sql: string) => {
        executeCalls.push({ sql });
        if (sql === 'ROLLBACK') return Promise.reject(new Error('connection lost'));
        return Promise.resolve({ rowCount: 0 });
      });

      await expect(
        client.transaction(async () => {
          throw new Error('original error');
        })
      ).rejects.toThrow('original error');

      expect(consoleSpy).toHaveBeenCalledWith(
        'ROLLBACK failed after transaction error:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('executeBatch', () => {
    let mockConn: SupabaseConnection;
    let client: SupabaseDatabaseClient;
    let executeCalls: Array<{ sql: string; params?: unknown[] }>;

    beforeEach(() => {
      executeCalls = [];
      mockConn = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        execute: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
          executeCalls.push({ sql, params });
          return Promise.resolve({ rowCount: 0 });
        }),
      };
      client = new SupabaseDatabaseClient(mockConn);
    });

    it('wraps statements in a single transaction', async () => {
      await client.executeBatch([
        { sql: 'INSERT INTO t (a) VALUES (?)', params: ['x'] },
        { sql: 'INSERT INTO t (a) VALUES (?)', params: ['y'] },
      ]);

      expect(executeCalls[0].sql).toBe('BEGIN');
      expect(executeCalls[1].sql).toBe('INSERT INTO t (a) VALUES ($1)');
      expect(executeCalls[1].params).toEqual(['x']);
      expect(executeCalls[2].sql).toBe('INSERT INTO t (a) VALUES ($1)');
      expect(executeCalls[2].params).toEqual(['y']);
      expect(executeCalls[3].sql).toBe('COMMIT');
    });

    it('rolls back on statement failure', async () => {
      let callCount = 0;
      mockConn.execute = vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
        executeCalls.push({ sql, params });
        callCount++;
        if (callCount === 2) return Promise.reject(new Error('constraint'));
        return Promise.resolve({ rowCount: 0 });
      });

      await expect(
        client.executeBatch([
          { sql: 'INSERT INTO t (a) VALUES (?)', params: ['x'] },
          { sql: 'INSERT INTO t (a) VALUES (?)', params: ['y'] },
        ])
      ).rejects.toThrow('constraint');

      expect(executeCalls[0].sql).toBe('BEGIN');
      expect(executeCalls[executeCalls.length - 1].sql).toBe('ROLLBACK');
    });

    it('does nothing for empty batch', async () => {
      await client.executeBatch([]);
      expect(executeCalls).toHaveLength(0);
    });
  });
});
