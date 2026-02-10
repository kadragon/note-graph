import { env } from 'cloudflare:test';
import { TodoRepository } from '@worker/repositories/todo-repository';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it } from 'vitest';

const testEnv = env as unknown as Env;

describe('TodoRepository.getOpenTodoDueDateContextForAI', () => {
  let repository: TodoRepository;
  const workId = 'WORK-AI-CONTEXT-001';

  beforeEach(async () => {
    repository = new TodoRepository(testEnv.DB);
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM todos'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
    ]);

    const now = new Date().toISOString();
    await testEnv.DB.prepare(
      `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(workId, 'AI Context Test Note', 'content', now, now)
      .run();
  });

  it('aggregates open todo counts and due date distribution with normalized date buckets', async () => {
    const now = new Date().toISOString();

    await testEnv.DB.batch([
      testEnv.DB.prepare(
        `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('TODO-AI-1', workId, 'A', now, '진행중', 'NONE', '2026-03-01T09:00:00.000Z'),
      testEnv.DB.prepare(
        `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('TODO-AI-2', workId, 'B', now, '보류', 'NONE', '2026-03-01'),
      testEnv.DB.prepare(
        `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('TODO-AI-3', workId, 'C', now, '중단', 'NONE', '2026-02-28T23:00:00+09:00'),
      testEnv.DB.prepare(
        `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('TODO-AI-4', workId, 'D', now, '진행중', 'NONE', '2026-02-28'),
      testEnv.DB.prepare(
        `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('TODO-AI-5', workId, 'E', now, '완료', 'NONE', '2026-03-01'),
      testEnv.DB.prepare(
        `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('TODO-AI-6', workId, 'F', now, '진행중', 'NONE', null),
      testEnv.DB.prepare(
        `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('TODO-AI-7', workId, 'G', now, '진행중', 'NONE', 'bad'),
    ]);

    const result = await repository.getOpenTodoDueDateContextForAI(10);

    expect(result.totalOpenTodos).toBe(6);
    expect(result.undatedOpenTodos).toBe(1);
    expect(result.topDueDateCounts).toEqual([
      { dueDate: '2026-02-28', count: 2 },
      { dueDate: '2026-03-01', count: 2 },
    ]);
  });

  it('returns empty distribution when there are no open todos and applies limit', async () => {
    const now = new Date().toISOString();
    await testEnv.DB.prepare(
      `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind('TODO-AI-DONE', workId, 'Done only', now, '완료', 'NONE', '2026-01-01')
      .run();

    const empty = await repository.getOpenTodoDueDateContextForAI(1);
    expect(empty.totalOpenTodos).toBe(0);
    expect(empty.undatedOpenTodos).toBe(0);
    expect(empty.topDueDateCounts).toEqual([]);

    await testEnv.DB.batch([
      testEnv.DB.prepare(
        `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('TODO-AI-L1', workId, 'L1', now, '진행중', 'NONE', '2026-05-01'),
      testEnv.DB.prepare(
        `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('TODO-AI-L2', workId, 'L2', now, '진행중', 'NONE', '2026-05-01'),
      testEnv.DB.prepare(
        `INSERT INTO todos (todo_id, work_id, title, created_at, status, repeat_rule, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind('TODO-AI-L3', workId, 'L3', now, '진행중', 'NONE', '2026-05-02'),
    ]);

    const limited = await repository.getOpenTodoDueDateContextForAI(1);
    expect(limited.topDueDateCounts).toEqual([{ dueDate: '2026-05-01', count: 2 }]);
  });
});
