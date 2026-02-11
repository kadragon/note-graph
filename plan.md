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

- [ ] Create migration 0027_add_work_note_groups.sql
- [ ] Repository: findById returns group by ID
- [ ] Repository: create inserts new group
- [ ] Repository: create duplicate name returns error
- [ ] Repository: findByName returns group by name
- [ ] Repository: findAll returns all groups
- [ ] Repository: findAll with search filters by name
- [ ] Repository: findAll with activeOnly filters inactive
- [ ] Repository: update modifies group
- [ ] Repository: update duplicate name returns error
- [ ] Repository: update nonexistent returns error
- [ ] Repository: toggleActive flips is_active
- [ ] Repository: delete removes group
- [ ] Repository: delete cascades to junction
- [ ] Repository: addWorkNote creates junction record
- [ ] Repository: addWorkNote is idempotent
- [ ] Repository: removeWorkNote deletes junction record
- [ ] Repository: getWorkNotes returns work notes for group
- [ ] Repository: getByWorkNoteId returns groups for a work note
- [ ] Route integration: all endpoints return correct responses

## PR 3: Work Note Groups — Frontend (Behavioral, TDD)

- [ ] Hook: useWorkNoteGroups fetches groups list
- [ ] Hook: useCreateWorkNoteGroup creates group
- [ ] Hook: useUpdateWorkNoteGroup updates group
- [ ] Hook: useDeleteWorkNoteGroup deletes group
- [ ] Hook: error toast on mutation failure
- [ ] API client: add work note group methods
- [ ] Types: add WorkNoteGroup types to api.ts and requests.ts
- [ ] GroupSelector component: multi-checkbox selector
- [ ] Work note groups management page
- [ ] Create/edit group dialogs
- [ ] App.tsx: add route /work-note-groups
- [ ] top-menu.tsx: add nav item
- [ ] Work note create/edit forms: add GroupSelector
- [ ] Work note detail view: display group badges
