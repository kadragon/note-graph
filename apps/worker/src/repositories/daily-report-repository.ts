/**
 * Daily report repository for database operations
 */

import type { DailyReport, DailyReportAIAnalysis } from '@shared/types/daily-report';
import { nanoid } from 'nanoid';
import type { DatabaseClient } from '../types/database';

interface DailyReportRow {
  report_id: string;
  report_date: string;
  calendar_snapshot: string;
  todos_snapshot: string;
  ai_analysis: string;
  previous_report_id: string | null;
  created_at: string;
  updated_at: string;
}

export class DailyReportRepository {
  constructor(private db: DatabaseClient) {}

  generateReportId(): string {
    return `REPORT-${nanoid()}`;
  }

  private toModel(row: DailyReportRow): DailyReport {
    return {
      reportId: row.report_id,
      reportDate: row.report_date,
      calendarSnapshot: JSON.parse(row.calendar_snapshot),
      todosSnapshot: JSON.parse(row.todos_snapshot),
      aiAnalysis: JSON.parse(row.ai_analysis) as DailyReportAIAnalysis,
      previousReportId: row.previous_report_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByDate(date: string): Promise<DailyReport | null> {
    const row = await this.db.queryOne<DailyReportRow>(
      'SELECT * FROM daily_reports WHERE report_date = $1',
      [date]
    );
    return row ? this.toModel(row) : null;
  }

  async findRecent(limit: number): Promise<DailyReport[]> {
    const { rows } = await this.db.query<DailyReportRow>(
      'SELECT * FROM daily_reports ORDER BY report_date DESC LIMIT $1',
      [limit]
    );
    return rows.map((row) => this.toModel(row));
  }

  async findPreviousReport(date: string): Promise<DailyReport | null> {
    const row = await this.db.queryOne<DailyReportRow>(
      'SELECT * FROM daily_reports WHERE report_date < $1 ORDER BY report_date DESC LIMIT 1',
      [date]
    );
    return row ? this.toModel(row) : null;
  }

  async upsert(report: DailyReport): Promise<DailyReport> {
    const now = new Date().toISOString();
    const row = await this.db.queryOne<DailyReportRow>(
      `INSERT INTO daily_reports (report_id, report_date, calendar_snapshot, todos_snapshot, ai_analysis, previous_report_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT (report_date) DO UPDATE SET
         calendar_snapshot = EXCLUDED.calendar_snapshot,
         todos_snapshot = EXCLUDED.todos_snapshot,
         ai_analysis = EXCLUDED.ai_analysis,
         previous_report_id = EXCLUDED.previous_report_id,
         updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [
        report.reportId,
        report.reportDate,
        JSON.stringify(report.calendarSnapshot),
        JSON.stringify(report.todosSnapshot),
        JSON.stringify(report.aiAnalysis),
        report.previousReportId,
        now,
      ]
    );
    return this.toModel(row as DailyReportRow);
  }
}
