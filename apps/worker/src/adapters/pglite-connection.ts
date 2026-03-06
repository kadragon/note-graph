/**
 * PGlite adapter implementing SupabaseConnection interface.
 * Used for testing with in-process PostgreSQL (no Docker required).
 */

import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseConnection } from './supabase-database-client';

export function createPgliteConnection(pglite: PGlite): SupabaseConnection {
  return {
    async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
      const result = await pglite.query<T>(sql, params);
      return { rows: result.rows };
    },

    async execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }> {
      const result = await pglite.query(sql, params);
      return { rowCount: result.affectedRows ?? 0 };
    },
  };
}
