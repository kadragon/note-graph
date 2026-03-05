import type { WorkNoteGroup, WorkNoteGroupWorkNote } from '@shared/types/work-note-group';
import { nanoid } from 'nanoid';
import type { DatabaseClient } from '../types/database';
import { ConflictError, NotFoundError } from '../types/errors';

interface WorkNoteGroupRow {
  groupId: string;
  name: string;
  isActive: number;
  createdAt: string;
}

export class WorkNoteGroupRepository {
  constructor(private db: DatabaseClient) {}

  private toWorkNoteGroup(row: WorkNoteGroupRow): WorkNoteGroup {
    return {
      groupId: row.groupId,
      name: row.name,
      isActive: Boolean(row.isActive),
      createdAt: row.createdAt,
    };
  }

  async findById(groupId: string): Promise<WorkNoteGroup | null> {
    const result = await this.db.queryOne<WorkNoteGroupRow>(
      `SELECT group_id as groupId, name, is_active as isActive, created_at as createdAt
       FROM work_note_groups
       WHERE group_id = ?`,
      [groupId]
    );

    return result ? this.toWorkNoteGroup(result) : null;
  }

  async findByName(name: string): Promise<WorkNoteGroup | null> {
    const result = await this.db.queryOne<WorkNoteGroupRow>(
      `SELECT group_id as groupId, name, is_active as isActive, created_at as createdAt
       FROM work_note_groups
       WHERE name = ?`,
      [name]
    );

    return result ? this.toWorkNoteGroup(result) : null;
  }

  async findAll(
    searchQuery?: string,
    limit: number = 100,
    activeOnly?: boolean
  ): Promise<WorkNoteGroup[]> {
    let sql = `SELECT group_id as groupId, name, is_active as isActive, created_at as createdAt
               FROM work_note_groups`;
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (searchQuery) {
      conditions.push('name LIKE ?');
      params.push(`%${searchQuery}%`);
    }

    if (activeOnly) {
      conditions.push('is_active');
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY name ASC LIMIT ?';
    params.push(limit);

    const result = await this.db.query<WorkNoteGroupRow>(sql, params);
    return result.rows.map((row) => this.toWorkNoteGroup(row));
  }

  async create(data: { name: string }): Promise<WorkNoteGroup> {
    const now = new Date().toISOString();
    const groupId = `GRP-${nanoid(10)}`;

    try {
      await this.db.execute(
        `INSERT INTO work_note_groups (group_id, name, is_active, created_at)
         VALUES (?, ?, 1, ?)`,
        [groupId, data.name, now]
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError(`Work note group already exists: ${data.name}`);
      }
      throw error;
    }

    return {
      groupId,
      name: data.name,
      isActive: true,
      createdAt: now,
    };
  }

  async update(
    groupId: string,
    data: { name?: string; isActive?: boolean }
  ): Promise<WorkNoteGroup> {
    const existing = await this.findById(groupId);
    if (!existing) {
      throw new NotFoundError('WorkNoteGroup', groupId);
    }

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }

    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(data.isActive ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(groupId);
      try {
        await this.db.execute(
          `UPDATE work_note_groups SET ${updates.join(', ')} WHERE group_id = ?`,
          params
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
          throw new ConflictError(`Work note group already exists: ${data.name}`);
        }
        throw error;
      }
    }

    return {
      ...existing,
      name: data.name ?? existing.name,
      isActive: data.isActive ?? existing.isActive,
    };
  }

  async toggleActive(groupId: string): Promise<WorkNoteGroup> {
    const existing = await this.findById(groupId);
    if (!existing) {
      throw new NotFoundError('WorkNoteGroup', groupId);
    }

    const newIsActive = !existing.isActive;
    await this.db.execute('UPDATE work_note_groups SET is_active = ? WHERE group_id = ?', [
      newIsActive ? 1 : 0,
      groupId,
    ]);

    return { ...existing, isActive: newIsActive };
  }

  async delete(groupId: string): Promise<void> {
    const existing = await this.findById(groupId);
    if (!existing) {
      throw new NotFoundError('WorkNoteGroup', groupId);
    }

    await this.db.execute('DELETE FROM work_note_groups WHERE group_id = ?', [groupId]);
  }

  async addWorkNote(groupId: string, workId: string): Promise<void> {
    await this.db.execute(
      'INSERT INTO work_note_group_items (work_id, group_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
      [workId, groupId]
    );
  }

  async removeWorkNote(groupId: string, workId: string): Promise<void> {
    await this.db.execute('DELETE FROM work_note_group_items WHERE work_id = ? AND group_id = ?', [
      workId,
      groupId,
    ]);
  }

  async getWorkNotes(groupId: string): Promise<WorkNoteGroupWorkNote[]> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundError('WorkNoteGroup', groupId);
    }

    const result = await this.db.query<WorkNoteGroupWorkNote>(
      `SELECT wn.work_id as workId, wn.title, wn.created_at as createdAt, wn.updated_at as updatedAt
       FROM work_notes wn
       INNER JOIN work_note_group_items wngi ON wn.work_id = wngi.work_id
       WHERE wngi.group_id = ?
       ORDER BY wn.created_at DESC`,
      [groupId]
    );

    return result.rows;
  }

  async getByWorkNoteId(workId: string): Promise<WorkNoteGroup[]> {
    const result = await this.db.query<WorkNoteGroupRow>(
      `SELECT g.group_id as groupId, g.name, g.is_active as isActive, g.created_at as createdAt
       FROM work_note_groups g
       INNER JOIN work_note_group_items wngi ON g.group_id = wngi.group_id
       WHERE wngi.work_id = ?
       ORDER BY g.name ASC`,
      [workId]
    );

    return result.rows.map((row) => this.toWorkNoteGroup(row));
  }
}
