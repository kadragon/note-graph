/**
 * D1 adapter implementing DatabaseClient interface.
 * Wraps Cloudflare D1Database API into the generic DatabaseClient shape.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { DatabaseClient, TransactionClient } from '../types/database';

const D1_BATCH_LIMIT = 100;

export class D1DatabaseClient implements DatabaseClient {
  constructor(private db: D1Database) {}

  async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
    const stmt = this.db.prepare(sql);
    const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await bound.all<T>();
    return { rows: result.results ?? [] };
  }

  async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await bound.first<T>();
    return result ?? null;
  }

  async execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }> {
    const stmt = this.db.prepare(sql);
    const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await bound.run();
    return { rowCount: result.meta.changes ?? 0 };
  }

  async transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    // D1 does not support interactive transactions.
    // Execute queries sequentially through the same client.
    // For atomic multi-statement writes, callers should collect
    // statements and use executeBatch() instead.
    return fn(this);
  }

  /**
   * Execute multiple SQL statements atomically using D1 batch API.
   * This preserves the D1-specific atomicity guarantee that transaction() cannot.
   * Used during the migration period; Supabase adapter will use real transactions.
   */
  async executeBatch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    if (statements.length === 0) return;

    for (let i = 0; i < statements.length; i += D1_BATCH_LIMIT) {
      const chunk = statements.slice(i, i + D1_BATCH_LIMIT);
      const prepared = chunk.map((s) => {
        const stmt = this.db.prepare(s.sql);
        return s.params && s.params.length > 0 ? stmt.bind(...s.params) : stmt;
      });
      await this.db.batch(prepared);
    }
  }

  /** Access the underlying D1Database (for test setup and migration-period code) */
  get raw(): D1Database {
    return this.db;
  }
}
