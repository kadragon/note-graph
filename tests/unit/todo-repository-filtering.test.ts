// Trace: Test coverage improvement
// Unit tests for TodoRepository filtering and views

import { env } from 'cloudflare:test';
import { TodoRepository } from '@worker/repositories/todo-repository';
import type { Env } from '@worker/types/env';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;
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
    repository = new TodoRepository(testEnv.DB);

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
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);

      await testEnv.DB.batch([
        // Overdue todo
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          'TODO-OVERDUE',
          testWorkId,
          'Overdue',
          now.toISOString(),
          yesterday.toISOString(),
          '진행중',
          'NONE'
        ),
        // Due today
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          'TODO-TODAY',
          testWorkId,
          'Today',
          now.toISOString(),
          now.toISOString(),
          '진행중',
          'NONE'
        ),
        // Due tomorrow
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          'TODO-TOMORROW',
          testWorkId,
          'Tomorrow',
          now.toISOString(),
          tomorrow.toISOString(),
          '진행중',
          'NONE'
        ),
        // Wait-until in future (should be hidden from remaining and week views)
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, wait_until, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          'TODO-WAIT-FUTURE',
          testWorkId,
          'Waiting',
          now.toISOString(),
          waitNextWeek.toISOString(),
          waitNextWeek.toISOString(),
          '진행중',
          'NONE'
        ),
        // Overdue but wait_until in future (should not appear in backlog)
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, wait_until, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          'TODO-OVERDUE-WAIT',
          testWorkId,
          'Overdue Wait',
          now.toISOString(),
          overdueWaitTomorrow.toISOString(),
          waitTomorrow.toISOString(),
          '진행중',
          'NONE'
        ),
        // Completed
        testEnv.DB.prepare(
          'INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind('TODO-DONE', testWorkId, 'Done', now.toISOString(), '완료', 'NONE'),
      ]);
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

      await testEnv.DB.prepare(
        'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, wait_until, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          'TODO-NEAR-FUTURE',
          testWorkId,
          'Near Future',
          now.toISOString(),
          nearFuture.toISOString(),
          nearFuture.toISOString(),
          '진행중',
          'NONE'
        )
        .run();

      // Act
      const result = await repository.findAll({ view: 'today' });

      // Assert
      expect(result.some((t) => t.todoId === 'TODO-NEAR-FUTURE')).toBe(true);
    });

    it('should include wait_until date when KST date has advanced ahead of UTC', async () => {
      const earlyKstNow = new REAL_DATE('2025-01-09T23:00:00.000Z'); // 2025-01-10 08:00 KST
      useFixedDate(earlyKstNow);

      await testEnv.DB.prepare(
        'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, wait_until, status, repeat_rule) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          'TODO-WAIT-TODAY',
          testWorkId,
          'Wait Today',
          earlyKstNow.toISOString(),
          '2025-01-10T00:00:00.000Z',
          '2025-01-10T00:00:00.000Z',
          '진행중',
          'NONE'
        )
        .run();

      const result = await repository.findAll({ view: 'remaining' });

      expect(result.some((t) => t.todoId === 'TODO-WAIT-TODAY')).toBe(true);
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
