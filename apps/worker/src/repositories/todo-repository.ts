// Trace: SPEC-todo-1, TASK-008, TASK-033, TASK-046
/**
 * Todo repository for database operations
 */

import type {
  CustomIntervalUnit,
  RecurrenceType,
  RepeatRule,
  Todo,
  TodoWithWorkNote,
} from '@shared/types/todo';
import { addDays, addMonths, addWeeks } from 'date-fns';
import { nanoid } from 'nanoid';
import type {
  BatchPostponeTodosInput,
  CreateTodoInput,
  ListTodosQuery,
  UpdateTodoInput,
} from '../schemas/todo';
import type { DatabaseClient } from '../types/database';
import { NotFoundError } from '../types/errors';
import type { OpenTodoDueDateContextForAI, TodoDueDateCount } from '../types/todo-due-date-context';
import { queryInChunks } from '../utils/db-utils';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export class TodoRepository {
  constructor(private db: DatabaseClient) {}

  /**
   * Generate todo_id in format TODO-{nanoid}
   */
  private generateTodoId(): string {
    return `TODO-${nanoid()}`;
  }

  /**
   * Convert SQLite integer to boolean for skipWeekends field
   */
  private convertTodoFromDb<T extends { skipWeekends: boolean }>(todo: T): T {
    return {
      ...todo,
      skipWeekends: Boolean(todo.skipWeekends),
    };
  }

  /**
   * Skip weekends by moving to next Monday if the date falls on Sat/Sun
   */
  private skipWeekendsForDate(date: Date): Date {
    const result = new Date(date.getTime());
    const dayOfWeek = result.getDay();
    if (dayOfWeek === 0) {
      result.setDate(result.getDate() + 1);
    } else if (dayOfWeek === 6) {
      result.setDate(result.getDate() + 2);
    }
    return result;
  }

  private isEarlierDateValue(left: string, right: string): boolean {
    return Date.parse(left) < Date.parse(right);
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
              baseDate.setDate(baseDate.getDate() + customInterval * 7);
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

    const finalDate = skipWeekends ? this.skipWeekendsForDate(baseDate) : baseDate;
    return finalDate.toISOString();
  }

  /**
   * Find todo by ID
   */
  async findById(todoId: string): Promise<Todo | null> {
    const result = await this.db.queryOne<Todo>(
      `SELECT todo_id as todoId, work_id as workId,
              title, description, created_at as createdAt, updated_at as updatedAt,
              due_date as dueDate, wait_until as waitUntil, status,
              repeat_rule as repeatRule, recurrence_type as recurrenceType,
              custom_interval as customInterval, custom_unit as customUnit,
              skip_weekends as skipWeekends
       FROM todos
       WHERE todo_id = ?`,
      [todoId]
    );

    return result ? this.convertTodoFromDb(result) : null;
  }

  /**
   * Find todos by work note ID
   */
  async findByWorkId(workId: string): Promise<Todo[]> {
    const result = await this.db.query<Todo>(
      `SELECT todo_id as todoId, work_id as workId,
              title, description, created_at as createdAt, updated_at as updatedAt,
              due_date as dueDate, wait_until as waitUntil, status,
              repeat_rule as repeatRule, recurrence_type as recurrenceType,
              custom_interval as customInterval, custom_unit as customUnit,
              skip_weekends as skipWeekends
       FROM todos
       WHERE work_id = ?
       ORDER BY created_at DESC`,
      [workId]
    );

    return result.rows.map((todo) => this.convertTodoFromDb(todo));
  }

  private getKSTDateParts(date: Date = new Date()) {
    const kstDate = new Date(date.getTime() + KST_OFFSET_MS);
    return {
      year: kstDate.getUTCFullYear(),
      month: kstDate.getUTCMonth(),
      day: kstDate.getUTCDate(),
      dayOfWeek: kstDate.getUTCDay(),
    };
  }

  private getKSTDayStartUTC(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month, day) - KST_OFFSET_MS);
  }

  private getStartOfTodayUTC(): string {
    const { year, month, day } = this.getKSTDateParts();
    return this.getKSTDayStartUTC(year, month, day).toISOString();
  }

  private getStartOfTomorrowUTC(): string {
    const { year, month, day } = this.getKSTDateParts();
    return this.getKSTDayStartUTC(year, month, day + 1).toISOString();
  }

  private getPeriodEndExclusiveUTC(view: 'today' | 'week' | 'month'): string {
    const { year, month, day, dayOfWeek } = this.getKSTDateParts();
    switch (view) {
      case 'today': {
        return this.getKSTDayStartUTC(year, month, day + 1).toISOString();
      }
      case 'week': {
        const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
        return this.getKSTDayStartUTC(year, month, day + daysUntilFriday + 1).toISOString();
      }
      case 'month': {
        return this.getKSTDayStartUTC(year, month + 1, 1).toISOString();
      }
    }
  }

  /**
   * Find all todos with view filters
   */
  async findAll(query: ListTodosQuery): Promise<TodoWithWorkNote[]> {
    const startOfTodayUTC = this.getStartOfTodayUTC();
    const startOfTomorrowUTC = this.getStartOfTomorrowUTC();

    let sql = `
      SELECT t.todo_id as todoId, t.work_id as workId,
             t.title, t.description, t.created_at as createdAt, t.updated_at as updatedAt,
             t.due_date as dueDate, t.wait_until as waitUntil, t.status,
             t.repeat_rule as repeatRule, t.recurrence_type as recurrenceType,
             t.custom_interval as customInterval, t.custom_unit as customUnit,
             t.skip_weekends as skipWeekends,
             w.title as workTitle, w.category as workCategory
      FROM todos t
      LEFT JOIN work_notes w ON t.work_id = w.work_id
    `;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    const workIds = query.workIds ?? [];
    if (workIds.length > 0) {
      const placeholders = workIds.map(() => '?').join(', ');
      conditions.push(`t.work_id IN (${placeholders})`);
      params.push(...workIds);
    }

    switch (query.view) {
      case 'today':
      case 'week':
      case 'month': {
        const endExclusiveUTC = this.getPeriodEndExclusiveUTC(query.view);

        conditions.push(
          `t.status = ?`,
          `COALESCE(t.due_date, t.wait_until) IS NOT NULL`,
          `COALESCE(t.due_date, t.wait_until) < ?`,
          `(t.wait_until IS NULL OR t.wait_until < ?)`
        );
        params.push('진행중', endExclusiveUTC, endExclusiveUTC);
        break;
      }

      case 'backlog': {
        conditions.push(
          `t.status = ?`,
          `t.due_date IS NOT NULL`,
          `t.due_date < ?`,
          `(t.wait_until IS NULL OR t.wait_until < ?)`
        );
        params.push('진행중', startOfTodayUTC, startOfTomorrowUTC);
        break;
      }

      case 'remaining': {
        conditions.push(`t.status = ?`, `(t.wait_until IS NULL OR t.wait_until < ?)`);
        params.push('진행중', startOfTomorrowUTC);
        break;
      }

      case 'completed': {
        conditions.push(`t.status = ?`);
        params.push('완료');
        break;
      }

      case 'all': {
        break;
      }

      default:
        break;
    }

    if (query.status) {
      conditions.push(`t.status = ?`);
      params.push(query.status);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC`;

    const result = await this.db.query<TodoWithWorkNote>(sql, params);
    return result.rows.map((todo) => this.convertTodoFromDb(todo));
  }

  /**
   * Get open todo due date distribution context for AI prompt guidance.
   */
  async getOpenTodoDueDateContextForAI(limit: number = 10): Promise<OpenTodoDueDateContextForAI> {
    const normalizedLimit = Math.max(1, Math.floor(limit));
    const openStatuses = ['진행중', '보류', '중단'] as const;

    const [summaryResult, distributionResult] = await Promise.all([
      this.db.queryOne<{ totalOpenTodos: number; undatedOpenTodos: number | null }>(
        `SELECT COUNT(*) as totalOpenTodos,
                SUM(CASE WHEN due_date IS NULL THEN 1 ELSE 0 END) as undatedOpenTodos
         FROM todos
         WHERE status IN (?, ?, ?)`,
        [...openStatuses]
      ),
      this.db.query<{ dueDate: string; count: number }>(
        `SELECT date(due_date) as dueDate,
                COUNT(*) as count
         FROM todos
         WHERE status IN (?, ?, ?)
           AND date(due_date) IS NOT NULL
         GROUP BY date(due_date)
         ORDER BY count DESC, dueDate ASC
         LIMIT ?`,
        [...openStatuses, normalizedLimit]
      ),
    ]);

    const topDueDateCounts: TodoDueDateCount[] = distributionResult.rows.map((row) => ({
      dueDate: row.dueDate,
      count: Number(row.count),
    }));

    return {
      totalOpenTodos: Number(summaryResult?.totalOpenTodos || 0),
      undatedOpenTodos: Number(summaryResult?.undatedOpenTodos || 0),
      topDueDateCounts,
    };
  }

  /**
   * Create new todo for a work note
   */
  async create(workId: string, data: CreateTodoInput): Promise<Todo> {
    const now = new Date().toISOString();
    const todoId = this.generateTodoId();

    const effectiveWaitUntil = data.waitUntil || null;
    const effectiveDueDate = data.dueDate || effectiveWaitUntil || null;

    await this.db.execute(
      `INSERT INTO todos (todo_id, work_id, title, description, created_at, updated_at, due_date, wait_until, status, repeat_rule, recurrence_type, custom_interval, custom_unit, skip_weekends)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        todoId,
        workId,
        data.title,
        data.description || null,
        now,
        now,
        effectiveDueDate,
        effectiveWaitUntil,
        '진행중',
        data.repeatRule,
        data.recurrenceType || null,
        data.customInterval || null,
        data.customUnit || null,
        data.skipWeekends ? 1 : 0,
      ]
    );

    return {
      todoId,
      workId,
      title: data.title,
      description: data.description || null,
      createdAt: now,
      updatedAt: now,
      dueDate: effectiveDueDate,
      waitUntil: effectiveWaitUntil,
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
  async delete(todoId: string): Promise<string> {
    const existing = await this.findById(todoId);
    if (!existing) {
      throw new NotFoundError('Todo', todoId);
    }

    await this.db.execute(`DELETE FROM todos WHERE todo_id = ?`, [todoId]);

    return existing.workId;
  }

  /**
   * Update todo with recurrence logic
   */
  async update(todoId: string, data: UpdateTodoInput): Promise<Todo> {
    const existing = await this.findById(todoId);
    if (!existing) {
      throw new NotFoundError('Todo', todoId);
    }

    const statements: Array<{ sql: string; params?: unknown[] }> = [];
    const now = new Date();
    const nowISO = now.toISOString();

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
    const nextWaitUntil =
      data.waitUntil !== undefined ? data.waitUntil || null : existing.waitUntil;
    const nextDueDate = data.dueDate !== undefined ? data.dueDate || null : existing.dueDate;
    const shouldClampDueDateToWaitUntil =
      nextDueDate !== null &&
      nextWaitUntil !== null &&
      this.isEarlierDateValue(nextDueDate, nextWaitUntil);

    const shouldAutoFillDueDate =
      data.waitUntil !== undefined &&
      data.dueDate === undefined &&
      nextWaitUntil !== null &&
      (!existing.dueDate || this.isEarlierDateValue(existing.dueDate, nextWaitUntil));

    if (data.dueDate !== undefined) {
      updateFields.push('due_date = ?');
      updateParams.push(shouldClampDueDateToWaitUntil ? nextWaitUntil : nextDueDate);
    } else if (shouldAutoFillDueDate) {
      updateFields.push('due_date = ?');
      updateParams.push(nextWaitUntil);
    }

    if (data.waitUntil !== undefined) {
      updateFields.push('wait_until = ?');
      updateParams.push(nextWaitUntil);
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
      updateFields.push('updated_at = ?');
      updateParams.push(nowISO);
      updateParams.push(todoId);
      statements.push({
        sql: `UPDATE todos SET ${updateFields.join(', ')} WHERE todo_id = ?`,
        params: updateParams,
      });
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
        const newTodoId = this.generateTodoId();
        const nextWaitUntil = nextDueDate;

        statements.push({
          sql: `INSERT INTO todos (todo_id, work_id, title, description, created_at, updated_at, due_date, wait_until, status, repeat_rule, recurrence_type, custom_interval, custom_unit, skip_weekends)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [
            newTodoId,
            existing.workId,
            existing.title,
            existing.description,
            nowISO,
            nowISO,
            nextDueDate,
            nextWaitUntil,
            '진행중',
            existing.repeatRule,
            existing.recurrenceType,
            existing.customInterval,
            existing.customUnit,
            existing.skipWeekends ? 1 : 0,
          ],
        });
      }
    }

    if (statements.length > 0) {
      await this.db.executeBatch(statements);
    }

    const resultingDueDate =
      data.dueDate !== undefined
        ? shouldClampDueDateToWaitUntil
          ? nextWaitUntil
          : nextDueDate
        : shouldAutoFillDueDate
          ? nextWaitUntil
          : existing.dueDate;

    const resultingWaitUntil = nextWaitUntil;

    return {
      ...existing,
      title: data.title !== undefined ? data.title : existing.title,
      description: data.description !== undefined ? data.description || null : existing.description,
      status: data.status !== undefined ? data.status : existing.status,
      dueDate: resultingDueDate,
      waitUntil: resultingWaitUntil,
      repeatRule: data.repeatRule !== undefined ? data.repeatRule : existing.repeatRule,
      recurrenceType:
        data.recurrenceType !== undefined ? data.recurrenceType || null : existing.recurrenceType,
      customInterval:
        data.customInterval !== undefined ? data.customInterval || null : existing.customInterval,
      customUnit: data.customUnit !== undefined ? data.customUnit || null : existing.customUnit,
      skipWeekends: data.skipWeekends !== undefined ? data.skipWeekends : existing.skipWeekends,
      updatedAt: updateFields.length > 0 ? nowISO : existing.updatedAt,
    };
  }

  /**
   * Batch postpone due dates for multiple todos
   */
  async batchPostponeDueDates(data: BatchPostponeTodosInput): Promise<{
    workId: string;
    updatedCount: number;
    skippedCount: number;
    updatedTodoIds: string[];
  }> {
    const { todoIds, amount, unit } = data;

    const todos = await queryInChunks(this.db, todoIds, async (db, chunk, placeholders) => {
      const r = await db.query<{ todoId: string; workId: string; dueDate: string | null }>(
        `SELECT todo_id as todoId, work_id as workId, due_date as dueDate
         FROM todos
         WHERE todo_id IN (${placeholders})`,
        chunk
      );
      return r.rows;
    });

    if (todos.length === 0) {
      throw new NotFoundError('Todo', todoIds.join(', '));
    }

    // Verify all belong to the same work note
    const workIds = new Set(todos.map((t) => t.workId));
    if (workIds.size > 1) {
      throw new Error('All todos must belong to the same work note');
    }
    const firstTodo = todos[0] as (typeof todos)[number];
    const workId = firstTodo.workId;

    const nowISO = new Date().toISOString();
    const withDueDate = todos.filter((t) => t.dueDate !== null);
    const skippedCount = todos.length - withDueDate.length;

    if (withDueDate.length === 0) {
      return { workId, updatedCount: 0, skippedCount, updatedTodoIds: [] };
    }

    const addFn = unit === 'day' ? addDays : unit === 'week' ? addWeeks : addMonths;

    const statements = withDueDate.map((todo) => {
      const newDueDate = addFn(new Date(todo.dueDate as string), amount).toISOString();
      return {
        sql: `UPDATE todos SET due_date = ?, updated_at = ? WHERE todo_id = ?`,
        params: [newDueDate, nowISO, todo.todoId],
      };
    });

    await this.db.executeBatch(statements);

    return {
      workId,
      updatedCount: withDueDate.length,
      skippedCount,
      updatedTodoIds: withDueDate.map((t) => t.todoId),
    };
  }
}
