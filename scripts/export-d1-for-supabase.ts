#!/usr/bin/env bun
/**
 * Export D1 data as PostgreSQL INSERT statements.
 * Usage: bun run scripts/export-d1-for-supabase.ts > /tmp/d1-inserts.sql
 *
 * Or per table: bun run scripts/export-d1-for-supabase.ts departments
 */

import { $ } from 'bun';

const MIGRATION_ORDER = [
  'departments',
  'app_settings',
  'task_categories',
  'work_note_groups',
  'persons',
  'person_dept_history',
  'work_notes',
  'meeting_minutes',
  'pdf_jobs',
  'google_oauth_tokens',
  'work_note_person',
  'work_note_relation',
  'work_note_versions',
  'work_note_task_category',
  'work_note_group_items',
  'work_note_files',
  'work_note_gdrive_folders',
  'todos',
  'meeting_minute_person',
  'meeting_minute_task_category',
  'meeting_minute_group',
  'work_note_meeting_minute',
];

const IDENTITY_COLUMNS = new Set([
  'person_dept_history.id',
  'work_note_person.id',
  'work_note_relation.id',
  'work_note_versions.id',
  'work_note_task_category.id',
  'work_note_group_items.id',
  'meeting_minute_person.id',
  'meeting_minute_task_category.id',
  'meeting_minute_group.id',
  'work_note_meeting_minute.id',
]);

const BOOLEAN_COLUMNS = new Set([
  'departments.is_active',
  'person_dept_history.is_active',
  'task_categories.is_active',
  'work_note_groups.is_active',
  'todos.skip_weekends',
]);

const JSONB_COLUMNS = new Set([
  'meeting_minutes.keywords_json',
  'pdf_jobs.draft_json',
  'pdf_jobs.metadata_json',
]);

async function queryD1<T>(sql: string): Promise<T[]> {
  const result = await $`npx wrangler d1 execute worknote-db --remote --command ${sql} --json`
    .quiet()
    .text();
  const parsed = JSON.parse(result);
  return parsed[0]?.results ?? [];
}

function escapeValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  const str = String(val).replace(/'/g, "''").replace(/\\/g, '\\\\');
  return `'${str}'`;
}

async function exportTable(table: string): Promise<string> {
  const rows = await queryD1<Record<string, unknown>>(`SELECT * FROM ${table}`);
  if (rows.length === 0) return `-- ${table}: 0 rows\n`;

  const allColumns = Object.keys(rows[0]).filter((col) => !IDENTITY_COLUMNS.has(`${table}.${col}`));

  const valueRows = rows.map((row) => {
    const values = allColumns.map((col) => {
      const key = `${table}.${col}`;
      const val = row[col];

      if (BOOLEAN_COLUMNS.has(key)) {
        return val === 1 || val === true ? 'TRUE' : 'FALSE';
      }
      if (JSONB_COLUMNS.has(key)) {
        if (val === null || val === undefined) return 'NULL';
        const jsonStr = typeof val === 'string' ? val : JSON.stringify(val);
        return `'${jsonStr.replace(/'/g, "''")}'::jsonb`;
      }
      return escapeValue(val);
    });
    return `(${values.join(', ')})`;
  });

  return `-- ${table}: ${rows.length} rows\nINSERT INTO ${table} (${allColumns.join(', ')}) VALUES\n${valueRows.join(',\n')}\nON CONFLICT DO NOTHING;\n\n`;
}

async function main() {
  const targetTable = process.argv[2];
  const tables = targetTable ? [targetTable] : MIGRATION_ORDER;

  for (const table of tables) {
    process.stderr.write(`Exporting ${table}...\n`);
    const sql = await exportTable(table);
    process.stdout.write(sql);
  }

  // Reset IDENTITY sequences
  process.stdout.write('-- Reset IDENTITY sequences\n');
  for (const key of IDENTITY_COLUMNS) {
    const [table, col] = key.split('.');
    process.stdout.write(
      `SELECT setval(pg_get_serial_sequence('${table}', '${col}'), COALESCE((SELECT MAX(${col}) FROM ${table}), 0) + 1, false);\n`
    );
  }
}

main().catch((err) => {
  process.stderr.write(`Export failed: ${err}\n`);
  process.exit(1);
});
