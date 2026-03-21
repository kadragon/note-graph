import type { DailyReport } from '@shared/types/daily-report';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBufferedSSE } from '../helpers/buffered-sse';
import { mockDatabaseFactory } from '../helpers/test-app';

vi.mock('@worker/adapters/database-factory', () => mockDatabaseFactory());

import worker from '@worker/index';
import { pgCleanupAll } from '../helpers/pg-test-utils';
import { createAuthFetch } from '../helpers/test-app';
import { pglite } from '../pg-setup';

const authFetch = createAuthFetch(worker);

describe('Daily Report API Routes', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await pgCleanupAll(pglite);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores the same today-view todos that the dashboard contract would show', async () => {
    await pglite.query(
      'INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
      ['WORK-1', 'Test Work', 'Content', '2025-01-10T09:00:00.000Z', '2025-01-10T09:00:00.000Z']
    );
    await pglite.query(
      'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, status, repeat_rule) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        'TODO-OVERDUE',
        'WORK-1',
        'Overdue Task',
        '2025-01-10T09:00:00.000Z',
        '2025-01-09T12:00:00.000Z',
        '진행중',
        'NONE',
      ]
    );
    await pglite.query(
      'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, status, repeat_rule) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        'TODO-TODAY',
        'WORK-1',
        'Today Task',
        '2025-01-10T09:00:00.000Z',
        '2025-01-10T12:00:00.000Z',
        '진행중',
        'NONE',
      ]
    );
    await pglite.query(
      'INSERT INTO todos (todo_id, work_id, title, created_at, due_date, status, repeat_rule) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        'TODO-TOMORROW',
        'WORK-1',
        'Tomorrow Task',
        '2025-01-10T09:00:00.000Z',
        '2025-01-11T12:00:00.000Z',
        '진행중',
        'NONE',
      ]
    );

    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (url.includes('chat/completions')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      scheduleSummary: '요약',
                      todoPriorities: [
                        {
                          todoTitle: 'Today Task',
                          reason: '중요',
                          suggestedOrder: 1,
                        },
                      ],
                      timeAllocation: [],
                      conflicts: [],
                      progressVsPrevious: '',
                      actionItems: ['Today Task 처리'],
                    }),
                  },
                },
              ],
            }),
            { status: 200 }
          )
        );
      }
      return originalFetch(input, init);
    });

    const response = await authFetch('/api/daily-reports/generate', {
      method: 'POST',
      body: JSON.stringify({ date: '2025-01-10', timezoneOffset: 540 }),
    });

    expect(response.status).toBe(200);
    const data = await parseBufferedSSE<DailyReport>(response);
    expect(data.todosSnapshot.today.map((todo) => todo.id)).toEqual(['TODO-OVERDUE', 'TODO-TODAY']);
    expect(data.todosSnapshot.backlog.map((todo) => todo.id)).toEqual(['TODO-OVERDUE']);
    // 2025-01-10 is a Friday; with the fix, upcoming now includes the next week's todos
    expect(data.todosSnapshot.upcoming.map((todo) => todo.id)).toEqual(['TODO-TOMORROW']);
  });
});
