// Trace: SPEC-todo-1, TASK-008
/**
 * Todo repository for D1 database operations
 */

import type { D1Database } from '@cloudflare/workers-types';
import { nanoid } from 'nanoid';
import type { Todo, TodoWithWorkNote, RepeatRule, RecurrenceType, CustomIntervalUnit } from '../types/todo';
import type { CreateTodoInput, UpdateTodoInput, ListTodosQuery } from '../schemas/todo';
import { NotFoundError } from '../types/errors';

export class TodoRepository {
  constructor(private db: D1Database) {}

  /**
   * Generate todo_id in format TODO-{nanoid}
   */
  private generateTodoId(): string {
    return `TODO-${nanoid()}`;
  }

  /**
   * Convert SQLite integer to boolean for skipWeekends field
   * Centralizes the database-to-domain object mapping
   */
  private convertTodoFromDb<T extends { skipWeekends: boolean }>(todo: T): T {
    return {
      ...todo,
      skipWeekends: Boolean(todo.skipWeekends),
    };
  }

  /**
   * Skip weekends by moving to next Monday if the date falls on Sat/Sun
   * Returns a new Date instance to avoid mutating the input
   */
  private skipWeekendsForDate(date: Date): Date {
    const result = new Date(date.getTime());
    const dayOfWeek = result.getDay();
    if (dayOfWeek === 0) {
      // Sunday -> Monday
      result.setDate(result.getDate() + 1);
    } else if (dayOfWeek === 6) {
      // Saturday -> Monday
      result.setDate(result.getDate() + 2);
    }
    return result;
  }

  /**
   * Calculate next due date based on recurrence strategy
   */
  private calculateNextDueDate(
    dueDate: string | null,
    completionDate: Date,
    repeatRule: RepeatRule,
    recurrenceType: RecurrenceType | null,
    customInterval: number | null = null,
    customUnit: CustomIntervalUnit | null = null,
    skipWeekends: boolean = false
  ): string | null {
    if (!dueDate || repeatRule === 'NONE' || !recurrenceType) {
      return null;
    }

    const baseDate = recurrenceType === 'DUE_DATE' ? new Date(dueDate) : completionDate;

    switch (repeatRule) {
      case 'DAILY':
        baseDate.setDate(baseDate.getDate() + 1);
        break;
      case 'WEEKLY':
        baseDate.setDate(baseDate.getDate() + 7);
        break;
      case 'MONTHLY':
        baseDate.setMonth(baseDate.getMonth() + 1);
        break;
      case 'CUSTOM':
        if (customInterval && customUnit) {
          switch (customUnit) {
            case 'DAY':
              baseDate.setDate(baseDate.getDate() + customInterval);
              break;
            case 'WEEK':
              baseDate.setDate(baseDate.getDate() + (customInterval * 7));
              break;
            case 'MONTH':
              baseDate.setMonth(baseDate.getMonth() + customInterval);
              break;
          }
        } else {
          return null;
        }
        break;
      default:
        return null;
    }

    // Apply skip weekends if enabled
    const finalDate = skipWeekends ? this.skipWeekendsForDate(baseDate) : baseDate;

    return finalDate.toISOString();
  }

  /**
   * Find todo by ID
   */
  async findById(todoId: string): Promise<Todo | null> {
    const result = await this.db
      .prepare(
        `SELECT todo_id as todoId, work_id as workId,
                title, description, created_at as createdAt, updated_at as updatedAt,
                due_date as dueDate, wait_until as waitUntil, status,
                repeat_rule as repeatRule, recurrence_type as recurrenceType,
                custom_interval as customInterval, custom_unit as customUnit,
                skip_weekends as skipWeekends
         FROM todos
         WHERE todo_id = ?`
      )
      .bind(todoId)
      .first<Todo>();

    return result ? this.convertTodoFromDb(result) : null;
  }

  /**
   * Find todos by work note ID
   */
  async findByWorkId(workId: string): Promise<Todo[]> {
    const result = await this.db
      .prepare(
        `SELECT todo_id as todoId, work_id as workId,
                title, description, created_at as createdAt, updated_at as updatedAt,
                due_date as dueDate, wait_until as waitUntil, status,
                repeat_rule as repeatRule, recurrence_type as recurrenceType,
                custom_interval as customInterval, custom_unit as customUnit,
                skip_weekends as skipWeekends
         FROM todos
         WHERE work_id = ?
         ORDER BY created_at DESC`
      )
      .bind(workId)
      .all<Todo>();

    return (result.results || []).map(todo => this.convertTodoFromDb(todo));
  }

  /**
   * Find all todos with view filters
   */
  async findAll(query: ListTodosQuery): Promise<TodoWithWorkNote[]> {
    const now = new Date().toISOString();
    let sql = `
      SELECT t.todo_id as todoId, t.work_id as workId,
             t.title, t.description, t.created_at as createdAt, t.updated_at as updatedAt,
             t.due_date as dueDate, t.wait_until as waitUntil, t.status,
             t.repeat_rule as repeatRule, t.recurrence_type as recurrenceType,
             t.custom_interval as customInterval, t.custom_unit as customUnit,
             t.skip_weekends as skipWeekends,
             w.title as workTitle
      FROM todos t
      LEFT JOIN work_notes w ON t.work_id = w.work_id
    `;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    // Get selected year (default to current year)
    const selectedYear = query.year || new Date().getFullYear();
    const yearStart = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);

    // Apply view filters
    switch (query.view) {
      case 'today': {
        // wait_until <= now (or null) + due_date from yearStart to today
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        // Use the earlier of todayEnd and yearEnd as the effective end date
        const effectiveEnd = new Date(Math.min(todayEnd.getTime(), yearEnd.getTime()));

        conditions.push(
          `t.status != ?`,
          `(t.wait_until IS NULL OR t.wait_until <= ?)`,
          `t.due_date IS NOT NULL`,
          `t.due_date >= ?`,
          `t.due_date <= ?`
        );
        params.push('완료', now, yearStart.toISOString(), effectiveEnd.toISOString());
        break;
      }

      case 'week': {
        // wait_until <= now (or null) + due_date from yearStart to this week Friday
        const today = new Date();
        const dayOfWeek = today.getDay();
        // Calculate days until Friday (5)
        const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 5 + 7 - dayOfWeek;
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + daysUntilFriday);
        weekEnd.setHours(23, 59, 59, 999);
        // Use the earlier of weekEnd and yearEnd as the effective end date
        const effectiveEnd = new Date(Math.min(weekEnd.getTime(), yearEnd.getTime()));

        conditions.push(
          `t.status != ?`,
          `(t.wait_until IS NULL OR t.wait_until <= ?)`,
          `t.due_date IS NOT NULL`,
          `t.due_date >= ?`,
          `t.due_date <= ?`
        );
        params.push('완료', now, yearStart.toISOString(), effectiveEnd.toISOString());
        break;
      }

      case 'month': {
        // wait_until <= now (or null) + due_date from yearStart to end of this month
        const today = new Date();
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        // Use the earlier of monthEnd and yearEnd as the effective end date
        const effectiveEnd = new Date(Math.min(monthEnd.getTime(), yearEnd.getTime()));

        conditions.push(
          `t.status != ?`,
          `(t.wait_until IS NULL OR t.wait_until <= ?)`,
          `t.due_date IS NOT NULL`,
          `t.due_date >= ?`,
          `t.due_date <= ?`
        );
        params.push('완료', now, yearStart.toISOString(), effectiveEnd.toISOString());
        break;
      }

      case 'remaining': {
        // All incomplete todos in selected year
        conditions.push(
          `t.status != ?`,
          `(t.due_date IS NULL OR (t.due_date >= ? AND t.due_date <= ?))`
        );
        params.push('완료', yearStart.toISOString(), yearEnd.toISOString());
        break;
      }

      case 'completed': {
        // All completed todos in selected year
        conditions.push(
          `t.status = ?`,
          `(t.due_date IS NULL OR (t.due_date >= ? AND t.due_date <= ?))`
        );
        params.push('완료', yearStart.toISOString(), yearEnd.toISOString());
        break;
      }

      default:
        // No date filtering for unknown view
        break;
    }

    // Filter by status if provided (overrides view-based status filter)
    if (query.status) {
      conditions.push(`t.status = ?`);
      params.push(query.status);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC`;

    const stmt = this.db.prepare(sql);
    const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<TodoWithWorkNote>();

    return (result.results || []).map(todo => this.convertTodoFromDb(todo));
  }

  /**
   * Create new todo for a work note
   */
  async create(workId: string, data: CreateTodoInput): Promise<Todo> {
    const now = new Date().toISOString();
    const todoId = this.generateTodoId();

    await this.db
      .prepare(
        `INSERT INTO todos (todo_id, work_id, title, description, created_at, updated_at, due_date, wait_until, status, repeat_rule, recurrence_type, custom_interval, custom_unit, skip_weekends)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        todoId,
        workId,
        data.title,
        data.description || null,
        now,
        now,
        data.dueDate || null,
        data.waitUntil || null,
        '진행중', // Default status
        data.repeatRule,
        data.recurrenceType || null,
        data.customInterval || null,
        data.customUnit || null,
        data.skipWeekends ? 1 : 0
      )
      .run();

    // Return the created todo without extra DB roundtrip
    return {
      todoId,
      workId,
      title: data.title,
      description: data.description || null,
      createdAt: now,
      updatedAt: now,
      dueDate: data.dueDate || null,
      waitUntil: data.waitUntil || null,
      status: '진행중',
      repeatRule: data.repeatRule,
      recurrenceType: data.recurrenceType || null,
      customInterval: data.customInterval || null,
      customUnit: data.customUnit || null,
      skipWeekends: data.skipWeekends || false,
    };
  }

  /**
   * Delete todo by ID
   */
  async delete(todoId: string): Promise<void> {
    const existing = await this.findById(todoId);
    if (!existing) {
      throw new NotFoundError('Todo', todoId);
    }

    await this.db
      .prepare(`DELETE FROM todos WHERE todo_id = ?`)
      .bind(todoId)
      .run();
  }

  /**
   * Update todo with recurrence logic
   */
  async update(todoId: string, data: UpdateTodoInput): Promise<Todo> {
    const existing = await this.findById(todoId);
    if (!existing) {
      throw new NotFoundError('Todo', todoId);
    }

    const statements = [];
    const now = new Date();
    const nowISO = now.toISOString();

    // Check if status is being changed to '완료' (completed)
    const isBeingCompleted = data.status === '완료' && existing.status !== '완료';

    // Build update fields
    const updateFields: string[] = [];
    const updateParams: (string | number | null)[] = [];

    if (data.title !== undefined) {
      updateFields.push('title = ?');
      updateParams.push(data.title);
    }
    if (data.description !== undefined) {
      updateFields.push('description = ?');
      updateParams.push(data.description || null);
    }
    if (data.status !== undefined) {
      updateFields.push('status = ?');
      updateParams.push(data.status);
    }
    if (data.dueDate !== undefined) {
      updateFields.push('due_date = ?');
      updateParams.push(data.dueDate || null);
    }
    if (data.waitUntil !== undefined) {
      updateFields.push('wait_until = ?');
      updateParams.push(data.waitUntil || null);
    }
    if (data.repeatRule !== undefined) {
      updateFields.push('repeat_rule = ?');
      updateParams.push(data.repeatRule);
    }
    if (data.recurrenceType !== undefined) {
      updateFields.push('recurrence_type = ?');
      updateParams.push(data.recurrenceType || null);
    }
    if (data.customInterval !== undefined) {
      updateFields.push('custom_interval = ?');
      updateParams.push(data.customInterval || null);
    }
    if (data.customUnit !== undefined) {
      updateFields.push('custom_unit = ?');
      updateParams.push(data.customUnit || null);
    }
    if (data.skipWeekends !== undefined) {
      updateFields.push('skip_weekends = ?');
      updateParams.push(data.skipWeekends ? 1 : 0);
    }

    if (updateFields.length > 0) {
      // Always update updated_at when any field changes
      updateFields.push('updated_at = ?');
      updateParams.push(nowISO);
      updateParams.push(todoId);
      statements.push(
        this.db
          .prepare(`UPDATE todos SET ${updateFields.join(', ')} WHERE todo_id = ?`)
          .bind(...updateParams)
      );
    }

    // Handle recurrence if todo is being completed and has repeat rule
    if (isBeingCompleted && existing.repeatRule !== 'NONE' && existing.recurrenceType) {
      const nextDueDate = this.calculateNextDueDate(
        existing.dueDate,
        now,
        existing.repeatRule,
        existing.recurrenceType,
        existing.customInterval,
        existing.customUnit,
        existing.skipWeekends
      );

      if (nextDueDate) {
        // Create new todo instance for next occurrence
        const newTodoId = this.generateTodoId();

        statements.push(
          this.db
            .prepare(
              `INSERT INTO todos (todo_id, work_id, title, description, created_at, updated_at, due_date, wait_until, status, repeat_rule, recurrence_type, custom_interval, custom_unit, skip_weekends)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              newTodoId,
              existing.workId,
              existing.title,
              existing.description,
              nowISO,
              nowISO,
              nextDueDate,
              null, // Reset wait_until for new instance
              '진행중',
              existing.repeatRule,
              existing.recurrenceType,
              existing.customInterval,
              existing.customUnit,
              existing.skipWeekends ? 1 : 0
            )
        );
      }
    }

    if (statements.length > 0) {
      await this.db.batch(statements);
    }

    // Return the updated todo without extra DB roundtrip
    return {
      ...existing,
      title: data.title !== undefined ? data.title : existing.title,
      description: data.description !== undefined ? (data.description || null) : existing.description,
      status: data.status !== undefined ? data.status : existing.status,
      dueDate: data.dueDate !== undefined ? (data.dueDate || null) : existing.dueDate,
      waitUntil: data.waitUntil !== undefined ? (data.waitUntil || null) : existing.waitUntil,
      repeatRule: data.repeatRule !== undefined ? data.repeatRule : existing.repeatRule,
      recurrenceType: data.recurrenceType !== undefined ? (data.recurrenceType || null) : existing.recurrenceType,
      customInterval: data.customInterval !== undefined ? (data.customInterval || null) : existing.customInterval,
      customUnit: data.customUnit !== undefined ? (data.customUnit || null) : existing.customUnit,
      skipWeekends: data.skipWeekends !== undefined ? data.skipWeekends : existing.skipWeekends,
      updatedAt: updateFields.length > 0 ? nowISO : existing.updatedAt,
    };
  }
}
