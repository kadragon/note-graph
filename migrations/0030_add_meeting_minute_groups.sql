CREATE TABLE IF NOT EXISTS meeting_minute_group (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id TEXT NOT NULL REFERENCES meeting_minutes(meeting_id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES work_note_groups(group_id) ON DELETE CASCADE,
  UNIQUE(meeting_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_meeting_minute_group_meeting_id ON meeting_minute_group(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_minute_group_group_id ON meeting_minute_group(group_id);
