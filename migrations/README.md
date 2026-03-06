# Database Migrations

This directory contains the historical migration archive for the work note management system.

The active PostgreSQL schema lives under `supabase/migrations/`.

## Migration Files

- `0001_initial_schema.sql` - Initial schema with all core tables, full-text search, triggers, and indexes
- `0002_add_task_categories.sql` → `0013_drop_embedding_retry_queue.sql` - Iterative enhancements (task categories, embedding retry queue lifecycle, phone/ employment fields, custom repeat settings, embedded_at)
- `0014_add_project_management.sql` - Adds project management tables (projects, participants, work note links, files) and `project_id` column on `work_notes` with supporting indexes (Trace: SPEC-project-1, TASK-035)
- `0018_cleanup_soft_deleted_project_work_note_links.sql` - Cleans up stale `project_work_notes` rows and clears `work_notes.project_id` when linked to soft-deleted projects (Trace: SPEC-project-1, TASK-065)
- `0022_remove_unused_project_fields.sql` - Removes unused `projects` columns (`priority`, `target_end_date`, `leader_person_id`) and rebuilds related indexes (Trace: TASK-066)

## Schema Overview

### Core Tables

1. **persons** - Person/colleague management
2. **departments** - Department information
3. **person_dept_history** - Department assignment history with `is_active` tracking
4. **work_notes** - Work note entries
5. **work_note_person** - Many-to-many relationship between work notes and persons
6. **work_note_relation** - Self-referencing relationship for related work notes
7. **work_note_versions** - Version history (max 5 versions per work note)
8. **todos** - Task management with recurrence support
9. **pdf_jobs** - PDF processing job tracking

### Project Management Tables (SPEC-project-1)

10. **projects** - Project entity with status, start/actual dates, department, soft delete
11. **project_participants** - Project team members with roles
12. **project_work_notes** - 1:N association enforcing single-project membership per work note
13. **project_files** - R2 file attachments with soft delete and embedding timestamps

### Full-Text Search

- PostgreSQL `tsvector` generated columns on `work_notes` and `meeting_minutes` for lexical search
- Automatic synchronization via generated columns (always in sync)

### Indexes

Optimized indexes for:
- Foreign key relationships
- Frequently filtered columns (status, category, dept_name)
- Date range queries (created_at, updated_at, due_date)
- Composite indexes for common query patterns

## Running Migrations

### Historical Reference

```bash
# Create a new PostgreSQL migration
bun run db:create-migration add_feature_name

# Reset/apply the local PostgreSQL schema
bun run db:migrate:local

# Push the current schema to the configured PostgreSQL database
bun run db:migrate
```

## Naming Convention

Migration files follow the pattern: `NNNN_description.sql`

- `NNNN` - Sequential number with leading zeros (e.g., 0001, 0002)
- `description` - Brief description in snake_case

## Migration Workflow

1. Create new migration file with next sequential number
2. Write SQL DDL statements (CREATE, ALTER, DROP)
3. Test locally with the PostgreSQL/PGlite workflow
4. Document changes in this README
5. Apply to production after verification

## Important Notes

- **FTS Tokenizer**: Uses `trigram` tokenizer for better Korean text matching
- **Cascade Deletes**: Foreign keys use `ON DELETE CASCADE` where appropriate
- **Timestamps**: Use PostgreSQL timestamp/date types in the active schema
- **Check Constraints**: Enforce valid values for status, role, repeat_rule, etc.
- **Unique Constraints**: Prevent duplicate relationships and version numbers

## Schema Traceability

All schema elements are traced to:
- **TASK-002** - Database schema and migrations
- **Spec IDs**: SPEC-worknote-1, SPEC-person-1, SPEC-dept-1, SPEC-todo-1, SPEC-pdf-1
