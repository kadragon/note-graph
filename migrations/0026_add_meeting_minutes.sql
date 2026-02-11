-- Migration: 0026_add_meeting_minutes
-- Description: Add meeting minutes tables and work note linkage

CREATE TABLE IF NOT EXISTS meeting_minutes (
  meeting_id TEXT PRIMARY KEY,
  meeting_date TEXT NOT NULL,
  topic TEXT NOT NULL,
  details_raw TEXT NOT NULL,
  keywords_json TEXT NOT NULL DEFAULT '[]',
  keywords_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meeting_minute_person (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id TEXT NOT NULL REFERENCES meeting_minutes(meeting_id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES persons(person_id) ON DELETE CASCADE,
  UNIQUE(meeting_id, person_id)
);

CREATE TABLE IF NOT EXISTS meeting_minute_task_category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id TEXT NOT NULL REFERENCES meeting_minutes(meeting_id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES task_categories(category_id) ON DELETE CASCADE,
  UNIQUE(meeting_id, category_id)
);

CREATE TABLE IF NOT EXISTS work_note_meeting_minute (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id TEXT NOT NULL REFERENCES work_notes(work_id) ON DELETE CASCADE,
  meeting_id TEXT NOT NULL REFERENCES meeting_minutes(meeting_id) ON DELETE CASCADE,
  referenced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(work_id, meeting_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_meeting_date
  ON meeting_minutes(meeting_date);

CREATE INDEX IF NOT EXISTS idx_meeting_minute_person_meeting_id
  ON meeting_minute_person(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_minute_person_person_id
  ON meeting_minute_person(person_id);

CREATE INDEX IF NOT EXISTS idx_meeting_minute_task_category_meeting_id
  ON meeting_minute_task_category(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_minute_task_category_category_id
  ON meeting_minute_task_category(category_id);

CREATE INDEX IF NOT EXISTS idx_work_note_meeting_minute_work_id
  ON work_note_meeting_minute(work_id);

CREATE INDEX IF NOT EXISTS idx_work_note_meeting_minute_meeting_id
  ON work_note_meeting_minute(meeting_id);

CREATE VIRTUAL TABLE IF NOT EXISTS meeting_minutes_fts USING fts5(
  topic,
  details_raw,
  keywords_text,
  tokenize='unicode61 remove_diacritics 0',
  content='meeting_minutes',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS meeting_minutes_fts_ai
AFTER INSERT ON meeting_minutes
BEGIN
  INSERT INTO meeting_minutes_fts(rowid, topic, details_raw, keywords_text)
  VALUES (new.rowid, new.topic, new.details_raw, new.keywords_text);
END;

CREATE TRIGGER IF NOT EXISTS meeting_minutes_fts_au
AFTER UPDATE ON meeting_minutes
BEGIN
  INSERT INTO meeting_minutes_fts(meeting_minutes_fts, rowid, topic, details_raw, keywords_text)
  VALUES ('delete', old.rowid, old.topic, old.details_raw, old.keywords_text);

  INSERT INTO meeting_minutes_fts(rowid, topic, details_raw, keywords_text)
  VALUES (new.rowid, new.topic, new.details_raw, new.keywords_text);
END;

CREATE TRIGGER IF NOT EXISTS meeting_minutes_fts_ad
AFTER DELETE ON meeting_minutes
BEGIN
  INSERT INTO meeting_minutes_fts(meeting_minutes_fts, rowid, topic, details_raw, keywords_text)
  VALUES ('delete', old.rowid, old.topic, old.details_raw, old.keywords_text);
END;
