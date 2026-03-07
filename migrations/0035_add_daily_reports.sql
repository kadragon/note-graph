-- Daily reports table for AI-generated daily analysis
CREATE TABLE IF NOT EXISTS daily_reports (
  report_id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL UNIQUE,
  calendar_snapshot TEXT NOT NULL DEFAULT '[]',
  todos_snapshot TEXT NOT NULL DEFAULT '{}',
  ai_analysis TEXT NOT NULL DEFAULT '{}',
  previous_report_id TEXT REFERENCES daily_reports(report_id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_report_date ON daily_reports(report_date);
