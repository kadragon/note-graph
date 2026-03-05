import type { SupabaseConnection } from '@worker/adapters/supabase-database-client';
import {
  SupabaseDatabaseClient,
  translatePlaceholders,
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
