-- Migration: 0018_cleanup_soft_deleted_project_work_note_links
-- Description: Remove stale project-work-note links pointing to soft-deleted (or missing) projects
-- Trace: SPEC-project-1, TASK-065

-- 1) Remove associations to projects that are already soft-deleted.
DELETE FROM project_work_notes
WHERE project_id IN (
  SELECT project_id FROM projects WHERE deleted_at IS NOT NULL
);

-- 2) Remove associations to projects that no longer exist (defensive cleanup).
DELETE FROM project_work_notes
WHERE project_id NOT IN (
  SELECT project_id FROM projects
);

-- 3) Clear work_notes.project_id for soft-deleted projects.
UPDATE work_notes
SET project_id = NULL
WHERE project_id IN (
  SELECT project_id FROM projects WHERE deleted_at IS NOT NULL
);

-- 4) Clear work_notes.project_id when referenced project is missing (defensive cleanup).
UPDATE work_notes
SET project_id = NULL
WHERE project_id IS NOT NULL
  AND project_id NOT IN (
    SELECT project_id FROM projects
  );

