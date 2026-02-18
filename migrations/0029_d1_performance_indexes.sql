CREATE INDEX IF NOT EXISTS idx_todos_updated_at
ON todos(updated_at);

CREATE INDEX IF NOT EXISTS idx_todos_status_due_created
ON todos(status, due_date, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_note_files_work_uploaded_live
ON work_note_files(work_id, uploaded_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_note_files_work_storage_live
ON work_note_files(work_id, storage_type)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_note_person_work_role
ON work_note_person(work_id, role);

CREATE INDEX IF NOT EXISTS idx_meeting_minutes_sort
ON meeting_minutes(meeting_date DESC, updated_at DESC, meeting_id DESC);
