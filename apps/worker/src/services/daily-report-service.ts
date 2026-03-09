/**
 * Daily report service for AI-generated daily analysis
 */

import type { DailyReport, DailyReportAIAnalysis } from '@shared/types/daily-report';
import { DailyReportRepository } from '../repositories/daily-report-repository';
import { TodoRepository } from '../repositories/todo-repository';
import { dailyReportAIAnalysisSchema } from '../schemas/daily-report';
import type { DatabaseClient } from '../types/database';
import type { Env } from '../types/env';
import { BadRequestError, RateLimitError } from '../types/errors';
import { getAIGatewayHeaders, getAIGatewayUrl, isReasoningModel } from '../utils/ai-gateway';
import { GoogleCalendarService } from './google-calendar-service';
import { DEFAULT_DAILY_REPORT_PROMPT, DEFAULT_WRITER_CONTEXT } from './setting-defaults';
import type { SettingService } from './setting-service';

const GPT_MAX_COMPLETION_TOKENS = 4000;
const DEFAULT_TIMEZONE_OFFSET = 9 * 60;

export class DailyReportService {
  private reportRepo: DailyReportRepository;
  private todoRepo: TodoRepository;
  private env: Env;
  private db: DatabaseClient;
  private settingService?: SettingService;

  constructor(env: Env, db: DatabaseClient, settingService?: SettingService) {
    this.env = env;
    this.db = db;
    this.settingService = settingService;
    this.reportRepo = new DailyReportRepository(db);
    this.todoRepo = new TodoRepository(db);
  }

  async generateReport(
    userEmail: string,
    date: string,
    timezoneOffset = DEFAULT_TIMEZONE_OFFSET
  ): Promise<DailyReport> {
    // 1. Fetch calendar events (graceful degradation)
    let calendarEvents: DailyReport['calendarSnapshot'] = [];
    try {
      const calendarService = new GoogleCalendarService(this.env, this.db);
      calendarEvents = await calendarService.getEvents(userEmail, date, date, timezoneOffset);
    } catch (error) {
      console.warn('[DailyReportService] Calendar fetch failed, proceeding without:', error);
    }

    // 2. Fetch todos bucketed by report date
    const todosSnapshot = await this.buildTodosSnapshot(date, timezoneOffset);

    // 3. Fetch previous report
    const previousReport = await this.reportRepo.findPreviousReport(date);

    // 4. Build AI prompt and call GPT
    const aiAnalysis = await this.callAI(calendarEvents, todosSnapshot, previousReport, date);
    this.ensureAIReferencesTodayTodos(aiAnalysis, todosSnapshot);

    // 5. Upsert to DB
    const reportId = this.reportRepo.generateReportId();
    // createdAt/updatedAt are set by the repository upsert
    const report: DailyReport = {
      reportId,
      reportDate: date,
      calendarSnapshot: calendarEvents,
      todosSnapshot,
      aiAnalysis,
      previousReportId: previousReport?.reportId ?? null,
      createdAt: '',
      updatedAt: '',
    };

    return this.reportRepo.upsert(report);
  }

  async getReport(date: string): Promise<DailyReport | null> {
    return this.reportRepo.findByDate(date);
  }

  async getRecentReports(limit: number): Promise<DailyReport[]> {
    return this.reportRepo.findRecent(limit);
  }

  /**
   * Build todo snapshot bucketed by the requested report date, not the current date.
   * - today: due on the report date
   * - upcoming: due after report date through end of that week (Friday)
   * - backlog: overdue before the report date
   * Each todo appears in exactly one bucket.
   */
  private async buildTodosSnapshot(
    date: string,
    timezoneOffset = DEFAULT_TIMEZONE_OFFSET
  ): Promise<DailyReport['todosSnapshot']> {
    const dateWindow = this.getDateWindowForDate(date, timezoneOffset);
    const todayTodos = await this.todoRepo.findTodayViewTodosForDate(date, timezoneOffset);
    const upcomingTodos = await this.todoRepo.findUpcomingTodosForDate(date, timezoneOffset);

    const toItem = (todo: Awaited<typeof todayTodos>[number]) => ({
      id: todo.todoId,
      title: todo.title,
      dueDate: todo.dueDate,
      status: todo.status,
    });

    const today = todayTodos.map(toItem);
    const backlog = todayTodos
      .filter(
        (todo) =>
          todo.dueDate !== null && Date.parse(todo.dueDate) < Date.parse(dateWindow.startOfDayUTC)
      )
      .map(toItem);
    const upcoming = upcomingTodos.map(toItem);

    return { today, upcoming, backlog };
  }

  private getModel(): string {
    return (
      this.settingService?.getConfigOrEnv('config.openai_model_chat', this.env.OPENAI_MODEL_CHAT) ??
      this.env.OPENAI_MODEL_CHAT
    );
  }

  private getWriterContext(): string {
    return (
      this.settingService?.getValue('prompt.ai_draft.writer_context', DEFAULT_WRITER_CONTEXT) ??
      DEFAULT_WRITER_CONTEXT
    );
  }

  private async callAI(
    calendarEvents: DailyReport['calendarSnapshot'],
    todosSnapshot: DailyReport['todosSnapshot'],
    previousReport: DailyReport | null,
    date: string
  ): Promise<DailyReportAIAnalysis> {
    const promptTemplate =
      this.settingService?.getValue('prompt.daily_report.generate', DEFAULT_DAILY_REPORT_PROMPT) ??
      DEFAULT_DAILY_REPORT_PROMPT;

    const calendarSection =
      calendarEvents.length > 0
        ? calendarEvents
            .map((e) => {
              const startTime = e.start.dateTime || e.start.date || '';
              const endTime = e.end.dateTime || e.end.date || '';
              return `- ${e.summary} (${startTime} ~ ${endTime})`;
            })
            .join('\n')
        : '(캘린더 연결 없음 또는 오늘 일정 없음)';

    const todayTodosSection =
      todosSnapshot.today.length > 0
        ? todosSnapshot.today
            .map((t) => `- [${t.status}] ${t.title} (기한: ${t.dueDate || '없음'})`)
            .join('\n')
        : '(오늘 탭 기준 할일 없음)';

    const upcomingTodosSection =
      todosSnapshot.upcoming.length > 0
        ? todosSnapshot.upcoming
            .map((t) => `- ${t.title} (기한: ${t.dueDate || '없음'})`)
            .join('\n')
        : '(다가오는 할일 없음)';

    const backlogTodosSection =
      todosSnapshot.backlog.length > 0
        ? todosSnapshot.backlog
            .map((t) => `- ${t.title} (오늘 탭 기준 할일 중 밀린 항목)`)
            .join('\n')
        : '(오늘 탭 기준 할일 중 밀린 항목 없음)';

    const previousAnalysisSection = previousReport
      ? `이전 리포트 (${previousReport.reportDate}):\n${JSON.stringify(previousReport.aiAnalysis, null, 2)}`
      : '(이전 리포트 없음 - 첫 리포트)';

    const prompt = promptTemplate
      .replace('{{WRITER_CONTEXT}}', this.getWriterContext())
      .replace('{{DATE}}', date)
      .replace('{{CALENDAR_EVENTS}}', calendarSection)
      .replace('{{TODAY_TODOS}}', todayTodosSection)
      .replace('{{UPCOMING_TODOS}}', upcomingTodosSection)
      .replace('{{BACKLOG_TODOS}}', backlogTodosSection)
      .replace('{{PREVIOUS_REPORT}}', previousAnalysisSection);

    const url = getAIGatewayUrl(this.env, 'chat/completions');
    const model = this.getModel();
    const requestBody = {
      model,
      messages: [{ role: 'user' as const, content: prompt }],
      max_completion_tokens: GPT_MAX_COMPLETION_TOKENS,
      response_format: { type: 'json_object' as const },
      ...(!isReasoningModel(model) && { temperature: 0.7 }),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: getAIGatewayHeaders(this.env),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new RateLimitError('AI API rate limit exceeded. Please try again later.');
      }
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json<{
      choices: Array<{ message: { content: string } }>;
    }>();
    const content = data.choices[0]?.message.content;
    if (!content) {
      throw new Error('AI 응답이 비어 있습니다. 다시 시도해 주세요.');
    }

    try {
      const parsed = JSON.parse(content);
      return dailyReportAIAnalysisSchema.parse(parsed);
    } catch (error) {
      console.error('[DailyReportService] Failed to parse AI response:', content, error);
      throw new Error('AI 응답을 파싱할 수 없습니다. 다시 시도해 주세요.');
    }
  }

  private getDateWindowForDate(date: string, timezoneOffset: number) {
    const [yearPart = '0', monthPart = '1', dayPart = '1'] = date.split('-');
    const year = Number(yearPart);
    const month = Number(monthPart);
    const day = Number(dayPart);
    const startOfDayUTC = new Date(
      Date.UTC(year, month - 1, day) - timezoneOffset * 60 * 1000
    ).toISOString();

    return {
      startOfDayUTC,
    };
  }

  private normalizeTodoReference(value: string): string {
    return value
      .normalize('NFKC')
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '');
  }

  private ensureAIReferencesTodayTodos(
    aiAnalysis: DailyReportAIAnalysis,
    todosSnapshot: DailyReport['todosSnapshot']
  ) {
    if (todosSnapshot.today.length === 0) {
      return;
    }

    const todayTitles = todosSnapshot.today
      .map((todo) => this.normalizeTodoReference(todo.title))
      .filter(Boolean);

    const priorityTitles = new Set(
      aiAnalysis.todoPriorities
        .map((item) => this.normalizeTodoReference(item.todoTitle))
        .filter(Boolean)
    );
    const normalizedActionItems = aiAnalysis.actionItems
      .map((item) => this.normalizeTodoReference(item))
      .filter(Boolean);

    const hasReference = todayTitles.some(
      (title) =>
        priorityTitles.has(title) ||
        normalizedActionItems.some((actionItem) => actionItem.includes(title))
    );

    if (!hasReference) {
      throw new BadRequestError(
        '일일 리포트 생성 결과에 오늘 탭 할일이 반영되지 않았습니다. 다시 시도해 주세요.'
      );
    }
  }
}
