import type { SupabaseConnection } from '@worker/adapters/supabase-database-client';
import { SupabaseDatabaseClient } from '@worker/adapters/supabase-database-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SupabaseDatabaseClient', () => {
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
    it('passes SQL and params through to the connection', async () => {
      const mockConn: SupabaseConnection = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      const client = new SupabaseDatabaseClient(mockConn);
      const sql = 'SELECT t.todo_id as "todoId" FROM todos t WHERE t.work_id = $1';

      await client.query(sql, ['W-1']);

      expect(mockConn.query).toHaveBeenCalledWith(sql, ['W-1']);
    });

    it('returns rows from connection', async () => {
      const mockConn: SupabaseConnection = {
        query: vi.fn().mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] }),
        execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      const client = new SupabaseDatabaseClient(mockConn);

      const result = await client.query('SELECT * FROM t WHERE a = $1 AND b = $2', ['x', 'y']);

      expect(result.rows).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('preserves camelCase keys from double-quoted aliases', async () => {
      const mockConn: SupabaseConnection = {
        query: vi.fn().mockResolvedValue({ rows: [{ workId: 'W-001', createdAt: '2026-01-01' }] }),
        execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      const client = new SupabaseDatabaseClient(mockConn);

      const result = await client.query<{ workId: string; createdAt: string }>(
        'SELECT work_id as "workId", created_at as "createdAt" FROM work_notes WHERE id = $1',
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

      const result = await client.queryOne('SELECT * FROM t WHERE id = $1', [1]);

      expect(result).toEqual({ id: 1 });
    });

    it('returns null when no rows', async () => {
      const mockConn: SupabaseConnection = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        execute: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      const client = new SupabaseDatabaseClient(mockConn);

      const result = await client.queryOne('SELECT * FROM t WHERE id = $1', [999]);

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
        await tx.execute('INSERT INTO t (a) VALUES ($1)', ['x']);
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
        { sql: 'INSERT INTO t (a) VALUES ($1)', params: ['x'] },
        { sql: 'INSERT INTO t (a) VALUES ($1)', params: ['y'] },
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
          { sql: 'INSERT INTO t (a) VALUES ($1)', params: ['x'] },
          { sql: 'INSERT INTO t (a) VALUES ($1)', params: ['y'] },
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
