import { env } from 'cloudflare:test';
import type { D1Database } from '@cloudflare/workers-types';
import { describe, expect, it } from 'vitest';

const getDb = () => env.DB as D1Database;

interface TableInfoRow {
  name: string;
}

interface ForeignKeyInfoRow {
  table: string;
  from: string;
}

interface IndexListRow {
  name: string;
  unique: 0 | 1;
}

interface IndexInfoRow {
  name: string;
}

interface SQLiteObjectNameRow {
  name: string;
}

async function getTableColumns(table: string): Promise<string[]> {
  const { results } = await getDb().prepare(`PRAGMA table_info(${table});`).all<TableInfoRow>();
  return (results ?? []).map((row) => row.name);
}

async function getForeignKeys(table: string): Promise<Array<{ from: string; table: string }>> {
  const { results } = await getDb()
    .prepare(`PRAGMA foreign_key_list(${table});`)
    .all<ForeignKeyInfoRow>();
  return (results ?? []).map((row) => ({ from: row.from, table: row.table }));
}

async function hasUniqueCompositeIndex(table: string, columns: string[]): Promise<boolean> {
  const { results } = await getDb().prepare(`PRAGMA index_list(${table});`).all<IndexListRow>();
  const uniqueIndexes = (results ?? []).filter((row) => row.unique === 1).map((row) => row.name);

  for (const indexName of uniqueIndexes) {
    const indexInfo = await getDb().prepare(`PRAGMA index_info(${indexName});`).all<IndexInfoRow>();
    const indexColumns = (indexInfo.results ?? []).map((row) => row.name);
    const sameLength = indexColumns.length === columns.length;
    const sameColumns = columns.every((column) => indexColumns.includes(column));
    if (sameLength && sameColumns) {
      return true;
    }
  }

  return false;
}

async function getIndexNames(table: string): Promise<string[]> {
  const { results } = await getDb().prepare(`PRAGMA index_list(${table});`).all<IndexListRow>();
  return (results ?? []).map((row) => row.name);
}

async function getObjectNames(type: 'table' | 'trigger', tblName?: string): Promise<string[]> {
  let sql = `SELECT name FROM sqlite_master WHERE type = ?`;
  const params: string[] = [type];

  if (tblName) {
    sql += ` AND tbl_name = ?`;
    params.push(tblName);
  }

  const { results } = await getDb()
    .prepare(sql)
    .bind(...params)
    .all<SQLiteObjectNameRow>();
  return (results ?? []).map((row) => row.name);
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

  it('creates meeting_minutes_fts and insert/update/delete sync triggers', async () => {
    await expect(getObjectNames('table')).resolves.toEqual(
      expect.arrayContaining(['meeting_minutes_fts'])
    );
    await expect(getTableColumns('meeting_minutes_fts')).resolves.toEqual(
      expect.arrayContaining(['topic', 'details_raw', 'keywords_text'])
    );

    await expect(getObjectNames('trigger', 'meeting_minutes')).resolves.toEqual(
      expect.arrayContaining([
        'meeting_minutes_fts_ai',
        'meeting_minutes_fts_au',
        'meeting_minutes_fts_ad',
      ])
    );
  });
});
