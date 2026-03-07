/**
 * Utility helpers for PGlite-based tests.
 */

import type { PGlite } from '@electric-sql/pglite';

/**
 * Delete all rows from the given tables (in order) using TRUNCATE CASCADE.
 * Use in beforeEach/afterEach to isolate tests.
 */
export async function pgCleanup(pglite: PGlite, tables: string[]): Promise<void> {
  if (tables.length === 0) return;
  await pglite.exec(`TRUNCATE ${tables.join(', ')} CASCADE`);
}

/**
 * Truncate ALL application tables in a single statement.
 * Preferred over pgCleanup when the test touches multiple or unknown tables.
 */
export async function pgCleanupAll(pglite: PGlite): Promise<void> {
  await pglite.exec(`
    TRUNCATE
      work_note_meeting_minute, meeting_minute_task_category,
      meeting_minute_group, meeting_minute_person, meeting_minutes,
      work_note_group_items, work_note_groups,
      work_note_relation, work_note_person, work_note_task_category,
      work_note_files, work_note_gdrive_folders,
      work_note_versions, work_notes,
      todos, pdf_jobs, embedding_retry_queue,
      person_dept_history, persons, departments,
      task_categories, google_oauth_tokens, app_settings, daily_reports
    CASCADE
  `);
}

/**
 * Seed a single row into a table.
 * Columns and values are derived from the data object keys.
 */
export async function pgInsert(
  pglite: PGlite,
  table: string,
  data: Record<string, unknown>
): Promise<void> {
  const keys = Object.keys(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  const columns = keys.join(', ');
  await pglite.query(
    `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
    Object.values(data)
  );
}

/**
 * Execute a parameterized query directly against PGlite.
 * Convenience wrapper matching an ORM-like `prepare().bind().run()` pattern.
 */
export async function pgExec(pglite: PGlite, sql: string, params?: unknown[]): Promise<void> {
  await pglite.query(sql, params);
}

/**
 * Execute a parameterized query and return one column value from first row.
 */
export async function pgQueryOne<T = unknown>(
  pglite: PGlite,
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const result = await pglite.query(sql, params);
  if (result.rows.length === 0) return null;
  return result.rows[0] as T;
}
