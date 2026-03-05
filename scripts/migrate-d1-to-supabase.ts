#!/usr/bin/env bun
/**
 * D1 → Supabase data migration script.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://..." bun run scripts/migrate-d1-to-supabase.ts
 *
 * Reads from D1 via wrangler CLI, inserts into Supabase via postgres.js.
 * Handles: boolean conversion (0/1 → true/false), IDENTITY column skipping, JSONB casting.
 */

import { $ } from 'bun';

import { createSupabaseConnection } from '../apps/worker/src/adapters/supabase-connection';
import { SupabaseDatabaseClient } from '../apps/worker/src/adapters/supabase-database-client';

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
if (!SUPABASE_DB_URL) {
  console.error('SUPABASE_DB_URL is required');
  process.exit(1);
}

// Tables in dependency order (parents before children)
const MIGRATION_ORDER = [
  // Independent tables
  'departments',
  'app_settings',
  'task_categories',
  'work_note_groups',
  'persons',
  // First-level dependents
  'person_dept_history',
  'work_notes',
  'meeting_minutes',
  'pdf_jobs',
  'google_oauth_tokens',
  // Second-level dependents
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
  // Skip embedding_retry_queue (0 rows)
];

// Columns that are IDENTITY (auto-generated) in PostgreSQL — skip these
const IDENTITY_COLUMNS: Record<string, string[]> = {
  person_dept_history: ['id'],
  work_note_person: ['id'],
  work_note_relation: ['id'],
  work_note_versions: ['id'],
  work_note_task_category: ['id'],
  work_note_group_items: ['id'],
  work_note_files: [],
  meeting_minute_person: ['id'],
  meeting_minute_task_category: ['id'],
  meeting_minute_group: ['id'],
  work_note_meeting_minute: ['id'],
};

// Columns that are boolean in PostgreSQL but stored as 0/1 in D1
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  departments: ['is_active'],
  persons: [],
  person_dept_history: ['is_active'],
  task_categories: ['is_active'],
  work_note_groups: ['is_active'],
  todos: ['skip_weekends'],
};

// Columns that are JSONB in PostgreSQL but TEXT in D1
const JSONB_COLUMNS: Record<string, string[]> = {
  meeting_minutes: ['keywords_json'],
  pdf_jobs: ['draft_json', 'metadata_json'],
};

// Columns to exclude (generated columns in PostgreSQL)
const GENERATED_COLUMNS: Record<string, string[]> = {
  work_notes: ['fts_vector'],
  meeting_minutes: ['fts_vector'],
};

// Columns in D1 that don't exist in PostgreSQL (none currently)
const D1_ONLY_COLUMNS: Record<string, string[]> = {};

async function queryD1<T>(sql: string): Promise<T[]> {
  const result =
    await $`npx wrangler d1 execute worknote-db --remote --command ${sql} --json`.text();
  const parsed = JSON.parse(result);
  return parsed[0]?.results ?? [];
}

function escapeValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  const str = String(val).replace(/'/g, "''").replace(/\\/g, '\\\\');
  return `'${str}'`;
}

async function migrateTable(db: SupabaseDatabaseClient, table: string): Promise<number> {
  console.log(`\n📦 Migrating ${table}...`);

  const rows = await queryD1<Record<string, unknown>>(`SELECT * FROM ${table}`);

  if (rows.length === 0) {
    console.log(`  ⏭ No rows to migrate`);
    return 0;
  }

  const identityCols = IDENTITY_COLUMNS[table] ?? [];
  const boolCols = BOOLEAN_COLUMNS[table] ?? [];
  const jsonbCols = JSONB_COLUMNS[table] ?? [];
  const generatedCols = GENERATED_COLUMNS[table] ?? [];
  const d1OnlyCols = D1_ONLY_COLUMNS[table] ?? [];
  const skipCols = new Set([...identityCols, ...generatedCols, ...d1OnlyCols]);

  // Get column names from first row, filtering out skipped columns
  const allColumns = Object.keys(rows[0]).filter((c) => !skipCols.has(c));

  // Build batch INSERT (chunk into groups of 50 for safety)
  const CHUNK_SIZE = 50;
  let migrated = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    const valueRows = chunk.map((row) => {
      const values = allColumns.map((col) => {
        let val = row[col];

        // Convert D1 boolean (0/1) to PostgreSQL boolean
        if (boolCols.includes(col)) {
          val = val === 1 || val === true;
        }

        // JSONB columns: ensure they're valid JSON strings
        if (jsonbCols.includes(col) && val !== null && val !== undefined) {
          // D1 stores as TEXT, PostgreSQL needs JSONB cast
          const jsonStr = typeof val === 'string' ? val : JSON.stringify(val);
          return `'${jsonStr.replace(/'/g, "''")}'::jsonb`;
        }

        return escapeValue(val);
      });
      return `(${values.join(', ')})`;
    });

    const sql = `INSERT INTO ${table} (${allColumns.join(', ')}) VALUES\n${valueRows.join(',\n')}\nON CONFLICT DO NOTHING`;

    await db.execute(sql);
    migrated += chunk.length;
  }

  console.log(`  ✅ ${migrated} rows migrated`);
  return migrated;
}

async function main() {
  console.log('🚀 Starting D1 → Supabase migration\n');

  const conn = createSupabaseConnection(SUPABASE_DB_URL!);
  const db = new SupabaseDatabaseClient(conn);

  const results: Record<string, number> = {};

  try {
    for (const table of MIGRATION_ORDER) {
      results[table] = await migrateTable(db, table);
    }

    // Reset IDENTITY sequences for tables with auto-generated IDs
    console.log('\n🔄 Resetting IDENTITY sequences...');
    for (const [table, cols] of Object.entries(IDENTITY_COLUMNS)) {
      if (cols.length > 0 && results[table] > 0) {
        const maxResult = await db.queryOne<{ max_id: number }>(
          `SELECT COALESCE(MAX(${cols[0]}), 0) as max_id FROM ${table}`
        );
        if (maxResult && maxResult.max_id > 0) {
          await db.execute(
            `ALTER TABLE ${table} ALTER COLUMN ${cols[0]} RESTART WITH ${maxResult.max_id + 1}`
          );
          console.log(`  ✅ ${table}.${cols[0]} sequence reset to ${maxResult.max_id + 1}`);
        }
      }
    }

    // Verify row counts
    console.log('\n📊 Verification:');
    let allMatch = true;
    for (const table of MIGRATION_ORDER) {
      const pgResult = await db.queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM ${table}`);
      const pgCount = pgResult?.c ?? 0;
      const d1Count = results[table];
      const match = pgCount === d1Count ? '✅' : '❌';
      if (pgCount !== d1Count) allMatch = false;
      console.log(`  ${match} ${table}: D1=${d1Count}, PG=${pgCount}`);
    }

    if (allMatch) {
      console.log('\n🎉 Migration complete! All row counts match.');
    } else {
      console.log('\n⚠️ Migration complete but some row counts differ.');
    }
  } finally {
    await conn.close();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
