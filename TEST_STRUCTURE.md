# Test Structure Inventory

## Overview
- Scope: backend Workers tests live under `tests/`, frontend tests live under `apps/web/src/`.
- Runner split: `bun run test` targets Workers/unit/integration by default; `bun run test:web` runs frontend suites.
- Recent cleanups: large hook suites were split into query/mutations/errors files for clarity.
- 2026-01-22 snapshot: 101 test files, 23,549 total lines (raw), node_modules/coverage/dist excluded.

## Snapshot Counts (2026-01-22)
- backend/unit: 41 files, 12,003 lines
- backend/integration: 12 files, 2,787 lines
- backend/other: 1 file, 614 lines
- web/hooks: 22 files, 4,392 lines
- web/pages: 15 files, 2,054 lines
- web/components: 3 files, 295 lines
- web/lib: 6 files, 1,376 lines
- web/test-setup: 1 file, 28 lines

## Largest Suites (by lines)
- `apps/web/src/lib/api.test.ts` (789)
- `tests/unit/statistics-repository.test.ts` (686)
- `tests/unit/ai-draft-service.test.ts` (677)
- `tests/unit/person-repository.test.ts` (668)
- `tests/unit/work-note-file-service.test.ts` (661)
- `tests/search.test.ts` (614)
- `tests/unit/department-repository.test.ts` (550)
- `tests/unit/google-calendar-service.test.ts` (550)

## Backend (Workers) Tests

### Unit Tests (`tests/unit/`) (41 files)
- `tests/unit/ai-draft-service.test.ts`
- `tests/unit/auth.test.ts`
- `tests/unit/chunking.test.ts`
- `tests/unit/date-utils.test.ts`
- `tests/unit/department-repository.test.ts`
- `tests/unit/embedding-processor.batch.test.ts`
- `tests/unit/embedding-retry-queue-repository.test.ts`
- `tests/unit/embedding-service.test.ts`
- `tests/unit/fts-search-service.test.ts`
- `tests/unit/get-latest-todo-date.test.ts`
- `tests/unit/google-calendar-service.test.ts`
- `tests/unit/google-drive-service.test.ts`
- `tests/unit/google-oauth-service.test.ts`
- `tests/unit/group-recurring-todos.test.ts`
- `tests/unit/hybrid-search-service.test.ts`
- `tests/unit/migrate-r2-to-gdrive.test.ts`
- `tests/unit/pdf-extraction-service.test.ts`
- `tests/unit/pdf-job-repository.test.ts`
- `tests/unit/person-repository.test.ts`
- `tests/unit/schemas.test.ts`
- `tests/unit/statistics-repository.test.ts`
- `tests/unit/todo-grouping.test.ts`
- `tests/unit/todo-repository-crud.test.ts`
- `tests/unit/todo-repository-filtering.test.ts`
- `tests/unit/todo-repository-query.test.ts`
- `tests/unit/todo-repository-recurrence.test.ts`
- `tests/unit/validation-middleware.test.ts`
- `tests/unit/work-note-file-service.test.ts`
- `tests/unit/work-note-file-utils.test.ts`
- `tests/unit/work-note-repository.associations.test.ts`
- `tests/unit/work-note-repository.crud.test.ts`
- `tests/unit/work-note-repository.read.test.ts`
- `tests/unit/work-note-repository.versions.test.ts`
- `tests/unit/work-note-service.test.ts`
- `tests/unit/work-notes-sort.test.ts`

### Integration Tests (`tests/integration/`) (12 files)
- `tests/integration/admin-embedding-failures.test.ts`
- `tests/integration/calendar-routes.test.ts`
- `tests/integration/error-handling.test.ts`
- `tests/integration/statistics-routes.test.ts`
- `tests/integration/system-routes.test.ts`
- `tests/integration/work-note-file-view.test.ts`
- `tests/integration/work-note-gdrive-integration.test.ts`

### Top-level Tests (1 file)
- `tests/search.test.ts`

## Frontend (Web) Tests

### Hook Tests (`apps/web/src/hooks/__tests__/`) (22 files)
- `apps/web/src/hooks/__tests__/use-ai-draft-form.test.ts`
- `apps/web/src/hooks/__tests__/use-ai-draft.test.ts`
- `apps/web/src/hooks/__tests__/use-calendar.test.ts`
- `apps/web/src/hooks/__tests__/use-debounced-value.test.ts`
- `apps/web/src/hooks/__tests__/use-departments.test.ts`
- `apps/web/src/hooks/__tests__/use-download-work-note.test.ts`
- `apps/web/src/hooks/__tests__/use-persons.errors.test.ts`
- `apps/web/src/hooks/__tests__/use-persons.mutations.test.ts`
- `apps/web/src/hooks/__tests__/use-persons.query.test.ts`
- `apps/web/src/hooks/__tests__/use-pdf.test.ts`
- `apps/web/src/hooks/__tests__/use-rag.test.ts`
- `apps/web/src/hooks/__tests__/use-search.test.ts`
- `apps/web/src/hooks/__tests__/use-sidebar-collapse.test.ts`
- `apps/web/src/hooks/__tests__/use-task-categories.test.ts`
- `apps/web/src/hooks/__tests__/use-toast.test.ts`
- `apps/web/src/hooks/__tests__/use-todos.test.ts`
- `apps/web/src/hooks/__tests__/use-work-notes.errors.test.ts`
- `apps/web/src/hooks/__tests__/use-work-notes.mutations.test.ts`
- `apps/web/src/hooks/__tests__/use-work-notes.query.test.ts`

### Page Tests (`apps/web/src/pages/**/__tests__/`) (15 files)
- `apps/web/src/pages/__tests__/departments.test.tsx`
- `apps/web/src/pages/__tests__/pdf-upload.test.tsx`
- `apps/web/src/pages/__tests__/person-dialog.test.tsx`
- `apps/web/src/pages/__tests__/persons.test.tsx`
- `apps/web/src/pages/__tests__/rag.test.tsx`
- `apps/web/src/pages/__tests__/search.test.tsx`
- `apps/web/src/pages/__tests__/statistics.test.tsx`
- `apps/web/src/pages/__tests__/task-categories.test.tsx`
- `apps/web/src/pages/__tests__/work-notes.test.tsx`
- `apps/web/src/pages/dashboard/components/__tests__/week-calendar.test.tsx`
- `apps/web/src/pages/search/search-query.test.ts`
- `apps/web/src/pages/statistics/hooks/__tests__/use-statistics.test.ts`
- `apps/web/src/pages/work-notes/components/__tests__/view-work-note-dialog.test.tsx`
- `apps/web/src/pages/work-notes/components/__tests__/work-note-file-list.test.tsx`

### Component Tests (`apps/web/src/components/**/__tests__/`) (3 files)
- `apps/web/src/components/layout/__tests__/app-layout.test.tsx`
- `apps/web/src/components/layout/__tests__/header.test.tsx`
- `apps/web/src/components/layout/__tests__/sidebar.test.tsx`

### Lib/Test Utilities (7 files)
- `apps/web/src/lib/api.test.ts`
- `apps/web/src/lib/date-utils.test.ts`
- `apps/web/src/lib/mappers/department.test.ts`
- `apps/web/src/lib/pdf/generate-work-note-pdf.test.ts`
- `apps/web/src/lib/pdf/markdown-renderer.test.tsx`
- `apps/web/src/lib/utils.test.ts`
- `apps/web/src/test/pwa-config.test.ts`

## Coverage by Area (Summary)
- Repository and service layer: unit tests for repositories, services, and utilities (D1, R2, Drive, search, embeddings).
- API route coverage: integration tests for REST endpoints, file handling, and error mapping.
- Frontend hooks: query/mutation hooks validated for data, cache invalidation, and error toasts.
- UI flows: page-level tests for dashboards, CRUD screens, and modal behaviors.
- Utilities: frontend helpers (date utils, mappers, PDFs, PWA setup).

## Architectural Insights
- Worker tests emphasize repository pattern and service boundaries with targeted integration coverage for route wiring.
- Frontend hook suites are now partitioned by concern (query, mutations, errors) to keep state handling readable.
- Test helpers centralize React Query setup; many hook suites rely on `renderHookWithClient` to avoid duplicated providers.
- Integration tests focus on API behavior and error schema consistency; unit suites handle data modeling and edge cases.
