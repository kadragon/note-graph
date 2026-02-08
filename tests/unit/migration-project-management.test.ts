// Trace: SPEC-project-1, TASK-035

import { env } from 'cloudflare:test';
import type { D1Database } from '@cloudflare/workers-types';
import { describe, expect, it } from 'vitest';

// Use a getter to defer DB access until test execution
const getDb = () => env.DB as D1Database;

interface TableInfoRow {
  cid: number;
  name: string;
  type: string;
  notnull: 0 | 1;
  dflt_value: string | null;
  pk: 0 | 1;
}

interface IndexInfoRow {
  seq: number;
  name: string;
  unique: 0 | 1;
  origin: string;
  partial: 0 | 1;
}

interface ForeignKeyInfoRow {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
  match: string;
}

async function getTableColumns(table: string): Promise<string[]> {
  const { results } = await getDb().prepare(`PRAGMA table_info(${table});`).all<TableInfoRow>();
  return (results ?? []).map((row) => row.name);
}

async function getIndexNames(table: string): Promise<string[]> {
  const { results } = await getDb().prepare(`PRAGMA index_list(${table});`).all<IndexInfoRow>();
  return (results ?? []).map((row) => row.name);
}

async function getForeignKeys(table: string): Promise<Array<{ from: string; table: string }>> {
  const { results } = await getDb()
    .prepare(`PRAGMA foreign_key_list(${table});`)
    .all<ForeignKeyInfoRow>();
  return (results ?? []).map((row) => ({
    from: row.from,
    table: row.table,
  }));
}

describe('Project schema migrations', () => {
  it('adds Drive metadata columns to project_files and keeps storage_type default as R2', async () => {
    const { results } = await getDb()
      .prepare(`PRAGMA table_info(project_files);`)
      .all<TableInfoRow>();
    const projectFileColumns = results ?? [];

    const columnNames = projectFileColumns.map((row) => row.name);
    expect(columnNames).toEqual(
      expect.arrayContaining([
        'storage_type',
        'gdrive_file_id',
        'gdrive_folder_id',
        'gdrive_web_view_link',
      ])
    );

    const storageTypeColumn = projectFileColumns.find((row) => row.name === 'storage_type');
    expect(storageTypeColumn).toBeDefined();
    expect(storageTypeColumn?.dflt_value).toBe("'R2'");
  });

  it('creates project_gdrive_folders with project_id PK and cascade FK', async () => {
    const { results: tableInfoResults } = await getDb()
      .prepare(`PRAGMA table_info(project_gdrive_folders);`)
      .all<TableInfoRow>();
    const tableInfo = tableInfoResults ?? [];

    expect(tableInfo.map((row) => row.name)).toEqual(
      expect.arrayContaining(['project_id', 'gdrive_folder_id', 'gdrive_folder_link', 'created_at'])
    );

    const projectIdColumn = tableInfo.find((row) => row.name === 'project_id');
    expect(projectIdColumn).toBeDefined();
    expect(projectIdColumn?.pk).toBe(1);

    const { results: fkResults } = await getDb()
      .prepare(`PRAGMA foreign_key_list(project_gdrive_folders);`)
      .all<ForeignKeyInfoRow>();

    expect(fkResults ?? []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'project_id',
          table: 'projects',
          on_delete: 'CASCADE',
        }),
      ])
    );
  });

  it('creates project_files indexes for storage_type and gdrive_file_id', async () => {
    const fileIndexes = await getIndexNames('project_files');
    expect(fileIndexes).toEqual(
      expect.arrayContaining(['idx_project_files_storage_type', 'idx_project_files_gdrive_file_id'])
    );
  });

  it('creates project entities and relationships tables', async () => {
    await expect(getTableColumns('projects')).resolves.toEqual(
      expect.arrayContaining([
        'project_id',
        'name',
        'status',
        'start_date',
        'actual_end_date',
        'dept_name',
        'deleted_at',
      ])
    );

    await expect(getTableColumns('project_participants')).resolves.toEqual(
      expect.arrayContaining(['project_id', 'person_id', 'role', 'joined_at'])
    );

    await expect(getTableColumns('project_work_notes')).resolves.toEqual(
      expect.arrayContaining(['project_id', 'work_id', 'assigned_at'])
    );

    await expect(getTableColumns('project_files')).resolves.toEqual(
      expect.arrayContaining([
        'project_id',
        'r2_key',
        'original_name',
        'file_type',
        'file_size',
        'uploaded_at',
        'embedded_at',
      ])
    );
  });

  it('adds project_id to work_notes with proper indexing and foreign keys', async () => {
    const workNoteColumns = await getTableColumns('work_notes');
    expect(workNoteColumns).toContain('project_id');

    const workNoteIndexes = await getIndexNames('work_notes');
    expect(workNoteIndexes).toContain('idx_work_notes_project_id');

    const workNoteFks = await getForeignKeys('work_notes');
    expect(workNoteFks).toEqual(
      expect.arrayContaining([{ from: 'project_id', table: 'projects' }])
    );
  });

  it('creates required indexes for project queries', async () => {
    const projectIndexes = await getIndexNames('projects');
    expect(projectIndexes).toEqual(
      expect.arrayContaining([
        'idx_projects_status',
        'idx_projects_dept',
        'idx_projects_start_date',
      ])
    );

    const participantIndexes = await getIndexNames('project_participants');
    expect(participantIndexes).toEqual(
      expect.arrayContaining([
        'idx_project_participants_project',
        'idx_project_participants_person',
      ])
    );

    const workNoteIndexes = await getIndexNames('project_work_notes');
    expect(workNoteIndexes).toEqual(
      expect.arrayContaining(['idx_project_work_notes_project', 'idx_project_work_notes_work'])
    );

    const fileIndexes = await getIndexNames('project_files');
    expect(fileIndexes).toEqual(
      expect.arrayContaining(['idx_project_files_project', 'idx_project_files_r2_key'])
    );
  });

  it('enforces foreign keys on project-related tables', async () => {
    const projectParticipantFks = await getForeignKeys('project_participants');
    expect(projectParticipantFks).toEqual(
      expect.arrayContaining([
        { from: 'project_id', table: 'projects' },
        { from: 'person_id', table: 'persons' },
      ])
    );

    const projectFileFks = await getForeignKeys('project_files');
    expect(projectFileFks).toEqual(
      expect.arrayContaining([{ from: 'project_id', table: 'projects' }])
    );

    const projectWorkNoteFks = await getForeignKeys('project_work_notes');
    expect(projectWorkNoteFks).toEqual(
      expect.arrayContaining([
        { from: 'project_id', table: 'projects' },
        { from: 'work_id', table: 'work_notes' },
      ])
    );
  });
});
