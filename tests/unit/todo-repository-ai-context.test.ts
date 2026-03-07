import { TodoRepository } from '@worker/repositories/todo-repository';
import { beforeEach, describe, expect, it } from 'vitest';
import { pgCleanupAll } from '../helpers/pg-test-utils';
import { pglite, testPgDb } from '../pg-setup';

describe('TodoRepository.getOpenTodoDueDateContextForAI', () => {
  let repository: TodoRepository;
  const workId = 'WORK-AI-CONTEXT-001';

  beforeEach(async () => {
    repository = new TodoRepository(testPgDb);
    await pgCleanupAll(pglite);

    const now = new Date().toISOString();
    await pglite.query(
      `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [workId, 'AI Context Test Note', 'content', now, now]
    );
  });

  it('aggregates open todo counts and due date distribution with normalized date buckets', async () => {
    const now = new Date().toISOString();

    await pglite.query(
      `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['TODO-AI-1', workId, 'A', now, '진행중', 'NONE', '2026-03-01T09:00:00.000Z']
    );
    await pglite.query(
      `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['TODO-AI-2', workId, 'B', now, '보류', 'NONE', '2026-03-01']
    );
    await pglite.query(
      `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['TODO-AI-3', workId, 'C', now, '중단', 'NONE', '2026-02-28T23:00:00+09:00']
    );
    await pglite.query(
      `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['TODO-AI-4', workId, 'D', now, '진행중', 'NONE', '2026-02-28']
    );
    await pglite.query(
      `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['TODO-AI-5', workId, 'E', now, '완료', 'NONE', '2026-03-01']
    );
    await pglite.query(
      `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['TODO-AI-6', workId, 'F', now, '진행중', 'NONE', null]
    );
    const result = await repository.getOpenTodoDueDateContextForAI(10);

    expect(result.totalOpenTodos).toBe(5);
    expect(result.undatedOpenTodos).toBe(1);
    expect(result.topDueDateCounts).toEqual([
      { dueDate: '2026-02-28', count: 2 },
      { dueDate: '2026-03-01', count: 2 },
    ]);
  });

  it('returns empty distribution when there are no open todos and applies limit', async () => {
    const now = new Date().toISOString();
    await pglite.query(
      `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['TODO-AI-DONE', workId, 'Done only', now, '완료', 'NONE', '2026-01-01']
    );

    const empty = await repository.getOpenTodoDueDateContextForAI(1);
    expect(empty.totalOpenTodos).toBe(0);
    expect(empty.undatedOpenTodos).toBe(0);
    expect(empty.topDueDateCounts).toEqual([]);

    await pglite.query(
      `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['TODO-AI-L1', workId, 'L1', now, '진행중', 'NONE', '2026-05-01']
    );
    await pglite.query(
      `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['TODO-AI-L2', workId, 'L2', now, '진행중', 'NONE', '2026-05-01']
    );
    await pglite.query(
      `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['TODO-AI-L3', workId, 'L3', now, '진행중', 'NONE', '2026-05-02']
    );

    const limited = await repository.getOpenTodoDueDateContextForAI(1);
    expect(limited.topDueDateCounts).toEqual([{ dueDate: '2026-05-01', count: 2 }]);
  });

  it('normalizes timezone-aware due dates using date() buckets', async () => {
    const now = new Date().toISOString();

    // PostgreSQL DATE stores the date part directly without UTC conversion,
    // so '2026-02-28T15:30:00Z' becomes 2026-02-28 and
    // '2026-02-28T23:30:00Z' also becomes 2026-02-28
    await pglite.query(
      `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['TODO-AI-TZ-1', workId, 'TZ1', now, '진행중', 'NONE', '2026-02-28T23:30:00Z']
    );
    await pglite.query(
      `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['TODO-AI-TZ-2', workId, 'TZ2', now, '진행중', 'NONE', '2026-02-28T15:30:00Z']
    );

    const result = await repository.getOpenTodoDueDateContextForAI(10);
    expect(result.topDueDateCounts).toEqual([{ dueDate: '2026-02-28', count: 2 }]);
  });
});
