/**
 * Database abstraction layer for PostgreSQL via Hyperdrive.
 * All repositories depend on this interface for database access.
 */

export interface DatabaseClient {
  /** Execute a query returning multiple rows */
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;

  /** Execute a query returning at most one row */
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;

  /** Execute a statement returning affected row count */
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;

  /** Execute multiple statements atomically */
  transaction<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T>;

  /** Execute multiple statements atomically as a batch (wraps in BEGIN/COMMIT). */
  executeBatch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<void>;

  /** Close the underlying connection. No-op for adapters that don't need cleanup. */
  close?(): Promise<void>;
}

export interface TransactionClient {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;
}
