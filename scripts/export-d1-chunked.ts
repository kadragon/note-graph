#!/usr/bin/env bun
/**
 * Export D1 data as chunked PostgreSQL INSERT statements.
 * Usage: bun run scripts/export-d1-chunked.ts <table> <chunk_size> [offset]
 *
 * Outputs INSERT for rows [offset..offset+chunk_size) only.
 */

import { $ } from 'bun';

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

const table = process.argv[2];
const chunkSize = parseInt(process.argv[3] || '30');
const offset = parseInt(process.argv[4] || '0');

if (!table) {
  console.error('Usage: bun run scripts/export-d1-chunked.ts <table> <chunk_size> [offset]');
  process.exit(1);
}

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

const rows = await queryD1<Record<string, unknown>>(
  `SELECT * FROM ${table} LIMIT ${chunkSize} OFFSET ${offset}`
);

if (rows.length === 0) {
  process.stderr.write(`No rows at offset ${offset}\n`);
  process.exit(0);
}

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

process.stdout.write(
  `INSERT INTO ${table} (${allColumns.join(', ')}) VALUES\n${valueRows.join(',\n')}\nON CONFLICT DO NOTHING;\n`
);
process.stderr.write(`Exported ${rows.length} rows from offset ${offset}\n`);
