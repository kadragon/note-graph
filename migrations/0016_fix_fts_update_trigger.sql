-- Migration: 0016_fix_fts_update_trigger
-- Purpose: Prevent FTS corruption by replacing UPDATE trigger with delete+insert pattern
-- Trace: SPEC-search-1, TASK-044

DROP TRIGGER IF EXISTS notes_fts_au;

CREATE TRIGGER IF NOT EXISTS notes_fts_au
AFTER UPDATE ON work_notes
BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content_raw, category)
  VALUES('delete', old.rowid, old.title, old.content_raw, old.category);

  INSERT INTO notes_fts(rowid, title, content_raw, category)
  VALUES(new.rowid, new.title, new.content_raw, new.category);
END;
