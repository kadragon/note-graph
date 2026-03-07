/**
 * Daily report service for AI-generated daily analysis
 */

import type { DailyReport, DailyReportAIAnalysis } from '@shared/types/daily-report';
import { DailyReportRepository } from '../repositories/daily-report-repository';
import { dailyReportAIAnalysisSchema } from '../schemas/daily-report';
import type { DatabaseClient } from '../types/database';
import type { Env } from '../types/env';
import { RateLimitError } from '../types/errors';
import { getAIGatewayHeaders, getAIGatewayUrl, isReasoningModel } from '../utils/ai-gateway';
import { GoogleCalendarService } from './google-calendar-service';
import { DEFAULT_DAILY_REPORT_PROMPT, DEFAULT_WRITER_CONTEXT } from './setting-defaults';
import type { SettingService } from './setting-service';

const GPT_MAX_COMPLETION_TOKENS = 4000;
export class DailyReportService {
  private reportRepo: DailyReportRepository;
  private env: Env;
  private db: DatabaseClient;
  private settingService?: SettingService;

  constructor(env: Env, db: DatabaseClient, settingService?: SettingService) {
    this.env = env;
    this.db = db;
    this.settingService = settingService;
    this.reportRepo = new DailyReportRepository(db);
  }

  async generateReport(userEmail: string, date: string, timezoneOffset = 0): Promise<DailyReport> {
    // 1. Fetch calendar events (graceful degradation)
    let calendarEvents: DailyReport['calendarSnapshot'] = [];
    try {
      const calendarService = new GoogleCalendarService(this.env, this.db);
      calendarEvents = await calendarService.getEvents(userEmail, date, date, timezoneOffset);
    } catch (error) {
      console.warn('[DailyReportService] Calendar fetch failed, proceeding without:', error);
    }

    // 2. Fetch todos bucketed by report date
    const todosSnapshot = await this.buildTodosSnapshot(date);

    // 3. Fetch previous report
    const previousReport = await this.reportRepo.findPreviousReport(date);

    // 4. Build AI prompt and call GPT
    const aiAnalysis = await this.callAI(calendarEvents, todosSnapshot, previousReport, date);

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
  private async buildTodosSnapshot(date: string): Promise<DailyReport['todosSnapshot']> {
    // Parse as KST midnight — Date already converts to UTC internally
    const reportDate = new Date(`${date}T00:00:00+09:00`);
    const dayStartUTC = reportDate.toISOString();
    const dayEndUTC = new Date(reportDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const dayOfWeek = reportDate.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    const weekEndUTC = new Date(
      reportDate.getTime() + (daysUntilFriday + 1) * 24 * 60 * 60 * 1000
    ).toISOString();

    const { rows } = await this.db.query<{
      todo_id: string;
      title: string;
      due_date: string | null;
      status: string;
    }>(
      `SELECT todo_id, title, due_date, status
       FROM todos
       WHERE status = '진행중'
         AND due_date IS NOT NULL
         AND (wait_until IS NULL OR wait_until < $1::timestamptz)
       ORDER BY due_date ASC`,
      [dayEndUTC]
    );

    const toItem = (r: (typeof rows)[number]) => ({
      id: r.todo_id,
      title: r.title,
      dueDate: r.due_date,
      status: r.status,
    });

    const today: DailyReport['todosSnapshot']['today'] = [];
    const upcoming: DailyReport['todosSnapshot']['upcoming'] = [];
    const backlog: DailyReport['todosSnapshot']['backlog'] = [];

    for (const row of rows) {
      const due = row.due_date;
      if (!due) continue;
      if (due >= dayStartUTC && due < dayEndUTC) {
        today.push(toItem(row));
      } else if (due >= dayEndUTC && due < weekEndUTC) {
        upcoming.push(toItem(row));
      } else if (due < dayStartUTC) {
        backlog.push(toItem(row));
      }
    }

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
        : '(오늘 할일 없음)';

    const upcomingTodosSection =
      todosSnapshot.upcoming.length > 0
        ? todosSnapshot.upcoming
            .map((t) => `- ${t.title} (기한: ${t.dueDate || '없음'})`)
            .join('\n')
        : '(다가오는 할일 없음)';

    const backlogTodosSection =
      todosSnapshot.backlog.length > 0
        ? todosSnapshot.backlog.map((t) => `- ${t.title}`).join('\n')
        : '(백로그 없음)';

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
}
