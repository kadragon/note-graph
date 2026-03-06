import { describe, expect, it } from 'vitest';
import { pglite } from '../pg-setup';

async function getTableColumns(table: string): Promise<string[]> {
  const result = await pglite.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
    [table]
  );
  return result.rows.map((row) => row.column_name);
}

async function getForeignKeys(table: string): Promise<Array<{ from: string; table: string }>> {
  const result = await pglite.query<{ from: string; table: string }>(
    `SELECT kcu.column_name AS "from", ccu.table_name AS "table"
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1`,
    [table]
  );
  return result.rows.map((row) => ({ from: row.from, table: row.table }));
}

async function hasUniqueCompositeIndex(table: string, columns: string[]): Promise<boolean> {
  // Find unique indexes on the table
  const result = await pglite.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE tablename = $1 AND indexdef LIKE '%UNIQUE%'`,
    [table]
  );

  for (const row of result.rows) {
    const indexCols = await pglite.query<{ attname: string }>(
      `SELECT a.attname
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE c.relname = $1`,
      [row.indexname]
    );
    const indexColumnNames = indexCols.rows.map((r) => r.attname);
    const sameLength = indexColumnNames.length === columns.length;
    const sameColumns = columns.every((col) => indexColumnNames.includes(col));
    if (sameLength && sameColumns) {
      return true;
    }
  }

  // Also check unique constraints (not just indexes)
  const constraintResult = await pglite.query<{ constraint_name: string }>(
    `SELECT constraint_name FROM information_schema.table_constraints
     WHERE table_name = $1 AND constraint_type = 'UNIQUE'`,
    [table]
  );

  for (const row of constraintResult.rows) {
    const constraintCols = await pglite.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.key_column_usage
       WHERE constraint_name = $1`,
      [row.constraint_name]
    );
    const colNames = constraintCols.rows.map((r) => r.column_name);
    const sameLength = colNames.length === columns.length;
    const sameColumns = columns.every((col) => colNames.includes(col));
    if (sameLength && sameColumns) {
      return true;
    }
  }

  return false;
}

async function getIndexNames(table: string): Promise<string[]> {
  const result = await pglite.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE tablename = $1`,
    [table]
  );
  return result.rows.map((row) => row.indexname);
}

async function tableExists(table: string): Promise<boolean> {
  const result = await pglite.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) AS "exists"`,
    [table]
  );
  return result.rows[0]?.exists ?? false;
}

describe('Meeting minutes schema migrations', () => {
  it('creates meeting minutes tables with required foreign keys and unique constraints', async () => {
    await expect(getTableColumns('meeting_minutes')).resolves.toEqual(
      expect.arrayContaining([
        'meeting_id',
        'meeting_date',
        'topic',
        'details_raw',
        'keywords_json',
        'keywords_text',
      ])
    );

    await expect(getTableColumns('meeting_minute_person')).resolves.toEqual(
      expect.arrayContaining(['meeting_id', 'person_id'])
    );
    await expect(getForeignKeys('meeting_minute_person')).resolves.toEqual(
      expect.arrayContaining([
        { from: 'meeting_id', table: 'meeting_minutes' },
        { from: 'person_id', table: 'persons' },
      ])
    );
    await expect(
      hasUniqueCompositeIndex('meeting_minute_person', ['meeting_id', 'person_id'])
    ).resolves.toBe(true);

    await expect(getTableColumns('meeting_minute_task_category')).resolves.toEqual(
      expect.arrayContaining(['meeting_id', 'category_id'])
    );
    await expect(getForeignKeys('meeting_minute_task_category')).resolves.toEqual(
      expect.arrayContaining([
        { from: 'meeting_id', table: 'meeting_minutes' },
        { from: 'category_id', table: 'task_categories' },
      ])
    );
    await expect(
      hasUniqueCompositeIndex('meeting_minute_task_category', ['meeting_id', 'category_id'])
    ).resolves.toBe(true);

    await expect(getTableColumns('work_note_meeting_minute')).resolves.toEqual(
      expect.arrayContaining(['work_id', 'meeting_id'])
    );
    await expect(getForeignKeys('work_note_meeting_minute')).resolves.toEqual(
      expect.arrayContaining([
        { from: 'work_id', table: 'work_notes' },
        { from: 'meeting_id', table: 'meeting_minutes' },
      ])
    );
    await expect(
      hasUniqueCompositeIndex('work_note_meeting_minute', ['work_id', 'meeting_id'])
    ).resolves.toBe(true);
  });

  it('creates indexes for meeting_date, attendee/category joins, and work-note meeting links', async () => {
    await expect(getIndexNames('meeting_minutes')).resolves.toEqual(
      expect.arrayContaining(['idx_meeting_minutes_meeting_date'])
    );

    await expect(getIndexNames('meeting_minute_person')).resolves.toEqual(
      expect.arrayContaining([
        'idx_meeting_minute_person_meeting_id',
        'idx_meeting_minute_person_person_id',
      ])
    );

    await expect(getIndexNames('meeting_minute_task_category')).resolves.toEqual(
      expect.arrayContaining([
        'idx_meeting_minute_task_category_meeting_id',
        'idx_meeting_minute_task_category_category_id',
      ])
    );

    await expect(getIndexNames('work_note_meeting_minute')).resolves.toEqual(
      expect.arrayContaining([
        'idx_work_note_meeting_minute_work_id',
        'idx_work_note_meeting_minute_meeting_id',
      ])
    );
  });

  it('creates meeting_minutes table (FTS equivalent verified by table existence in PG)', async () => {
    // In PostgreSQL, FTS is handled differently than SQLite FTS5.
    // We verify the main table exists and has the text-searchable columns.
    await expect(tableExists('meeting_minutes')).resolves.toBe(true);
    await expect(getTableColumns('meeting_minutes')).resolves.toEqual(
      expect.arrayContaining(['topic', 'details_raw', 'keywords_text'])
    );
  });
});
