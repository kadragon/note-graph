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
}

/**
 * Strip string literals (single-quoted) and double-quoted identifiers from SQL,
 * replacing their contents with spaces. This prevents regex-based analysis from
 * matching tokens inside quoted contexts.
 */
function stripQuotedContexts(sql: string): string {
  return sql
    .replace(/'[^']*'/g, (m) => ' '.repeat(m.length))
    .replace(/"[^"]*"/g, (m) => ' '.repeat(m.length));
}

/**
 * Extract camelCase aliases from SQL and build a lowercase → original mapping.
 * PostgreSQL folds unquoted identifiers to lowercase, so `AS workId` returns
 * a column named `workid`. This map allows restoring the original casing on
 * result rows without modifying the SQL (which would break ORDER BY / HAVING /
 * CTE references to those aliases).
 */
export function buildAliasMap(sql: string): Map<string, string> | null {
  const stripped = stripQuotedContexts(sql);
  const map = new Map<string, string>();
  for (const match of stripped.matchAll(/\b[Aa][Ss]\s+(?!")([a-z]\w*[A-Z]\w*)\b/g)) {
    const alias = match[1] as string;
    map.set(alias.toLowerCase(), alias);
  }
  return map.size > 0 ? map : null;
}

/** Remap lowercased PostgreSQL column names back to original camelCase aliases. */
function remapRowKeys<T>(rows: T[], aliasMap: Map<string, string>): T[] {
  return rows.map((row) => {
    const remapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      remapped[aliasMap.get(key) ?? key] = value;
    }
    return remapped as T;
  });
}

export class SupabaseDatabaseClient implements DatabaseClient {
  constructor(private conn: SupabaseConnection) {}

  async close(): Promise<void> {
    await this.conn.close?.();
  }

  async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
    const aliasMap = buildAliasMap(sql);
    const result = await this.conn.query<T>(sql, params);
    if (aliasMap) {
      return { rows: remapRowKeys(result.rows, aliasMap) };
    }
    return result;
  }

  async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const aliasMap = buildAliasMap(sql);
    const { rows } = await this.conn.query<T>(sql, params);
    if (aliasMap && rows[0]) {
      return remapRowKeys(rows, aliasMap)[0] ?? null;
    }
    return rows[0] ?? null;
  }

  async execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }> {
    return this.conn.execute(sql, params);
  }

  async transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
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
