import type { D1Database } from '@cloudflare/workers-types';
import type { WorkNoteGroup, WorkNoteGroupWorkNote } from '@shared/types/work-note-group';
import { nanoid } from 'nanoid';
import { ConflictError, NotFoundError } from '../types/errors';

interface WorkNoteGroupRow {
  groupId: string;
  name: string;
  isActive: number;
  createdAt: string;
}

export class WorkNoteGroupRepository {
  constructor(private db: D1Database) {}

  private toWorkNoteGroup(row: WorkNoteGroupRow): WorkNoteGroup {
    return {
      groupId: row.groupId,
      name: row.name,
      isActive: row.isActive === 1,
      createdAt: row.createdAt,
    };
  }

  async findById(groupId: string): Promise<WorkNoteGroup | null> {
    const result = await this.db
      .prepare(
        `SELECT group_id as groupId, name, is_active as isActive, created_at as createdAt
         FROM work_note_groups
         WHERE group_id = ?`
      )
      .bind(groupId)
      .first<WorkNoteGroupRow>();

    return result ? this.toWorkNoteGroup(result) : null;
  }

  async findByName(name: string): Promise<WorkNoteGroup | null> {
    const result = await this.db
      .prepare(
        `SELECT group_id as groupId, name, is_active as isActive, created_at as createdAt
         FROM work_note_groups
         WHERE name = ?`
      )
      .bind(name)
      .first<WorkNoteGroupRow>();

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
      conditions.push('is_active = 1');
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ' ORDER BY name ASC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<WorkNoteGroupRow>();

    return (result.results || []).map((row) => this.toWorkNoteGroup(row));
  }

  async create(data: { name: string }): Promise<WorkNoteGroup> {
    const now = new Date().toISOString();
    const groupId = `GRP-${nanoid(10)}`;

    try {
      await this.db
        .prepare(
          `INSERT INTO work_note_groups (group_id, name, is_active, created_at)
           VALUES (?, ?, 1, ?)`
        )
        .bind(groupId, data.name, now)
        .run();
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
        await this.db
          .prepare(`UPDATE work_note_groups SET ${updates.join(', ')} WHERE group_id = ?`)
          .bind(...params)
          .run();
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
    await this.db
      .prepare('UPDATE work_note_groups SET is_active = ? WHERE group_id = ?')
      .bind(newIsActive ? 1 : 0, groupId)
      .run();

    return { ...existing, isActive: newIsActive };
  }

  async delete(groupId: string): Promise<void> {
    const existing = await this.findById(groupId);
    if (!existing) {
      throw new NotFoundError('WorkNoteGroup', groupId);
    }

    await this.db.prepare('DELETE FROM work_note_groups WHERE group_id = ?').bind(groupId).run();
  }

  async addWorkNote(groupId: string, workId: string): Promise<void> {
    await this.db
      .prepare('INSERT OR IGNORE INTO work_note_group_items (work_id, group_id) VALUES (?, ?)')
      .bind(workId, groupId)
      .run();
  }

  async removeWorkNote(groupId: string, workId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM work_note_group_items WHERE work_id = ? AND group_id = ?')
      .bind(workId, groupId)
      .run();
  }

  async getWorkNotes(groupId: string): Promise<WorkNoteGroupWorkNote[]> {
    const group = await this.findById(groupId);
    if (!group) {
      throw new NotFoundError('WorkNoteGroup', groupId);
    }

    const result = await this.db
      .prepare(
        `SELECT wn.work_id as workId, wn.title, wn.created_at as createdAt, wn.updated_at as updatedAt
         FROM work_notes wn
         INNER JOIN work_note_group_items wngi ON wn.work_id = wngi.work_id
         WHERE wngi.group_id = ?
         ORDER BY wn.created_at DESC`
      )
      .bind(groupId)
      .all<WorkNoteGroupWorkNote>();

    return result.results || [];
  }

  async getByWorkNoteId(workId: string): Promise<WorkNoteGroup[]> {
    const result = await this.db
      .prepare(
        `SELECT g.group_id as groupId, g.name, g.is_active as isActive, g.created_at as createdAt
         FROM work_note_groups g
         INNER JOIN work_note_group_items wngi ON g.group_id = wngi.group_id
         WHERE wngi.work_id = ?
         ORDER BY g.name ASC`
      )
      .bind(workId)
      .all<WorkNoteGroupRow>();

    return (result.results || []).map((row) => this.toWorkNoteGroup(row));
  }
}
