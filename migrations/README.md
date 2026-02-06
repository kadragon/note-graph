# Database Migrations

This directory contains D1 database migrations for the work note management system.

## Migration Files

- `0001_initial_schema.sql` - Initial schema with all core tables, FTS5, triggers, and indexes
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

- **notes_fts** - FTS5 virtual table with trigram tokenizer for Korean partial matching
- Automatic synchronization via triggers on INSERT/UPDATE/DELETE

### Indexes

Optimized indexes for:
- Foreign key relationships
- Frequently filtered columns (status, category, dept_name)
- Date range queries (created_at, updated_at, due_date)
- Composite indexes for common query patterns

## Running Migrations

### Local Development

```bash
# Create local D1 database
wrangler d1 create worknote-db

# Run migrations on local database
wrangler d1 execute worknote-db --local --file=migrations/0001_initial_schema.sql

# Verify schema
wrangler d1 execute worknote-db --local --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### Production

```bash
# Run migrations on production database
wrangler d1 execute worknote-db --file=migrations/0001_initial_schema.sql
```

## Naming Convention

Migration files follow the pattern: `NNNN_description.sql`

- `NNNN` - Sequential number with leading zeros (e.g., 0001, 0002)
- `description` - Brief description in snake_case

## Migration Workflow

1. Create new migration file with next sequential number
2. Write SQL DDL statements (CREATE, ALTER, DROP)
3. Test locally with `wrangler d1 execute --local`
4. Document changes in this README
5. Apply to production after verification

## Important Notes

- **FTS Tokenizer**: Uses `trigram` tokenizer for better Korean text matching
- **Cascade Deletes**: Foreign keys use `ON DELETE CASCADE` where appropriate
- **Timestamps**: Use TEXT type with ISO 8601 format (SQLite convention)
- **Check Constraints**: Enforce valid values for status, role, repeat_rule, etc.
- **Unique Constraints**: Prevent duplicate relationships and version numbers

## Schema Traceability

All schema elements are traced to:
- **TASK-002** - D1 database schema and migrations
- **Spec IDs**: SPEC-worknote-1, SPEC-person-1, SPEC-dept-1, SPEC-todo-1, SPEC-pdf-1
