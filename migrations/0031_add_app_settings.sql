-- App settings table for managing AI prompts and configuration
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  default_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_app_settings_category ON app_settings(category);
