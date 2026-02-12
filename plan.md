# Plan

## PR 1: Remove Project Feature (Structural)

- [x] Create migration 0026_remove_project_feature.sql to drop project tables and columns
- [x] Delete backend project files (repository, service, schema, routes, shared types)
- [x] Delete backend project test files
- [x] Remove project references from worker index, middleware, context types
- [x] Remove project_id from work-note-repository SQL queries and schemas
- [x] Remove project scope from RAG service and schemas
- [x] Remove project references from statistics-repository
- [x] Remove getOrCreateProjectFolder from google-drive-service
- [x] Remove project references from shared types (work-note, search)
- [x] Delete frontend project pages and components
- [x] Delete frontend project hooks and test files
- [x] Remove project references from App.tsx, top-menu, api.ts, types
- [x] Remove project references from test setup files
- [x] Clean up AGENTS.md — remove project-specific entries
- [x] Verify: bun run test passes with all project code removed
- [x] Grep verification: no remaining "project" references (except legitimate non-feature uses)

## PR 2: Work Note Groups — Backend (Behavioral, TDD)

- [x] Create migration 0027_add_work_note_groups.sql
- [x] Repository: findById returns group by ID
- [x] Repository: create inserts new group
- [x] Repository: create duplicate name returns error
- [x] Repository: findByName returns group by name
- [x] Repository: findAll returns all groups
- [x] Repository: findAll with search filters by name
- [x] Repository: findAll with activeOnly filters inactive
- [x] Repository: update modifies group
- [x] Repository: update duplicate name returns error
- [x] Repository: update nonexistent returns error
- [x] Repository: toggleActive flips is_active
- [x] Repository: delete removes group
- [x] Repository: delete cascades to junction
- [x] Repository: addWorkNote creates junction record
- [x] Repository: addWorkNote is idempotent
- [x] Repository: removeWorkNote deletes junction record
- [x] Repository: getWorkNotes returns work notes for group
- [x] Repository: getByWorkNoteId returns groups for a work note
- [x] Route integration: all endpoints return correct responses

## PR 3: Work Note Groups — Frontend (Behavioral, TDD)

- [x] Hook: useWorkNoteGroups fetches groups list
- [x] Hook: useCreateWorkNoteGroup creates group
- [x] Hook: useUpdateWorkNoteGroup updates group
- [x] Hook: useDeleteWorkNoteGroup deletes group
- [x] Hook: error toast on mutation failure
- [x] API client: add work note group methods
- [x] Types: add WorkNoteGroup types to api.ts and requests.ts
- [x] GroupSelector component: multi-checkbox selector
- [x] Work note groups management page
- [x] Create/edit group dialogs
- [x] App.tsx: add route /work-note-groups
- [x] top-menu.tsx: add nav item
- [x] Work note create/edit forms: add GroupSelector
- [x] Work note detail view: display group badges
