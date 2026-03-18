-- 1. Drop redundant indexes (covered by UNIQUE constraints)
DROP INDEX IF EXISTS idx_work_note_person_work_id;
DROP INDEX IF EXISTS idx_work_note_relation_work_id;
DROP INDEX IF EXISTS idx_work_note_versions_work_id;
DROP INDEX IF EXISTS idx_work_note_versions_version_no;
DROP INDEX IF EXISTS idx_work_note_task_category_work_id;
DROP INDEX IF EXISTS idx_work_note_group_items_work_id;
DROP INDEX IF EXISTS idx_work_note_meeting_minute_work_id;
DROP INDEX IF EXISTS idx_meeting_minute_person_meeting_id;
DROP INDEX IF EXISTS idx_meeting_minute_task_category_meeting_id;
DROP INDEX IF EXISTS idx_meeting_minute_group_meeting_id;

-- 2. Drop redundant indexes (UNIQUE column already indexed)
DROP INDEX IF EXISTS idx_task_categories_name;
DROP INDEX IF EXISTS idx_work_note_groups_name;
DROP INDEX IF EXISTS idx_daily_reports_report_date;

-- 3. Drop low-selectivity single-column indexes
DROP INDEX IF EXISTS idx_departments_is_active;
DROP INDEX IF EXISTS idx_person_dept_history_is_active;
DROP INDEX IF EXISTS idx_task_categories_is_active;
DROP INDEX IF EXISTS idx_work_note_groups_is_active;
DROP INDEX IF EXISTS idx_work_note_person_role;
DROP INDEX IF EXISTS idx_work_note_files_deleted_at;
DROP INDEX IF EXISTS idx_work_note_files_storage_type;

-- 4. Add missing composite indexes
CREATE INDEX idx_todos_work_status ON todos(work_id, status);

-- Replace (person_id, is_active) with covering index including sort column
DROP INDEX IF EXISTS idx_person_dept_history_person_active;
CREATE INDEX idx_person_dept_history_person_active_date
  ON person_dept_history(person_id, is_active, start_date DESC);
