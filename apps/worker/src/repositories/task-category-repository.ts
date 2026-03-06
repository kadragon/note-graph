// Trace: SPEC-taskcategory-1, TASK-003
/**
 * TaskCategory repository for database operations
 */

import type { TaskCategory, TaskCategoryWorkNote } from '@shared/types/task-category';
import { nanoid } from 'nanoid';
import type { CreateTaskCategoryInput, UpdateTaskCategoryInput } from '../schemas/task-category';
import type { DatabaseClient } from '../types/database';
import { ConflictError, NotFoundError } from '../types/errors';
import { pgPlaceholders } from '../utils/db-utils';

/**
 * Database row type for task category
 */
interface TaskCategoryRow {
  categoryId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export class TaskCategoryRepository {
  constructor(private db: DatabaseClient) {}

  /**
   * Convert database row to TaskCategory entity
   */
  private toTaskCategory(row: TaskCategoryRow): TaskCategory {
    return {
      categoryId: row.categoryId,
      name: row.name,
      isActive: Boolean(row.isActive),
      createdAt: row.createdAt,
    };
  }

  /**
   * Find task category by ID
   */
  async findById(categoryId: string): Promise<TaskCategory | null> {
    const result = await this.db.queryOne<TaskCategoryRow>(
      `SELECT category_id as categoryId, name, is_active as isActive, created_at as createdAt
       FROM task_categories
       WHERE category_id = $1`,
      [categoryId]
    );

    return result ? this.toTaskCategory(result) : null;
  }

  /**
   * Find task categories by IDs in a single query
   */
  async findByIds(categoryIds: string[]): Promise<TaskCategory[]> {
    if (categoryIds.length === 0) {
      return [];
    }

    const uniqueCategoryIds = [...new Set(categoryIds)];
    const placeholders = pgPlaceholders(uniqueCategoryIds.length);

    const result = await this.db.query<TaskCategoryRow>(
      `SELECT category_id as categoryId, name, is_active as isActive, created_at as createdAt
       FROM task_categories
       WHERE category_id IN (${placeholders})`,
      uniqueCategoryIds
    );

    const categoryById = new Map(
      result.rows.map((row) => [row.categoryId, this.toTaskCategory(row)])
    );
    return uniqueCategoryIds
      .map((categoryId) => categoryById.get(categoryId))
      .filter((category): category is TaskCategory => category !== undefined);
  }

  /**
   * Find task category by name
   */
  async findByName(name: string): Promise<TaskCategory | null> {
    const result = await this.db.queryOne<TaskCategoryRow>(
      `SELECT category_id as categoryId, name, is_active as isActive, created_at as createdAt
       FROM task_categories
       WHERE name = $1`,
      [name]
    );

    return result ? this.toTaskCategory(result) : null;
  }

  /**
   * Find all task categories
   */
  async findAll(
    searchQuery?: string,
    limit: number = 100,
    activeOnly?: boolean
  ): Promise<TaskCategory[]> {
    let sql = `SELECT category_id as categoryId, name, is_active as isActive, created_at as createdAt
               FROM task_categories`;
    const params: (string | number)[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (searchQuery) {
      conditions.push(`name LIKE $${paramIndex++}`);
      params.push(`%${searchQuery}%`);
    }

    if (activeOnly) {
      conditions.push(`is_active`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY name ASC LIMIT $${paramIndex++}`;
    params.push(limit);

    const result = await this.db.query<TaskCategoryRow>(sql, params);
    return result.rows.map((row) => this.toTaskCategory(row));
  }

  /**
   * Create new task category
   */
  async create(data: CreateTaskCategoryInput): Promise<TaskCategory> {
    const now = new Date().toISOString();
    const categoryId = `CAT-${nanoid(10)}`;

    try {
      await this.db.execute(
        `INSERT INTO task_categories (category_id, name, is_active, created_at)
         VALUES ($1, $2, true, $3)`,
        [categoryId, data.name, now]
      );

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
    const params: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }

    if (data.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(data.isActive);
    }

    if (updates.length > 0) {
      params.push(categoryId);
      try {
        await this.db.execute(
          `UPDATE task_categories
           SET ${updates.join(', ')}
           WHERE category_id = $${paramIndex}`,
          params
        );
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
    await this.db.execute(`DELETE FROM task_categories WHERE category_id = $1`, [categoryId]);
  }

  /**
   * Get task category's work notes
   */
  async getWorkNotes(categoryId: string): Promise<TaskCategoryWorkNote[]> {
    const category = await this.findById(categoryId);
    if (!category) {
      throw new NotFoundError('TaskCategory', categoryId);
    }

    const result = await this.db.query<TaskCategoryWorkNote>(
      `SELECT
        wn.work_id as workId,
        wn.title,
        wn.created_at as createdAt,
        wn.updated_at as updatedAt
       FROM work_notes wn
       INNER JOIN work_note_task_category wntc ON wn.work_id = wntc.work_id
       WHERE wntc.category_id = $1
       ORDER BY wn.created_at DESC`,
      [categoryId]
    );

    return result.rows;
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
    await this.db.execute(
      `INSERT INTO work_note_task_category (work_id, category_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [workId, categoryId]
    );
  }

  /**
   * Remove task category from work note
   */
  async removeFromWorkNote(workId: string, categoryId: string): Promise<void> {
    await this.db.execute(
      `DELETE FROM work_note_task_category
       WHERE work_id = $1 AND category_id = $2`,
      [workId, categoryId]
    );
  }

  /**
   * Get all categories for a work note
   */
  async getByWorkNoteId(workId: string): Promise<TaskCategory[]> {
    const result = await this.db.query<TaskCategoryRow>(
      `SELECT
        tc.category_id as categoryId,
        tc.name,
        tc.is_active as isActive,
        tc.created_at as createdAt
       FROM task_categories tc
       INNER JOIN work_note_task_category wntc ON tc.category_id = wntc.category_id
       WHERE wntc.work_id = $1
       ORDER BY tc.name ASC`,
      [workId]
    );

    return result.rows.map((row) => this.toTaskCategory(row));
  }
}
