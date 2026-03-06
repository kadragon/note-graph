/**
 * Real PostgreSQL connection implementing SupabaseConnection.
 * Uses postgres.js (porsager) to connect to Supabase's PostgreSQL.
 */

import postgres from 'postgres';
import type { SupabaseConnection } from './supabase-database-client';

export function createSupabaseConnection(
  databaseUrl: string
): SupabaseConnection & { close: () => Promise<void> } {
  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return {
    async query<T>(sqlText: string, params?: unknown[]): Promise<{ rows: T[] }> {
      const rows = await sql.unsafe<T[]>(sqlText, params as any[]);
      return { rows: rows as T[] };
    },

    async execute(sqlText: string, params?: unknown[]): Promise<{ rowCount: number }> {
      const result = await sql.unsafe(sqlText, params as any[]);
      return { rowCount: result.count ?? 0 };
    },

    async begin<T>(
      fn: (tx: {
        query<R>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
        execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;
      }) => Promise<T>
    ): Promise<T> {
      return sql.begin(async (txSql) => {
        const tx = {
          async query<R>(sqlText: string, params?: unknown[]): Promise<{ rows: R[] }> {
            const rows = await txSql.unsafe<R[]>(sqlText, params as any[]);
            return { rows: rows as R[] };
          },
          async execute(sqlText: string, params?: unknown[]): Promise<{ rowCount: number }> {
            const result = await txSql.unsafe(sqlText, params as any[]);
            return { rowCount: result.count ?? 0 };
          },
        };
        return fn(tx);
      }) as Promise<T>;
    },

    async close() {
      await sql.end();
    },
  };
}
