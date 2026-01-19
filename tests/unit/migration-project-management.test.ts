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

describe('Migration 0014 - Project management schema', () => {
  it('creates project entities and relationships tables', async () => {
    await expect(getTableColumns('projects')).resolves.toEqual(
      expect.arrayContaining([
        'project_id',
        'name',
        'status',
        'priority',
        'leader_person_id',
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
        'idx_projects_leader',
        'idx_projects_dept',
        'idx_projects_dates',
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
