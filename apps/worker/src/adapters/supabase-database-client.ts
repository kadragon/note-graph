/**
 * Supabase (PostgreSQL) adapter implementing DatabaseClient interface.
 * Translates D1-style SQL (? placeholders) to PostgreSQL ($1, $2, ...).
 */

import type { DatabaseClient, TransactionClient } from '../types/database';

/**
 * Abstraction over the raw SQL connection.
 * Allows testing the adapter without a real database.
 */
export interface SupabaseConnection {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;
}

/**
 * Translate D1-style `?` placeholders to PostgreSQL `$1, $2, ...`.
 * Skips `?` characters inside single-quoted string literals.
 */
export function translatePlaceholders(sql: string): string {
  let index = 0;
  let inString = false;
  let result = '';

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (ch === "'" && !inString) {
      inString = true;
      result += ch;
    } else if (ch === "'" && inString) {
      inString = false;
      result += ch;
    } else if (ch === '?' && !inString) {
      index++;
      result += `$${index}`;
    } else {
      result += ch;
    }
  }

  return result;
}

export class SupabaseDatabaseClient implements DatabaseClient {
  constructor(private conn: SupabaseConnection) {}

  async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
    return this.conn.query<T>(translatePlaceholders(sql), params);
  }

  async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const { rows } = await this.conn.query<T>(translatePlaceholders(sql), params);
    return rows[0] ?? null;
  }

  async execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }> {
    return this.conn.execute(translatePlaceholders(sql), params);
  }

  async transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    await this.conn.execute('BEGIN');
    try {
      const result = await fn(this);
      await this.conn.execute('COMMIT');
      return result;
    } catch (error) {
      await this.conn.execute('ROLLBACK');
      throw error;
    }
  }

  async executeBatch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void> {
    if (statements.length === 0) return;

    await this.conn.execute('BEGIN');
    try {
      for (const stmt of statements) {
        await this.conn.execute(translatePlaceholders(stmt.sql), stmt.params);
      }
      await this.conn.execute('COMMIT');
    } catch (error) {
      await this.conn.execute('ROLLBACK');
      throw error;
    }
  }
}
