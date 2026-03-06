// Trace: Test coverage improvement
// Unit tests for TodoRepository filtering and views

import { env } from 'cloudflare:test';
import { D1DatabaseClient } from '@worker/adapters/d1-database-client';
import { TodoRepository } from '@worker/repositories/todo-repository';
import type { Env } from '@worker/types/env';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;
const testDb = new D1DatabaseClient(testEnv.DB);
const REAL_DATE = Date;
const BASE_NOW = new REAL_DATE('2025-01-10T12:00:00.000Z');

const useFixedDate = (baseDate: Date = BASE_NOW) => {
  class MockDate extends REAL_DATE {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(baseDate.getTime());
        return;
      }
      // @ts-expect-error allow variadic Date constructor args
      super(...args);
    }

    static now() {
      return baseDate.getTime();
    }
  }

  // @ts-expect-error override global Date for deterministic tests
  globalThis.Date = MockDate;
};

const restoreDate = () => {
  globalThis.Date = REAL_DATE;
};

beforeAll(() => {
  useFixedDate();
});

afterAll(() => {
  restoreDate();
});

describe('TodoRepository - Filtering and Views', () => {
  let repository: TodoRepository;
  let testWorkId: string;

  beforeEach(async () => {
    repository = new TodoRepository(testDb);

    // Clean up test data
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM todos'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
    ]);

    // Create a test work note
    testWorkId = 'WORK-TEST-001';
    const now = BASE_NOW.toISOString();
    await testEnv.DB.prepare(
      'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
      .bind(testWorkId, 'Test Work Note', 'Content', now, now)
      .run();
  });

  afterEach(() => {
    useFixedDate();
  });

  describe('findAll()', () => {
    const insertTodo = async ({
      todoId,
      title,
      createdAt,
      dueDate = null,
      waitUntil = null,
      status = '진행중',
      repeatRule = 'NONE',
    }: {
      todoId: string;
      title: string;
      createdAt: string;
      dueDate?: string | null;
      waitUntil?: string | null;
      status?: '진행중' | '완료' | '보류' | '중단';
      repeatRule?: 'NONE';
    }) => {
      await testEnv.DB.prepare(
        'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, wait_until, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(todoId, testWorkId, title, createdAt, dueDate, waitUntil, status, repeatRule)
        .run();
    };

    beforeEach(async () => {
      const now = new Date(BASE_NOW.getTime());
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const waitTomorrow = new Date(now);
      waitTomorrow.setDate(waitTomorrow.getDate() + 2);
      const waitNextWeek = new Date(now);
      waitNextWeek.setDate(waitNextWeek.getDate() + 8); // Beyond this week's Friday
      const overdueWaitTomorrow = new Date(now);
      overdueWaitTomorrow.setDate(overdueWaitTomorrow.getDate() - 1);

      await insertTodo({
        todoId: 'TODO-OVERDUE',
        title: 'Overdue',
        createdAt: now.toISOString(),
        dueDate: yesterday.toISOString(),
      });
      await insertTodo({
        todoId: 'TODO-TODAY',
        title: 'Today',
        createdAt: now.toISOString(),
        dueDate: now.toISOString(),
      });
      await insertTodo({
        todoId: 'TODO-TOMORROW',
        title: 'Tomorrow',
        createdAt: now.toISOString(),
        dueDate: tomorrow.toISOString(),
      });
      await insertTodo({
        todoId: 'TODO-WAIT-FUTURE',
        title: 'Waiting',
        createdAt: now.toISOString(),
        dueDate: waitNextWeek.toISOString(),
        waitUntil: waitNextWeek.toISOString(),
      });
      await insertTodo({
        todoId: 'TODO-OVERDUE-WAIT',
        title: 'Overdue Wait',
        createdAt: now.toISOString(),
        dueDate: overdueWaitTomorrow.toISOString(),
        waitUntil: waitTomorrow.toISOString(),
      });
      await insertTodo({
        todoId: 'TODO-DONE',
        title: 'Done',
        createdAt: now.toISOString(),
        status: '완료',
      });
    });

    it('should return all todos when view is "all"', async () => {
      // Act
      const result = await repository.findAll({ view: 'all' });

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(4);
    });

    it('should filter backlog (overdue) todos', async () => {
      // Act
      const result = await repository.findAll({ view: 'backlog' });

      // Assert
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((todo) => todo.todoId === 'TODO-OVERDUE')).toBe(true);
    });

    it('should not include completed todos in backlog', async () => {
      // Act
      const result = await repository.findAll({ view: 'backlog' });

      // Assert
      expect(result.some((todo) => todo.status === '완료')).toBe(false);
    });

    it('should filter by status', async () => {
      // Act
      const result = await repository.findAll({ status: '완료' });

      // Assert
      expect(result.every((todo) => todo.status === '완료')).toBe(true);
      expect(result.some((todo) => todo.todoId === 'TODO-DONE')).toBe(true);
    });

    it('should include work note title in results', async () => {
      // Act
      const result = await repository.findAll({ view: 'all' });

      // Assert
      const todoWithWork = result.find((todo) => todo.workId === testWorkId);
      expect(todoWithWork?.workTitle).toBe('Test Work Note');
    });

    it('should order by due date ASC, then created_at DESC', async () => {
      // Act
      const result = await repository.findAll({ view: 'all' });

      // Assert
      expect(result.length).toBeGreaterThan(0);

      // Verify due dates are in ASC order (nulls last)
      const withDueDate = result.filter((t) => t.dueDate !== null);
      const withoutDueDate = result.filter((t) => t.dueDate === null);

      // Check that todos with due dates come before those without
      if (withDueDate.length > 0 && withoutDueDate.length > 0) {
        const lastWithDueIndex = result.findIndex((t) => t.dueDate === null);
        if (lastWithDueIndex > 0) {
          expect(result[lastWithDueIndex - 1].dueDate).not.toBeNull();
        }
      }

      // Verify due dates are sorted in ascending order
      for (let i = 1; i < withDueDate.length; i++) {
        const prevDate = new Date(withDueDate[i - 1].dueDate as string).getTime();
        const currDate = new Date(withDueDate[i].dueDate as string).getTime();
        expect(prevDate).toBeLessThanOrEqual(currDate);
      }

      // Verify created_at is sorted in descending order for todos without due dates
      for (let i = 1; i < withoutDueDate.length; i++) {
        const prevCreated = new Date(withoutDueDate[i - 1].createdAt).getTime();
        const currCreated = new Date(withoutDueDate[i].createdAt).getTime();
        expect(prevCreated).toBeGreaterThanOrEqual(currCreated);
      }
    });

    it('should exclude future wait_until todos from remaining view', async () => {
      // Act
      const result = await repository.findAll({ view: 'remaining' });

      // Assert
      expect(result.some((todo) => todo.todoId === 'TODO-WAIT-FUTURE')).toBe(false);
      expect(result.some((todo) => todo.todoId === 'TODO-TOMORROW')).toBe(true);
    });

    it('should exclude future wait_until todos from week view', async () => {
      const result = await repository.findAll({ view: 'week' });

      expect(result.some((todo) => todo.todoId === 'TODO-WAIT-FUTURE')).toBe(false);
    });

    it('should exclude future wait_until overdue todos from backlog', async () => {
      const result = await repository.findAll({ view: 'backlog' });

      expect(result.some((todo) => todo.todoId === 'TODO-OVERDUE-WAIT')).toBe(false);
    });

    it('should include todo with wait_until later today', async () => {
      // Arrange
      const now = new Date(BASE_NOW.getTime());
      const nearFuture = new Date(now.getTime() + 3600000); // 1 hour later

      await insertTodo({
        todoId: 'TODO-NEAR-FUTURE',
        title: 'Near Future',
        createdAt: now.toISOString(),
        dueDate: nearFuture.toISOString(),
        waitUntil: nearFuture.toISOString(),
      });

      // Act
      const result = await repository.findAll({ view: 'today' });

      // Assert
      expect(result.some((t) => t.todoId === 'TODO-NEAR-FUTURE')).toBe(true);
    });

    it('should exclude todo from today view when due date is after today even if wait_until is today', async () => {
      const now = new Date(BASE_NOW.getTime());
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);

      await insertTodo({
        todoId: 'TODO-TODAY-WAIT-FUTURE-DUE',
        title: 'Today Wait Future Due',
        createdAt: now.toISOString(),
        dueDate: nextWeek.toISOString(),
        waitUntil: now.toISOString(),
      });

      const result = await repository.findAll({ view: 'today' });

      expect(result.some((t) => t.todoId === 'TODO-TODAY-WAIT-FUTURE-DUE')).toBe(false);
    });

    it('should include todo in remaining view when wait_until is today and due date is in the future', async () => {
      const now = new Date(BASE_NOW.getTime());
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);

      await insertTodo({
        todoId: 'TODO-REMAINING-WAIT-TODAY',
        title: 'Remaining Wait Today',
        createdAt: now.toISOString(),
        dueDate: nextWeek.toISOString(),
        waitUntil: now.toISOString(),
      });

      const result = await repository.findAll({ view: 'remaining' });

      expect(result.some((t) => t.todoId === 'TODO-REMAINING-WAIT-TODAY')).toBe(true);
    });

    it('should exclude todo from week view when due date is after this week even if wait_until is today', async () => {
      const now = new Date(BASE_NOW.getTime());
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);

      await insertTodo({
        todoId: 'TODO-WEEK-WAIT-TODAY',
        title: 'Week Wait Today',
        createdAt: now.toISOString(),
        dueDate: nextWeek.toISOString(),
        waitUntil: now.toISOString(),
      });

      const result = await repository.findAll({ view: 'week' });

      expect(result.some((t) => t.todoId === 'TODO-WEEK-WAIT-TODAY')).toBe(false);
    });

    it('should exclude todo from month view when due date is next month even if wait_until is today', async () => {
      const now = new Date(BASE_NOW.getTime());
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await insertTodo({
        todoId: 'TODO-MONTH-WAIT-TODAY',
        title: 'Month Wait Today',
        createdAt: now.toISOString(),
        dueDate: nextMonth.toISOString(),
        waitUntil: now.toISOString(),
      });

      const result = await repository.findAll({ view: 'month' });

      expect(result.some((t) => t.todoId === 'TODO-MONTH-WAIT-TODAY')).toBe(false);
    });

    it('should include wait_until date when KST date has advanced ahead of UTC', async () => {
      const earlyKstNow = new REAL_DATE('2025-01-09T23:00:00.000Z'); // 2025-01-10 08:00 KST
      useFixedDate(earlyKstNow);

      await insertTodo({
        todoId: 'TODO-WAIT-TODAY',
        title: 'Wait Today',
        createdAt: earlyKstNow.toISOString(),
        dueDate: '2025-01-10T00:00:00.000Z',
        waitUntil: '2025-01-10T00:00:00.000Z',
      });

      const result = await repository.findAll({ view: 'remaining' });

      expect(result.some((t) => t.todoId === 'TODO-WAIT-TODAY')).toBe(true);
    });

    it('should exclude wait_until-only todo from today view', async () => {
      const now = new Date(BASE_NOW.getTime());

      await insertTodo({
        todoId: 'TODO-WAIT-ONLY-TODAY',
        title: 'Wait Only Today',
        createdAt: now.toISOString(),
        waitUntil: now.toISOString(),
      });

      const result = await repository.findAll({ view: 'today' });

      expect(result.some((t) => t.todoId === 'TODO-WAIT-ONLY-TODAY')).toBe(false);
    });

    it('should exclude wait_until-only todo from week and month views', async () => {
      const now = new Date(BASE_NOW.getTime());

      await insertTodo({
        todoId: 'TODO-WAIT-ONLY-PERIOD',
        title: 'Wait Only Period',
        createdAt: now.toISOString(),
        waitUntil: now.toISOString(),
      });

      const weekResult = await repository.findAll({ view: 'week' });
      const monthResult = await repository.findAll({ view: 'month' });

      expect(weekResult.some((t) => t.todoId === 'TODO-WAIT-ONLY-PERIOD')).toBe(false);
      expect(monthResult.some((t) => t.todoId === 'TODO-WAIT-ONLY-PERIOD')).toBe(false);
    });

    it('should include wait_until-only todo in remaining view once wait_until is today', async () => {
      const now = new Date(BASE_NOW.getTime());

      await insertTodo({
        todoId: 'TODO-WAIT-ONLY-REMAINING',
        title: 'Wait Only Remaining',
        createdAt: now.toISOString(),
        waitUntil: now.toISOString(),
      });

      const result = await repository.findAll({ view: 'remaining' });

      expect(result.some((t) => t.todoId === 'TODO-WAIT-ONLY-REMAINING')).toBe(true);
    });

    it('should exclude 보류 and 중단 status todos from today view', async () => {
      // Arrange
      const now = new Date(BASE_NOW.getTime());

      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          'TODO-HOLD',
          testWorkId,
          'On Hold',
          now.toISOString(),
          now.toISOString(),
          '보류',
          'NONE'
        ),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          'TODO-STOPPED',
          testWorkId,
          'Stopped',
          now.toISOString(),
          now.toISOString(),
          '중단',
          'NONE'
        ),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          'TODO-ACTIVE',
          testWorkId,
          'Active',
          now.toISOString(),
          now.toISOString(),
          '진행중',
          'NONE'
        ),
      ]);

      // Act
      const result = await repository.findAll({ view: 'today' });

      // Assert
      expect(result.some((t) => t.todoId === 'TODO-HOLD')).toBe(false);
      expect(result.some((t) => t.todoId === 'TODO-STOPPED')).toBe(false);
      expect(result.some((t) => t.todoId === 'TODO-ACTIVE')).toBe(true);
    });

    it('should exclude 보류 and 중단 status todos from remaining view', async () => {
      // Arrange
      const now = new Date(BASE_NOW.getTime());

      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('TODO-REMAIN-HOLD', testWorkId, 'On Hold', now.toISOString(), '보류', 'NONE'),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('TODO-REMAIN-STOPPED', testWorkId, 'Stopped', now.toISOString(), '중단', 'NONE'),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('TODO-REMAIN-ACTIVE', testWorkId, 'Active', now.toISOString(), '진행중', 'NONE'),
      ]);

      // Act
      const result = await repository.findAll({ view: 'remaining' });

      // Assert
      expect(result.some((t) => t.todoId === 'TODO-REMAIN-HOLD')).toBe(false);
      expect(result.some((t) => t.todoId === 'TODO-REMAIN-STOPPED')).toBe(false);
      expect(result.some((t) => t.todoId === 'TODO-REMAIN-ACTIVE')).toBe(true);
    });

    it('should include 보류 and 중단 status todos in all view', async () => {
      // Arrange
      const now = new Date(BASE_NOW.getTime());

      await testEnv.DB.batch([
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('TODO-ALL-HOLD', testWorkId, 'On Hold', now.toISOString(), '보류', 'NONE'),
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('TODO-ALL-STOPPED', testWorkId, 'Stopped', now.toISOString(), '중단', 'NONE'),
      ]);

      // Act
      const result = await repository.findAll({ view: 'all' });

      // Assert
      expect(result.some((t) => t.todoId === 'TODO-ALL-HOLD')).toBe(true);
      expect(result.some((t) => t.todoId === 'TODO-ALL-STOPPED')).toBe(true);
    });
  });
});
