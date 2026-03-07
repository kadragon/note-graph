/**
 * Database utilities for query operations
 */

import type { DatabaseClient } from '../types/database';

/**
 * PostgreSQL supports up to 32,767 binding variables per query.
 * Use 32,000 to leave room for additional query parameters.
 */
export const SQL_VAR_LIMIT = 32000;

/**
 * Generate PostgreSQL-style numbered placeholders: $1, $2, ..., $N
 */
export function pgPlaceholders(count: number, startIndex: number = 1): string {
  return Array.from({ length: count }, (_, i) => `$${startIndex + i}`).join(', ');
}

/**
 * Execute a query function in chunks to avoid PostgreSQL's variable limit.
 * Collects results from all chunks into a single array.
 *
 * @param db - Database client instance
 * @param items - Array of items to process in chunks
 * @param queryFn - Function that executes the query for a chunk, receives the db client, chunk, and placeholder string
 * @returns Combined results from all chunks
 */
/**
 * Build a multi-row INSERT statement with numbered placeholders.
 * Returns { sql, params } ready for db.execute().
 *
 * @param table - Table name
 * @param columns - Column names
 * @param rows - Array of row value arrays (each must match columns.length)
 * @param onConflict - Optional ON CONFLICT clause (e.g. 'DO NOTHING')
 */
export function buildMultiRowInsert(
  table: string,
  columns: string[],
  rows: unknown[][],
  onConflict?: string
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const valueClauses: string[] = [];
  let paramIndex = 1;

  for (const row of rows) {
    const placeholders = row.map(() => `$${paramIndex++}`).join(', ');
    valueClauses.push(`(${placeholders})`);
    params.push(...row);
  }

  let sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${valueClauses.join(', ')}`;
  if (onConflict) {
    sql += ` ${onConflict}`;
  }

  return { sql, params };
}

export async function queryInChunks<T, R>(
  db: DatabaseClient,
  items: T[],
  queryFn: (db: DatabaseClient, chunk: T[], placeholders: string) => Promise<R[]>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results: R[] = [];
  for (let i = 0; i < items.length; i += SQL_VAR_LIMIT) {
    const chunk = items.slice(i, i + SQL_VAR_LIMIT);
    const placeholders = pgPlaceholders(chunk.length);
    results.push(...(await queryFn(db, chunk, placeholders)));
  }
  return results;
}
