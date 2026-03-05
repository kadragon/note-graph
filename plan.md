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

## PR 4: Search Enhancement — Keyword First (Behavioral, TDD)

> Reduce search latency by replacing unified work-note hybrid search with weighted lexical ranking.

- [x] Add `work-notes-fts` query/score utility for token normalization and AND/OR query composition
- [x] Add `KeywordSearchService` with BM25 candidate retrieval and title/recency weighted scoring
- [x] Route: switch `/search/work-notes` and `/search/unified` work-note path to `KeywordSearchService`
- [x] Route: return `searchType: LEXICAL` from `/search/work-notes`
- [x] Unit test: title-weighted ranking outranks content-only match
- [x] Unit test: AND-first fallback to OR when result count is insufficient
- [x] Unit test: punctuation-only query returns empty results
- [x] Unit test: category/person/dept/date filters are applied in candidate query
- [x] Integration test: unified route preserves response shape while using lexical source for work notes
- [x] API client test: lexical search result mapping remains valid
- [x] Verify: run targeted unit/integration/web API tests for search path

## Phase 0: Database Abstraction Layer (D1 → Supabase Migration)

> Extract a `DatabaseClient` interface so repositories decouple from D1, enabling gradual PostgreSQL migration.

### 0.1 DatabaseClient interface & D1 adapter

- [x] Define `DatabaseClient` and `TransactionClient` interfaces in `apps/worker/src/types/database.ts`
- [x] Implement `D1DatabaseClient` adapter in `apps/worker/src/adapters/d1-database-client.ts`

### 0.2 Convert repositories to DatabaseClient (smallest first)

- [x] Convert `SettingRepository` to use `DatabaseClient`
- [x] Convert `DepartmentRepository` to use `DatabaseClient`
- [x] Convert `TaskCategoryRepository` to use `DatabaseClient`
- [x] Convert `WorkNoteGroupRepository` to use `DatabaseClient`
- [x] Convert `GoogleOauthRepository` to use `DatabaseClient`
- [x] Convert `PdfJobRepository` to use `DatabaseClient`
- [x] Convert `EmbeddingRetryQueueRepository` to use `DatabaseClient`
- [x] Convert `PersonRepository` to use `DatabaseClient`
- [x] Convert `TodoRepository` to use `DatabaseClient`
- [x] Convert `StatisticsRepository` to use `DatabaseClient`
- [x] Convert `MeetingMinuteRepository` to use `DatabaseClient`
- [x] Convert `WorkNoteRepository` to use `DatabaseClient`

### 0.3 Update instantiation sites

- [x] Update `repositoriesMiddleware` to use `D1DatabaseClient`
- [x] Update `WorkNoteService` and `EmbeddingProcessor` constructors
- [x] Update `StatisticsService` constructor
- [x] Update `MeetingMinutes` routes
- [x] Update Google OAuth/Drive/Calendar service chain to use `DatabaseClient`
- [x] Update `BaseFileService` and `WorkNoteFileService` to use `DatabaseClient`
- [x] Update route callers (`auth-google`, `calendar`, `work-notes`, `work-note-file` middleware)
- [x] Update test files to use `D1DatabaseClient`

### 0.4 Update db-utils.ts

- [x] Update `queryInChunks` to work with `DatabaseClient`

### 0.5 Verify

- [x] All existing tests pass with no behavioral changes (701/701)

## Phase 1: PostgreSQL Schema Design (Supabase Migration)

> Create the PostgreSQL schema in Supabase that will replace D1. Schema only — no application code changes, no data migration.

- [x] `supabase init`
- [x] `supabase migration new initial_schema`
- [x] Write complete migration SQL (23 tables, 8 ENUMs, triggers, FTS, indexes)
- [x] `supabase start` + `supabase db reset` — migration applies cleanly
- [x] Verify: 23 tables, 8 ENUMs, all indexes, triggers
- [x] Verify: FTS generated column works (INSERT + query on work_notes and meeting_minutes)
- [x] Verify: `set_updated_at()` trigger fires
- [x] Verify: version limit trigger fires (7 inserts -> 5 remain)
- [x] Verify: phone_ext regex constraint (accepts digits/dashes, rejects letters)
- [x] `supabase stop`
- [x] Update `plan.md`

## Phase 2: Supabase Adapter & SQL Compatibility

> Implement `SupabaseDatabaseClient` and normalize repository SQL so the same codebase runs against both D1 and PostgreSQL.

### 2.1 SupabaseDatabaseClient adapter

- [ ] Implement `SupabaseDatabaseClient` in `apps/worker/src/adapters/supabase-database-client.ts`
- [ ] Auto-translate `?` placeholders to `$1, $2, ...` inside the adapter
- [ ] Implement real `transaction()` with BEGIN/COMMIT
- [ ] Implement `executeBatch()` wrapped in a transaction
- [ ] Unit test: placeholder translation for 0, 1, and N params
- [ ] Unit test: transaction commits on success, rolls back on error
- [ ] Unit test: executeBatch wraps statements in a single transaction

### 2.2 Normalize SQL: `datetime('now')` → parameter

- [ ] `setting-repository.ts` upsert: pass `new Date().toISOString()` as param instead of `datetime('now')`
- [ ] `setting-repository.ts` resetToDefault: same fix
- [ ] Verify: setting-repository tests still pass

### 2.3 Normalize SQL: `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`

- [ ] `setting-repository.ts` ensureDefaults
- [ ] `task-category-repository.ts` setWorkNoteCategories
- [ ] `work-note-repository.ts` create (group_items)
- [ ] `work-note-repository.ts` update (group_items)
- [ ] `work-note-group-repository.ts` addWorkNote
- [ ] `google-drive-service.ts` saveFolderRecord
- [ ] Verify: all affected tests still pass

### 2.4 Normalize SQL: `json_each(?)` → `queryInChunks`

- [ ] `work-note-repository.ts` findAll: replace 3 json_each queries with queryInChunks
- [ ] `todo-repository.ts` findAll: replace json_each with queryInChunks
- [ ] `todo-repository.ts` bulkUpdateStatus: replace json_each with queryInChunks
- [ ] `statistics-repository.ts`: replace 2 json_each queries with queryInChunks
- [ ] `rag-service.ts`: replace json_each with queryInChunks
- [ ] Verify: all affected tests still pass

### 2.5 Normalize SQL: boolean comparisons

- [ ] SQL: replace `is_active = 1` with `is_active` in WHERE clauses (4 sites)
- [ ] JS: replace `isActive === 1` with `!!isActive` or `Boolean(isActive)` (5 sites)
- [ ] Verify: all affected tests still pass

### 2.6 Update `queryInChunks` for PostgreSQL

- [ ] PostgreSQL has no 999-variable limit; keep chunking logic but it remains harmless
- [ ] Ensure placeholder generation (`?` joined) works with the adapter's translation

### 2.7 Integration test with local Supabase

- [ ] Add Supabase connection config (env vars: `SUPABASE_DB_URL` or similar)
- [ ] Write integration smoke test: create SupabaseDatabaseClient → run basic CRUD via SettingRepository
- [ ] Verify: existing D1 test suite still passes (no regressions)
