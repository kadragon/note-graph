import { DailyReportRepository } from '@worker/repositories/daily-report-repository';
import { TodoRepository } from '@worker/repositories/todo-repository';
import { DailyReportService } from '@worker/services/daily-report-service';
import { GoogleCalendarService } from '@worker/services/google-calendar-service';
import type { DatabaseClient } from '@worker/types/database';
import type { Env } from '@worker/types/env';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('DailyReportService', () => {
  const env = {
    CLOUDFLARE_ACCOUNT_ID: 'test-account',
    AI_GATEWAY_ID: 'test-gateway',
    OPENAI_MODEL_CHAT: 'gpt-4.5-turbo',
    OPENAI_API_KEY: 'test-key',
  } as Env;

  const db = {} as DatabaseClient;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the report snapshot from repository today and upcoming queries before persisting', async () => {
    vi.spyOn(GoogleCalendarService.prototype, 'getEvents').mockResolvedValue([]);
    vi.spyOn(TodoRepository.prototype, 'findTodayViewTodosForDate').mockResolvedValue([
      {
        todoId: 'TODO-OVERDUE',
        workId: 'WORK-1',
        title: 'Overdue Task',
        description: null,
        createdAt: '2025-01-10T09:00:00.000Z',
        updatedAt: '2025-01-10T09:00:00.000Z',
        dueDate: '2025-01-09T12:00:00.000Z',
        waitUntil: null,
        status: '진행중',
        repeatRule: 'NONE',
        recurrenceType: null,
        customInterval: null,
        customUnit: null,
        skipWeekends: false,
      },
      {
        todoId: 'TODO-TODAY',
        workId: 'WORK-1',
        title: 'Today Task',
        description: null,
        createdAt: '2025-01-10T09:00:00.000Z',
        updatedAt: '2025-01-10T09:00:00.000Z',
        dueDate: '2025-01-10T12:00:00.000Z',
        waitUntil: null,
        status: '진행중',
        repeatRule: 'NONE',
        recurrenceType: null,
        customInterval: null,
        customUnit: null,
        skipWeekends: false,
      },
    ]);
    vi.spyOn(TodoRepository.prototype, 'findUpcomingTodosForDate').mockResolvedValue([
      {
        todoId: 'TODO-UPCOMING',
        workId: 'WORK-1',
        title: 'Upcoming Task',
        description: null,
        createdAt: '2025-01-10T09:00:00.000Z',
        updatedAt: '2025-01-10T09:00:00.000Z',
        dueDate: '2025-01-10T23:00:00.000Z',
        waitUntil: null,
        status: '진행중',
        repeatRule: 'NONE',
        recurrenceType: null,
        customInterval: null,
        customUnit: null,
        skipWeekends: false,
      },
    ]);
    vi.spyOn(DailyReportRepository.prototype, 'findPreviousReport').mockResolvedValue(null);
    vi.spyOn(DailyReportRepository.prototype, 'generateReportId').mockReturnValue('REPORT-TEST');
    const upsertSpy = vi
      .spyOn(DailyReportRepository.prototype, 'upsert')
      .mockImplementation(async (report) => report);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
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
                      reason: '오늘 마감',
                      suggestedOrder: 1,
                    },
                  ],
                  timeAllocation: [],
                  conflicts: [],
                  progressVsPrevious: '진행중',
                  actionItems: ['Today Task 마무리'],
                }),
              },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const service = new DailyReportService(env, db);
    const report = await service.generateReport('test@example.com', '2025-01-10', 540);

    expect(TodoRepository.prototype.findTodayViewTodosForDate).toHaveBeenCalledWith(
      '2025-01-10',
      540
    );
    expect(TodoRepository.prototype.findUpcomingTodosForDate).toHaveBeenCalledWith(
      '2025-01-10',
      540
    );
    expect(report.todosSnapshot.today.map((todo) => todo.id)).toEqual([
      'TODO-OVERDUE',
      'TODO-TODAY',
    ]);
    expect(report.todosSnapshot.backlog.map((todo) => todo.id)).toEqual(['TODO-OVERDUE']);
    expect(report.todosSnapshot.upcoming.map((todo) => todo.id)).toEqual(['TODO-UPCOMING']);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: 'REPORT-TEST',
        reportDate: '2025-01-10',
      })
    );
  });

  it('fails report generation when the AI output does not reference any today-view todo', async () => {
    vi.spyOn(GoogleCalendarService.prototype, 'getEvents').mockResolvedValue([]);
    vi.spyOn(TodoRepository.prototype, 'findTodayViewTodosForDate').mockResolvedValue([
      {
        todoId: 'TODO-TODAY',
        workId: 'WORK-1',
        title: 'Important Task',
        description: null,
        createdAt: '2025-01-10T09:00:00.000Z',
        updatedAt: '2025-01-10T09:00:00.000Z',
        dueDate: '2025-01-10T12:00:00.000Z',
        waitUntil: null,
        status: '진행중',
        repeatRule: 'NONE',
        recurrenceType: null,
        customInterval: null,
        customUnit: null,
        skipWeekends: false,
      },
    ]);
    vi.spyOn(TodoRepository.prototype, 'findUpcomingTodosForDate').mockResolvedValue([]);
    vi.spyOn(DailyReportRepository.prototype, 'findPreviousReport').mockResolvedValue(null);
    const upsertSpy = vi.spyOn(DailyReportRepository.prototype, 'upsert');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  scheduleSummary: '요약',
                  todoPriorities: [],
                  timeAllocation: [],
                  conflicts: [],
                  progressVsPrevious: '',
                  actionItems: ['이메일 확인'],
                }),
              },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const service = new DailyReportService(env, db);

    await expect(service.generateReport('test@example.com', '2025-01-10', 540)).rejects.toThrow(
      '다시 시도'
    );
    expect(upsertSpy).not.toHaveBeenCalled();
  });
});
