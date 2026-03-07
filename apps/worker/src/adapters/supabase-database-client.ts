/**
 * Supabase (PostgreSQL) adapter implementing DatabaseClient interface.
 */

import type { DatabaseClient, TransactionClient } from '../types/database';

/**
 * Abstraction over the raw SQL connection.
 * Allows testing the adapter without a real database.
 */
export interface SupabaseConnection {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;
  close?(): Promise<void>;
  begin?<T>(
    fn: (tx: {
      query<R>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
      execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;
    }) => Promise<T>
  ): Promise<T>;
}

export class SupabaseDatabaseClient implements DatabaseClient {
  constructor(private conn: SupabaseConnection) {}

  async close(): Promise<void> {
    await this.conn.close?.();
  }

  async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
    return this.conn.query<T>(sql, params);
  }

  async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const { rows } = await this.conn.query<T>(sql, params);
    return rows[0] ?? null;
  }

  async execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }> {
    return this.conn.execute(sql, params);
  }

  async transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    if (this.conn.begin) {
      return this.conn.begin(async (tx) => {
        const txClient: TransactionClient = {
          query: <R>(sql: string, params?: unknown[]) => tx.query<R>(sql, params),
          queryOne: async <R>(sql: string, params?: unknown[]) => {
            const { rows } = await tx.query<R>(sql, params);
            return rows[0] ?? null;
          },
          execute: (sql: string, params?: unknown[]) => tx.execute(sql, params),
        };
        return fn(txClient);
      });
    }

    await this.conn.execute('BEGIN');
    try {
      const result = await fn(this);
      await this.conn.execute('COMMIT');
      return result;
    } catch (error) {
      try {
        await this.conn.execute('ROLLBACK');
      } catch (rollbackError) {
        console.error('ROLLBACK failed after transaction error:', rollbackError);
      }
      throw error;
    }
  }

  async executeBatch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    if (statements.length === 0) return;

    if (this.conn.begin) {
      await this.conn.begin(async (tx) => {
        for (const stmt of statements) {
          await tx.execute(stmt.sql, stmt.params);
        }
      });
      return;
    }

    await this.conn.execute('BEGIN');
    try {
      for (const stmt of statements) {
        await this.conn.execute(stmt.sql, stmt.params);
      }
      await this.conn.execute('COMMIT');
    } catch (error) {
      try {
        await this.conn.execute('ROLLBACK');
      } catch (rollbackError) {
        console.error('ROLLBACK failed after batch error:', rollbackError);
      }
      throw error;
    }
  }
}
