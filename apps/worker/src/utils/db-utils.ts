/**
 * Database utilities for query operations
 */

import type { DatabaseClient } from '../types/database';

/**
 * SQLite has a limit of 999 binding variables per query.
 * Use 900 to leave room for additional query parameters.
 */
export const SQL_VAR_LIMIT = 900;

/**
 * Execute a query function in chunks to avoid SQLite's 999 variable limit.
 * Collects results from all chunks into a single array.
 *
 * @param db - Database client instance
 * @param items - Array of items to process in chunks
 * @param queryFn - Function that executes the query for a chunk, receives the db client, chunk, and placeholder string
 * @returns Combined results from all chunks
 */
export async function queryInChunks<T, R>(
  db: DatabaseClient,
  items: T[],
  queryFn: (db: DatabaseClient, chunk: T[], placeholders: string) => Promise<R[]>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results: R[] = [];
  for (let i = 0; i < items.length; i += SQL_VAR_LIMIT) {
    const chunk = items.slice(i, i + SQL_VAR_LIMIT);
    const placeholders = chunk.map(() => '?').join(',');
    results.push(...(await queryFn(db, chunk, placeholders)));
  }
  return results;
}
