-- Performance optimization: drop 22 unused indexes (confirmed idx_scan=0 via pg_stat_user_indexes)
-- and fix search_path on 2 functions (flagged by Supabase security advisor)

-- ============================================================
-- 1. Drop unused indexes
-- ============================================================

-- persons (61 rows — seq scan is faster, optimizer never picks these)
DROP INDEX IF EXISTS idx_persons_name;
DROP INDEX IF EXISTS idx_persons_current_dept;

-- work_notes
DROP INDEX IF EXISTS idx_work_notes_category;
DROP INDEX IF EXISTS idx_work_notes_created_at;
DROP INDEX IF EXISTS idx_work_notes_title_trgm;

-- todos
DROP INDEX IF EXISTS idx_todos_status_due_created;
DROP INDEX IF EXISTS idx_todos_wait_until;

-- work_note_files (idx_work_note_files_work redundant with work_storage_live composite)
DROP INDEX IF EXISTS idx_work_note_files_work;
DROP INDEX IF EXISTS idx_work_note_files_r2_key;
DROP INDEX IF EXISTS idx_work_note_files_gdrive_file_id;
DROP INDEX IF EXISTS idx_work_note_files_work_uploaded_live;

-- embedding_retry_queue (0 rows, never used)
DROP INDEX IF EXISTS idx_retry_queue_next_retry;
DROP INDEX IF EXISTS idx_retry_queue_status;
DROP INDEX IF EXISTS idx_retry_queue_dead_letter;

-- meeting tables (very few rows, never scanned)
DROP INDEX IF EXISTS idx_meeting_minutes_meeting_date;
DROP INDEX IF EXISTS idx_meeting_minute_person_person_id;
DROP INDEX IF EXISTS idx_meeting_minute_task_category_category_id;
DROP INDEX IF EXISTS idx_meeting_minute_group_group_id;

-- other unused
DROP INDEX IF EXISTS idx_work_note_task_category_category_id;
DROP INDEX IF EXISTS idx_person_dept_history_dept_name;
DROP INDEX IF EXISTS idx_person_dept_history_person_active_date;
DROP INDEX IF EXISTS idx_pdf_jobs_status;

-- ============================================================
-- 2. Fix mutable search_path on functions (security)
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_work_note_versions_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  DELETE FROM public.work_note_versions
  WHERE work_id = NEW.work_id
    AND id NOT IN (
      SELECT id FROM public.work_note_versions
      WHERE work_id = NEW.work_id
      ORDER BY version_no DESC
      LIMIT 5
    );
  RETURN NULL;
END;
$function$;

-- ============================================================
-- 3. Move pg_trgm extension from public to extensions schema
-- ============================================================

ALTER EXTENSION pg_trgm SET SCHEMA extensions;
