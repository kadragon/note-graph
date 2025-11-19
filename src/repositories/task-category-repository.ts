// Trace: SPEC-taskcategory-1, TASK-003
/**
 * TaskCategory repository for D1 database operations
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { TaskCategory, TaskCategoryWorkNote } from '../types/task-category';
import type { CreateTaskCategoryInput, UpdateTaskCategoryInput } from '../schemas/task-category';
import { NotFoundError, ConflictError } from '../types/errors';
import { nanoid } from 'nanoid';

export class TaskCategoryRepository {
  constructor(private db: D1Database) {}

  /**
   * Find task category by ID
   */
  async findById(categoryId: string): Promise<TaskCategory | null> {
    const result = await this.db
      .prepare(
        `SELECT category_id as categoryId, name, is_active as isActive, created_at as createdAt
         FROM task_categories
         WHERE category_id = ?`
      )
      .bind(categoryId)
      .first<{ categoryId: string; name: string; isActive: number; createdAt: string }>();

    if (!result) return null;

    return {
      ...result,
      isActive: result.isActive === 1,
    };
  }

  /**
   * Find task category by name
   */
  async findByName(name: string): Promise<TaskCategory | null> {
    const result = await this.db
      .prepare(
        `SELECT category_id as categoryId, name, is_active as isActive, created_at as createdAt
         FROM task_categories
         WHERE name = ?`
      )
      .bind(name)
      .first<{ categoryId: string; name: string; isActive: number; createdAt: string }>();

    if (!result) return null;

    return {
      ...result,
      isActive: result.isActive === 1,
    };
  }

  /**
   * Find all task categories
   */
  async findAll(searchQuery?: string, limit: number = 100, activeOnly?: boolean): Promise<TaskCategory[]> {
    let sql = `SELECT category_id as categoryId, name, is_active as isActive, created_at as createdAt
               FROM task_categories`;
    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (searchQuery) {
      conditions.push(`name LIKE ?`);
      params.push(`%${searchQuery}%`);
    }

    if (activeOnly) {
      conditions.push(`is_active = 1`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY name ASC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<{
      categoryId: string;
      name: string;
      isActive: number;
      createdAt: string;
    }>();

    return (result.results || []).map(row => ({
      ...row,
      isActive: row.isActive === 1,
    }));
  }

  /**
   * Create new task category
   */
  async create(data: CreateTaskCategoryInput): Promise<TaskCategory> {
    const now = new Date().toISOString();
    const categoryId = `CAT-${nanoid(10)}`;

    try {
      await this.db
        .prepare(
          `INSERT INTO task_categories (category_id, name, is_active, created_at)
           VALUES (?, ?, 1, ?)`
        )
        .bind(categoryId, data.name, now)
        .run();

      // Return the created category without extra DB roundtrip
      return {
        categoryId,
        name: data.name,
        isActive: true,
        createdAt: now,
      };
    } catch (error) {
      // Handle unique constraint violation on name
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new ConflictError(`Task category already exists: ${data.name}`);
      }
      throw error;
    }
  }

  /**
   * Update task category
   */
  async update(categoryId: string, data: UpdateTaskCategoryInput): Promise<TaskCategory> {
    const existing = await this.findById(categoryId);
    if (!existing) {
      throw new NotFoundError('TaskCategory', categoryId);
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
      params.push(categoryId);
      try {
        await this.db
          .prepare(
            `UPDATE task_categories
             SET ${updates.join(', ')}
             WHERE category_id = ?`
          )
          .bind(...params)
          .run();
      } catch (error) {
        // Handle unique constraint violation on name
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
          throw new ConflictError(`Task category already exists: ${data.name}`);
        }
        throw error;
      }
    }

    // Return the updated category without extra DB roundtrip
    return {
      ...existing,
      name: data.name ?? existing.name,
      isActive: data.isActive ?? existing.isActive,
    };
  }

  /**
   * Delete task category
   */
  async delete(categoryId: string): Promise<void> {
    const existing = await this.findById(categoryId);
    if (!existing) {
      throw new NotFoundError('TaskCategory', categoryId);
    }

    // Delete will cascade to work_note_task_category due to ON DELETE CASCADE
    await this.db
      .prepare(`DELETE FROM task_categories WHERE category_id = ?`)
      .bind(categoryId)
      .run();
  }

  /**
   * Get task category's work notes
   */
  async getWorkNotes(categoryId: string): Promise<TaskCategoryWorkNote[]> {
    const category = await this.findById(categoryId);
    if (!category) {
      throw new NotFoundError('TaskCategory', categoryId);
    }

    const result = await this.db
      .prepare(
        `SELECT
          wn.work_id as workId,
          wn.title,
          wn.created_at as createdAt,
          wn.updated_at as updatedAt
         FROM work_notes wn
         INNER JOIN work_note_task_category wntc ON wn.work_id = wntc.work_id
         WHERE wntc.category_id = ?
         ORDER BY wn.created_at DESC`
      )
      .bind(categoryId)
      .all<TaskCategoryWorkNote>();

    return result.results || [];
  }

  /**
   * Add task category to work note
   */
  async addToWorkNote(workId: string, categoryId: string): Promise<void> {
    const category = await this.findById(categoryId);
    if (!category) {
      throw new NotFoundError('TaskCategory', categoryId);
    }

    // Insert if not already associated
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO work_note_task_category (work_id, category_id)
         VALUES (?, ?)`
      )
      .bind(workId, categoryId)
      .run();
  }

  /**
   * Remove task category from work note
   */
  async removeFromWorkNote(workId: string, categoryId: string): Promise<void> {
    await this.db
      .prepare(
        `DELETE FROM work_note_task_category
         WHERE work_id = ? AND category_id = ?`
      )
      .bind(workId, categoryId)
      .run();
  }

  /**
   * Get all categories for a work note
   */
  async getByWorkNoteId(workId: string): Promise<TaskCategory[]> {
    const result = await this.db
      .prepare(
        `SELECT
          tc.category_id as categoryId,
          tc.name,
          tc.is_active as isActive,
          tc.created_at as createdAt
         FROM task_categories tc
         INNER JOIN work_note_task_category wntc ON tc.category_id = wntc.category_id
         WHERE wntc.work_id = ?
         ORDER BY tc.name ASC`
      )
      .bind(workId)
      .all<{ categoryId: string; name: string; isActive: number; createdAt: string }>();

    return (result.results || []).map(row => ({
      ...row,
      isActive: row.isActive === 1,
    }));
  }
}
