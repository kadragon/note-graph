-- Migration: add_daily_reports
-- Description: Daily reports table for AI-generated daily analysis

CREATE TABLE daily_reports (
  report_id TEXT PRIMARY KEY,
  report_date DATE NOT NULL UNIQUE,
  calendar_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  todos_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_report_id TEXT REFERENCES daily_reports(report_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_daily_reports_report_date ON daily_reports(report_date);

CREATE TRIGGER trg_daily_reports_updated_at
  BEFORE UPDATE ON daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
