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
        `SELECT category_id as categoryId, name, created_at as createdAt
         FROM task_categories
         WHERE category_id = ?`
      )
      .bind(categoryId)
      .first<TaskCategory>();

    return result || null;
  }

  /**
   * Find task category by name
   */
  async findByName(name: string): Promise<TaskCategory | null> {
    const result = await this.db
      .prepare(
        `SELECT category_id as categoryId, name, created_at as createdAt
         FROM task_categories
         WHERE name = ?`
      )
      .bind(name)
      .first<TaskCategory>();

    return result || null;
  }

  /**
   * Find all task categories
   */
  async findAll(searchQuery?: string, limit: number = 100): Promise<TaskCategory[]> {
    let sql = `SELECT category_id as categoryId, name, created_at as createdAt
               FROM task_categories`;
    const params: string[] = [];

    if (searchQuery) {
      sql += ` WHERE name LIKE ?`;
      params.push(`%${searchQuery}%`);
    }

    sql += ` ORDER BY name ASC LIMIT ?`;
    params.push(String(limit));

    const stmt = this.db.prepare(sql);
    const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<TaskCategory>();

    return result.results || [];
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
          `INSERT INTO task_categories (category_id, name, created_at)
           VALUES (?, ?, ?)`
        )
        .bind(categoryId, data.name, now)
        .run();

      // Return the created category without extra DB roundtrip
      return {
        categoryId,
        name: data.name,
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

    if (data.name) {
      try {
        await this.db
          .prepare(
            `UPDATE task_categories
             SET name = ?
             WHERE category_id = ?`
          )
          .bind(data.name, categoryId)
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
      name: data.name || existing.name,
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
          tc.created_at as createdAt
         FROM task_categories tc
         INNER JOIN work_note_task_category wntc ON tc.category_id = wntc.category_id
         WHERE wntc.work_id = ?
         ORDER BY tc.name ASC`
      )
      .bind(workId)
      .all<TaskCategory>();

    return result.results || [];
  }
}
